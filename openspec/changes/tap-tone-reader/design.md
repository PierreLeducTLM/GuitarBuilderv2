# Design

## Context

This change replaces `tap-tone-dialog`, which was removed before any of its tasks started. Its sound decisions are carried over here: browser audio handling, the hooks, the record check in the database, the UI additions and the test setup. Everything tied to the old pipeline is replaced. That is the 5 s window, the 16384-point Hamming frames, the silence gate and the fallbacks, and nearest-bin peaks.

What exists in the code today:
- `@gb/dsp` is an empty, DOM-free package wired into `pnpm check`.
- `StepMeasurements` lists, edits and deletes measurements, but cannot add one.
- `update_build_step` (`20261102120000_builds_and_steps.sql`) accepts `add_measurement`. It checks only the spectrum's types and list lengths, and copies the six record fields.
- `@gb/db` defines `SpectrumRecord` and `StepMeasurement` (`packages/db/src/steps.ts`).
- `DialogFrame`, `usePrompt` and `useToast` exist.
- The end-to-end suite already runs Chromium with a fake camera in its own file.

**Clean-room constraint.** The workflow follows Rick Molloy's Resonance Reader. Its source code is licensed for viewing only, and nothing in this design or its implementation may be derived from it:
- the methods come from published signal processing, with our own thresholds;
- the decay-Q section was written by a separate agent that had only our requirements and general literature;
- the public tool may be used only as a black-box cross-check, by running the same WAV files through it.

Every number in the specs was checked on synthetic signals before writing:
- a full-scale 375 Hz sine reads 1.0000 (0 dB);
- refined peaks land within 0.04 Hz of the true frequency (damped tones at 93.1, 181.73, 182.3 and 250.7 Hz, τ from 0.05 to 0.4 s);
- the three-tap scenario gives onsets at 24000, 76800 and 132000;
- the parabolic worked example gives 181.82373046875 Hz and −19.875 dB.

## Goals / Non-Goals

**Goals:**
- Every `tap-tone-capture` requirement of this change's delta.
- One dialog component with a typed result per mode.
- Pure, unit-tested DSP whose numbers match the specs' worked examples.
- Body roles stored on step measurements and checked on the server.

**Non-Goals:**
- Wiring Plate mode into the wood calculator; `wood-panel-calculator` will be updated for that.
- Removing the build analyzer (`retire-build-analyzer`). Its `acoustic-signal-analysis` code is not shared: this change has its own body-resonance module, and the old spec is deleted later.
- User-adjustable analysis settings, overlaying takes, and exporting peak data.
- Any audio leaving the browser.

## Decisions

### 1. `@gb/dsp` modules

Pure functions on typed arrays and plain readonly objects. They use no DOM, Web Audio or Node APIs, and each one has unit tests.

| Module | Contents |
|---|---|
| `fft.ts` | Iterative radix-2 complex FFT with tables cached per size, an inverse, and `realSpectrum(frame)` |
| `windows.ts` | `hann(N)`, symmetric, cached per N, with its sum |
| `biquad.ts` | Cookbook high-pass coefficients and a direct form I filter (fc 30 Hz, Q 10^(1/20)) |
| `tapTone/constants.ts` | Every fixed value of Fixed Analysis Parameters, named once |
| `tapTone/taps.ts` | Block RMS, noise floor, onsets, the rejection reasons |
| `tapTone/spectrum.ts` | Per-tap magnitude spectra (each tap's A_t² cached), the power average over a set of used taps, and the 30–1000 Hz points |
| `tapTone/peaks.ts` | Candidates, parabolic refinement, ranking and limits, the mobile exclusion, `nearestPeak` |
| `tapTone/bandwidthQ.ts` | Spectral Q by the −3 dB method |
| `tapTone/body.ts` | Body candidates, role assignment, reliability, and re-attaching manual roles after a recomputation |
| `tapTone/decay/*` | Decay Q (decision 3) |
| `tapTone/note.ts` | The note label |
| `tapTone/record.ts` | A record from the points, and points from a record |
| `wav.ts` | `encodeWav` and `wavFileName` |

**One FFT, written here.** The 32768-point transform is about 40 lines and can be tested against a direct DFT. It also serves the band isolation of decay Q.
- Alternative considered: `fft.js` (MIT). Rejected, so that the package stays dependency-free and the FFT is tested here like everything else.

**Hann window, not Hamming.** Each tap window holds a single decaying transient that starts a quarter of the way in. Hann's sidelobes fall off much faster, so a strong mode leaks less into a weak neighbour, and it is the usual choice for parabolic refinement on dB.
- Alternative considered: an exponential window, as in hammer impact testing. Rejected because it adds damping and so biases both Q values.

**The window starts 8192 samples (171 ms) before the onset.** The onset then falls at the window's 25% point, where the Hann weight is 0.5, and 512 ms of decay remain. That covers time constants up to about 0.5 s, the stiffest plates' range, while still leaving room for taps about a second apart.
- Alternative considered: starting the window at the onset. Rejected because the strongest part of the tap would get nearly zero weight.

**Power averaging over taps.** A[k] = sqrt(mean(A_t[k]²)) weights each tap by its energy, which is the standard way to average spectra.
- Alternative considered: a linear mean of magnitudes, as the old spec did. Rejected because it lets a quiet, noisy tap pull a narrow peak down.
- The per-tap A_t² arrays are cached, so excluding a tap only re-averages; nothing is transformed again.

**Bins are 1.46 Hz without zero-padding.** 32768 samples is the window itself, so the resolution comes from real signal. The parabolic step then gives the sub-bin accuracy measured above. A record holds 662 points, which stays under the 1024-point cap.
- Alternative considered: zero-padding to 65536. Rejected because it gives 1325 points per record and no real gain on top of the parabola.

### 2. One analysis, run in steps, with lazy decay Q

`analyzeTake(channels, sampleRate, { mode, mobile })` is a generator that runs in this order:
1. it filters and finds the taps;
2. it computes the per-tap spectra (one yield per 4 taps);
3. it builds the average, points and peaks with spectral Q;
4. in Instrument mode, it assigns the body roles.

`recompute(cache, usedTaps)` reruns only steps 3 and 4.

**Decay Q is computed on demand,** and memoized per (tap, peak frequency rounded to 0.01 Hz):
- for the selected peak;
- in Instrument mode, for each role;
- in Plate mode, for each take's selected peak.

That is at most 4 peaks × 50 taps fits. The Detected Peaks list does not show decay Q, so none is computed for the other peaks.

**Performance budget:** results within 1 s for a 10 s recording with 8 taps on a mid-range phone. It has not been measured yet; task 7.2 measures it.

**The dialog drives the generator with `setTimeout(0)` between yields.**
- Cancel abandons a run.
- A result that arrives late is ignored by the reducer.
- If the budget is missed, the generator moves unchanged into a module Web Worker (`new Worker(new URL(...), { type: 'module' })`). That is why the DSP stays free of closures over the DOM.
- Alternative considered: a worker from the start. Rejected for now, because it adds a bundling path that the build and end-to-end setup don't exercise yet.

**Edge cases the spec leaves to the implementation:**
- Fewer than 2 samples counts as "Error processing audio".
- No onset gives "No tap detected".
- Onsets that exist but are all rejected give the results state with "None of the taps can be used".

### 3. Decay Q (clean-room)

**Provenance.** This decision was written by a separate agent. It was given only our requirements and general signal-processing literature: it did not see the Resonance Reader, its code, or the code pasted into the exploration session, and it ran no web searches. It checked its constants with a throwaway simulation of this exact pipeline. The "Observed" column below comes from that simulation. The normative formulas are the decay requirements of the `tap-tone-capture` delta (Decay Q Measurement through Peak Inspector Decay View). This section explains the choices and lists the verification cases.

```
 inputs per peak: f0 [Hz], L0 [dB], BW [Hz] or none, neighbour peaks {f_n, L_n}
 inputs per recording: filtered signal x[n] (48 kHz), accepted tap onsets, quiet stretches

 +-------------------------------+
 | B. Choose isolation band      |  d_min = nearest relevant neighbour or 2*f0 (image)
 |    (once per peak)            |  T_h = 3.5 / d_min, clamped to [0.02 s, 0.5 s]
 +-------------------------------+  T_h > 0.5 s or BW pre-check fails -> MODE_NOT_ISOLATED
                |
                v
 +-------------------------------+      +--------------------------------+
 | A. Cut tap segment            |      | D. Noise floor (once per peak) |
 |    onset .. min(next onset    |      |    same filter on quiet        |
 |    - 10 ms, end, onset + 3 s) |      |    stretches -> N (Rayleigh    |
 +-------------------------------+      |    median); fallback: tap      |
                |                       |    tails; else NO_QUIET_REF    |
                v                       +--------------------------------+
 +-------------------------------+                     |
 | C. Isolate the mode           |                     |
 |    x * exp(-j 2 pi f0 t)      |                     |
 |    -> 4-stage moving average  |                     |
 |       (48) and decimate to    |                     |
 |       1000 Hz                 |                     |
 |    -> Blackman FIR, length    |                     |
 |       T_h (linear phase)      |                     |
 |    -> envelope e = 2 |y|      |                     |
 +-------------------------------+                     |
                |                                      |
                v                                      v
 +-------------------------------------------------------------+
 | E. Fit interval: start = filter half-support + 5 ms guard   |
 |    end = last sample >= 10 * N (20 dB above noise) or the   |
 |    end of the valid segment                                 |
 +-------------------------------------------------------------+
                |
                v
 +-------------------------------+
 | F. Fit: least squares line on |  tau = -8.6859 / slope   (slope in dB/s)
 |    20*log10(e) vs time        |  Q_d = pi * f0 * tau
 +-------------------------------+
                |
                v
 +-------------------------------+
 | G. Per-tap quality checks     |  samples >= 8, slope < 0, range D >= 10 dB,
 |    -> Q_d or a reason code    |  residual RMS <= 1.0 dB, half-slopes agree
 +-------------------------------+
                |
                v
 +-------------------------------+
 | H. Combine taps               |  n_valid >= 3, median, MAD/median <= 0.15
 |    -> Q_d(peak) or a reason   |  -> TOO_FEW_VALID_TAPS / TAPS_INCONSISTENT
 +-------------------------------+
                |
                v
 +-------------------------------+
 | I. Inspector series           |  isolated response (min/max, <= 800 points),
 |    (on demand, one tap)       |  envelope, fit curve, markers, per-tap table
 +-------------------------------+
```

**Why a finite (FIR) filter after complex demodulation.**
- The signal is a sum of damped sinusoids. Once a linear-phase FIR filter's whole support lies after the onset, its output is the same sum, each sinusoid scaled by a constant gain. So the filter adds no settling bias to τ, however long the kernel is.
- An IIR band-pass rings with its own poles, and it would report a fast mode at the filter's decay rate.
- This is what lets the kernel be long enough to reject a neighbour 12 Hz away without a settling rule tied to τ.
- Alternative considered: a Butterworth band-pass. Rejected for that bias.

**Why a straight-line least-squares fit of the dB envelope, not a direct damped-sinusoid fit.**
- It has a closed form and is deterministic: no starting values and no convergence failures.
- After isolation, with the fit ending 20 dB above the noise, it costs about 0.2% scatter at typical noise levels.
- Its residuals in dB are both the quality measure and what the inspector draws.
- The fit is unweighted, because weighting by e² would favour the first milliseconds, where contact and other modes distort the most.

**Why "refuse with a reason" rather than a best effort.** A wrong Q looks exactly like a right one on screen. Each refusal names something the user can act on: leave silence first, leave more time between taps, tap the same way each time.

**Where the inputs come from in this change:**
- the filtered first channel;
- the onsets of all detected taps (for segment ends);
- the used taps (the ones measured);
- the quiet stretches (before the first onset, and from 3 s after the last onset);
- each peak's refined frequency, refined level and spectral bandwidth;
- the other detected peaks.

The work is computed lazily (decision 2) and costs under 10⁶ operations per peak and tap.

**Constants:**

| Symbol | Value | Section |
|---|---|---|
| Next-tap margin | 10 ms | A |
| Segment cap | 3.0 s | A |
| Neighbour relevance | L0 - 30 dB | B |
| kappa | 3.5 | B |
| T_h range | 0.02 to 0.5 s (spacing >= 7.0 Hz) | B |
| Pre-check limit P | 30 dB | B |
| Decimation, smoother | 48, 4 stages | C |
| Kernel | Blackman, M odd | C |
| T_qmin | max(0.1 s, 3 T_he) | D |
| Tail window W | max(100, 3 (M - 1)) samples at 1 kHz | D |
| N floor | 1e-6 | D |
| End margin | 20 dB (e_thr = 10 N_eff) | D, E |
| Contact guard | 5 ms | E |
| Min fit samples | 8 | G |
| D_min | 10 dB | G |
| r_max | 1.0 dB | G |
| rho range | 0.70 to 1.43 | G |
| Min valid taps | 3 | H |
| MAD / median max | 0.15 | H |
| Display buckets / points | 400 buckets / 800 points | I |

**Reason codes** (message keys under `tapTone.decayReasons.*`):

| Code | Scope | Condition | Message (en) | Message (fr) |
|---|---|---|---|---|
| MODE_NOT_ISOLATED | peak | d_min < 7.0 Hz, or BW pre-check P > 30 dB | Another resonance is too close to this one to measure its decay on its own. | Une autre résonance est trop proche de celle-ci pour mesurer sa décroissance seule. |
| NO_QUIET_REFERENCE | peak or tap | No quiet stretch long enough and no usable tap tail; or a tap failed for lack of range while the noise floor came from tap tails | The recording has no silent moment to measure background noise. Leave about one second of silence before the first tap. | L'enregistrement n'a aucun moment de silence pour mesurer le bruit de fond. Laissez environ une seconde de silence avant la première frappe. |
| NOT_ENOUGH_DECAY | tap | Envelope already below 20 dB above noise at the fit start, fewer than 8 samples, or less than 10 dB of decay before reaching the noise | This resonance does not ring far enough above the background noise to measure its decay. | Cette résonance ne ressort pas assez du bruit de fond pour mesurer sa décroissance. |
| DECAY_CUT_OFF | tap | Less than 10 dB of decay when the next tap or the end of the recording arrives, or segment too short | The next tap or the end of the recording came before this resonance had died away. Leave more time between taps. | La frappe suivante ou la fin de l'enregistrement est arrivée avant que cette résonance s'éteigne. Laissez plus de temps entre les frappes. |
| NO_DECAY | tap | Fitted slope >= 0 dB/s | The level of this resonance does not fall after the tap. | Le niveau de cette résonance ne diminue pas après la frappe. |
| NOT_EXPONENTIAL | tap | Residual RMS > 1.0 dB, or early and late decay rates differ (rho outside 0.70 to 1.43) | The ring-down does not follow one smooth decay, usually because two resonances are beating together. | La décroissance ne suit pas une courbe régulière, souvent parce que deux résonances battent ensemble. |
| TOO_FEW_VALID_TAPS | peak | Fewer than 3 accepted taps | Fewer than 3 usable taps. Record more taps. | Moins de 3 frappes exploitables. Enregistrez davantage de frappes. |
| TAPS_INCONSISTENT | peak | MAD / median of valid Q_d > 0.15 | The taps give very different decay values, so no single value can be trusted. Tap the same spot the same way each time. | Les frappes donnent des valeurs de décroissance très différentes : aucune valeur unique n'est fiable. Frappez au même endroit, de la même façon. |

When 3 or more taps were accepted but fewer than 3 are valid, the peak reason is the most frequent
per-tap reason (ties: NO_QUIET_REFERENCE, DECAY_CUT_OFF, NOT_EXPONENTIAL, NOT_ENOUGH_DECAY,
NO_DECAY), shown with "n_used of n_accepted taps".

**Verification on synthetic signals.** Task group 3 implements these as unit tests in `@gb/dsp`. T18 runs nightly, not on every commit.

Generator (all tests): t = n / 48000; x[n] = sum over modes of a_m * exp(-t/tau_m) * sin(2*pi*f_m*t + phi_m)
+ sigma * g[n], g = standard Gaussian from a seeded PRNG (fixed seed per test; tolerances hold with
margin for any seed, see the Monte Carlo row). Each tap starts at its onset (n = 0 of the segment).
Unless stated: phi = 0, one quiet stretch of 2.0 s of the same noise, a peak list containing the
listed modes at their exact frequencies with equal levels, no BW. "Observed" = value from the
reference simulation of this exact design.

| # | Input | Expected | Tolerance | Observed |
|---|---|---|---|---|
| T1 | 180 Hz, a = 0.5, tau = 0.2 s, sigma = 1e-3, 1.5 s | T_h = 0.02 s (d_min = 360 Hz image -> 0.0097 s, clamped); valid; tau = 0.200 s; Q_d = 113.1; endedBy noise; t_end about 1.29 s; D > 40 dB; r < 0.5 dB; rho in [0.95, 1.05] | Q, tau +/-1 %; t_end +/-0.05 s | Q 113.2, t_end 1.296, D 55.5, r 0.18 |
| T1b | T1 with sigma = 0 (quiet stretch all zeros) | N_eff = 1e-6; endedBy recordingEnd; Q_d = 113.1 | +/-0.1 % | 113.10 |
| T1c | T1 with sigma = 0 and one extra relevant peak listed 35, 12 or 7 Hz away but absent from the signal, forcing T_h = 0.1, 0.2917 or 0.5 s | Q_d = 113.1 for every T_h (no settling bias) | +/-0.1 % | 113.10 for all |
| T2 | 180 Hz (a 0.5, tau 0.2) + 192 Hz (a 0.5, tau 0.3), sigma = 1e-4, both peaks listed | T_h = 0.2917 s, M = 293; Q(180) = 113.1; Q(192) = pi*192*0.3 = 181.0; r < 0.2 dB | +/-1 % | 113.1 / 181.0, r 0.04 |
| T2b | T2 with the 192 Hz amplitude 5.0 (+20 dB) | Q(180) = 113.1; r < 0.6 dB | +/-1 % | 113.2, r 0.41 |
| T2c | T2 but the 192 Hz peak missing from the peak list | T_h = 0.02 s; NOT_EXPONENTIAL (r about 3 dB) | reason exact | r 3.08 |
| T3 | Peaks 200.0 and 205.0 Hz | MODE_NOT_ISOLATED, neighbour 205.0, spacing 5.0; no per-tap results | exact | - |
| T3b | 200 Hz + 207 Hz, both a 0.5, tau 0.3, sigma 1e-4 | T_h = 0.5 s; Q(200) = 188.5 | +/-1 % | 188.5 |
| T3c | Peaks 200.0 and 206.9 Hz | MODE_NOT_ISOLATED (3.5/6.9 = 0.507 s > 0.5) | exact | - |
| T4 | 200 Hz, a 0.5, tau 0.6, segment 0.6 s, sigma 1e-4 | endedBy recordingEnd, D about 8.3 dB -> DECAY_CUT_OFF | D +/-0.3 dB | D 8.25 |
| T4b | T4 with a 1.0 s segment | valid, endedBy recordingEnd, D about 14 dB, Q_d = 377.0 | +/-1 % | D 14.04, Q 377.0 |
| T5 | Pure noise, sigma 1e-3, 1.0 s, f0 = 180 Hz | NOT_ENOUGH_DECAY; 5 such taps -> peak reason NOT_ENOUGH_DECAY, 0 of 5 | exact | empty interval |
| T6 | 180 Hz a 0.5 + 182.5 Hz a 0.25 (beating, 2.5 Hz), both tau 0.2, sigma 1e-4, only 180 listed | NOT_EXPONENTIAL, r > 2.5 dB | reason exact | r 3.19 |
| T6b | T6 with second amplitude 0.05 (ratio 0.1) | valid, Q_d = 113.1 | +/-2 % | 112.8, r 0.61 |
| T7 | 180 Hz a 0.5 tau 0.08 + 180.5 Hz a 0.05 tau 0.4 (two-stage decay), sigma 1e-5 | NOT_EXPONENTIAL (rho about 2) | reason exact | rho 2.06, r 3.3 |
| T8 | Five taps at 180 Hz, a 0.5, sigma 1e-3, tau = 0.2, 0.2, 0.2, 0.2, 0.35 (different seeds) | Q_med = 113.1, 5 of 5, MAD/median < 0.02 | +/-1 % | 113.21, 113.23, 113.00, 113.03, 197.90 |
| T9 | Three taps tau = 0.1, 0.2, 0.3 at 180 Hz, sigma 1e-4 | TAPS_INCONSISTENT (MAD/median = 0.5) | exact | 56.50, 113.09, 169.65 |
| T10 | Five taps: two like T1, three like T4 | Peak reason DECAY_CUT_OFF, 2 of 5 | exact | - |
| T10b | Two accepted taps, both like T1 | TOO_FEW_VALID_TAPS | exact | - |
| T11 | No quiet stretch; three taps of 2.0 s, 180 Hz tau 0.1, sigma 1e-3 | noiseSource tapTail; Q_med = 56.5 | +/-1 % | N 7.95e-5, Q 56.7 |
| T11b | No quiet stretch; three taps of 0.6 s, 200 Hz tau 0.6, sigma 1e-3 | per-tap NO_QUIET_REFERENCE; peak reason NO_QUIET_REFERENCE | exact | tail floor 0.25, empty interval |
| T11c | No quiet stretch, one tap of 0.12 s | Peak result NO_QUIET_REFERENCE (no tail window) | exact | - |
| T12 | 250 Hz Q 20 (tau = 0.02546 s) a 0.5 + 300 Hz a 0.5 tau 0.05, sigma 1e-4 | T_h = 0.07 s; Q_d = 20.0 | +/-2 % | 20.01 |
| T13 | 40 Hz, tau 0.1, a 0.5, sigma 1e-4, alone | d_min = 80 Hz (image), T_h = 0.04375 s, M = 45; Q_d = 12.57 | +/-1 % | 12.54 |
| T14 | 180 Hz a 0.05 tau 0.2 + 820 Hz a 0.5 tau 0.4 (820 + 180 = 1000 Hz: worst-case alias), sigma 1e-5 | Q(180) = 113.1 | +/-1 % | 113.1 |
| T15 | BW pre-check: peaks 180 (BW 20 Hz) and 190 Hz | MODE_NOT_ISOLATED (P = 99 dB); with BW 2 Hz the peak is analysed (P = 9.9 dB) | exact | - |
| T16 | Noise floor: 2.0 s white noise sigma 1e-3, T_he = 0.02 s | N within 1.5 dB of sigma * sqrt(2 * 1.73 / (T_he * 24000)) = 8.5e-5 | +/-1.5 dB | 8.08e-5 (-0.4 dB) |
| T17 | Inspector series for T1 | envelope n_e = 1477, s = 2, 739 points; isolatedResponse 800 points; fit points only in [t_start, t_end]; t_start = 0.01696 s | exact counts | - |
| T18 | Monte Carlo (nightly, 200 seeds): 180 Hz tau 0.2, a = 0.03, sigma = 1e-2 (D about 10 dB) | RMS error of per-tap Q_d <= 5 %; NOT_EXPONENTIAL false-reject rate <= 3 % | - | 3.1 % RMS, 1 % rejected |

Note on T1c: a relevant peak listed but absent from the signal is the cleanest way to force a
kernel length; it proves the filter adds no settling bias. Tolerances: +/-1 % covers the observed worst
case of 20 seeds at sigma up to 1e-2 (+/-0.5 %) with margin; +/-2 % for cases with a deliberate
second component or short fits (T6b, T12).

**Limits and how the UI says so:**

| Limit | Effect | How the UI says it |
|---|---|---|
| Modes closer than 7 Hz, or a broad mode next to a neighbour | Cannot be separated within one tap's ring-down; refused rather than guessed. | MODE_NOT_ISOLATED with the neighbour and spacing. Hint: "Spectral Q is still shown." |
| Undetected neighbour (two modes merged into one spectral peak) | Beating in the envelope; refused if strong (r > 1 dB); a weak one (amplitude ratio below about 0.15) passes with an error of about 1 %. | NOT_EXPONENTIAL with the envelope plotted so the beating is visible. |
| Very low Q next to neighbours | The filter must be long, the mode is gone before the fit starts. | MODE_NOT_ISOLATED (pre-check) or NOT_ENOUGH_DECAY. |
| Room reverberation | The microphone hears mode plus room. A room's sound decays at amplitude tau of about RT60 / 6.9 (40 to 90 ms in a furnished room). Modes decaying faster than the room can be measured too slow; high-Q modes are unaffected. The method cannot detect this. | Static help text: "Measured close to the instrument in a quiet room. Very short decays (Q below about 20) can be lengthened by room echo." |
| Browser audio processing (auto gain, noise suppression) | Auto gain lengthens decays; noise suppression gates tails and shortens them. Fatal to decay Q. | Must be switched off at capture (capture-stage requirement, outside this design); the inspector shows nothing special. |
| Amplitude-dependent damping, supports, hands on the plate | Real tap-to-tap differences, not algorithm errors. | TAPS_INCONSISTENT with the per-tap table. |
| Short gaps between taps | Long decays (tau > about 0.25 s with taps 0.6 s apart) cannot reach 10 dB of range. | DECAY_CUT_OFF: "Leave more time between taps." |
| No silence in the recording | Noise floor from tap tails is an upper bound; fits are shorter, and slow modes are refused. | NO_QUIET_REFERENCE: "Leave about one second of silence before the first tap." |
| Spectral Q vs decay Q | With the 32768-point Hann window, spectral BW cannot go below about 2.1 Hz, so spectral Q is capped near f0 / 2.1 (about 86 at 180 Hz). Decay Q has no such cap. | Inspector note when spectral Q > 0.7 x f0 / 2.1: "Spectral Q is limited by the analysis window; decay Q is more reliable here." |
| Modes within about 15 Hz of the 30 Hz high-pass | The high-pass transient (7.5 ms) overlaps the band; small extra error. | No special message; covered by the fit checks. |
| Statistical precision at minimum range | About 3 % per tap at D = 10 dB; median over 3 to 10 taps reduces it. | Show "n_used of n_accepted taps"; integer display. |

**References (general literature):**

- J. S. Bendat, A. G. Piersol, Random Data: Analysis and Measurement Procedures, 4th ed., Wiley, 2010 (analytic signal and envelope, estimation variance and time-bandwidth product).
- S. O. Rice, "Mathematical analysis of random noise", Bell System Technical Journal 23-24, 1944-45 (Rayleigh and Rician envelope statistics).
- A. V. Oppenheim, R. W. Schafer, Discrete-Time Signal Processing, 3rd ed., Pearson, 2010 (FIR linear-phase filters, decimation, Hilbert transform).
- P. Bloomfield, Fourier Analysis of Time Series: An Introduction, 2nd ed., Wiley, 2000 (complex demodulation).
- E. B. Hogenauer, "An economical class of digital filters for decimation and interpolation", IEEE Trans. ASSP 29(2), 1981 (cascaded moving-average decimators).
- F. J. Harris, "On the use of windows for harmonic analysis with the discrete Fourier transform", Proc. IEEE 66(1), 1978 (Blackman and Hann properties: sidelobes, noise bandwidth, -3 dB width).
- D. J. Ewins, Modal Testing: Theory, Practice and Application, 2nd ed., Research Studies Press, 2000 (modal damping, Q, half-power bandwidth, logarithmic decrement).
- ISO 3382-1:2009 and ISO 3382-2:2008, Acoustics, measurement of room acoustic parameters (decay evaluation ranges, early decay time over 10 dB, noise headroom).
- M. R. Schroeder, "New method of measuring reverberation time", JASA 37, 1965; A. Lundeby et al., "Uncertainties of measurements in room acoustics", Acustica 81, 1995 (decay curves and background noise).
- N. H. Fletcher, T. D. Rossing, The Physics of Musical Instruments, 2nd ed., Springer, 1998 (orders of magnitude for Q and decay of wooden plates and bodies).
- P. J. Huber, E. M. Ronchetti, Robust Statistics, 2nd ed., Wiley, 2009 (median, median absolute deviation).

### 4. Body roles

- `body.ts` applies the candidate, assignment and reliability rules of the delta to the averaged spectrum.
- A role is `{ frequency, level, spectralQ, decayQ, origin }`, with `origin: 'auto' | 'user'`.
- The `resolution coarser than 3 Hz` rule of `acoustic-signal-analysis` is dropped: the reader always analyzes at 1.46 Hz, and Instrument mode never reopens a saved record.

**Manual roles live in the take's state.**
- After `recompute`, `reattachManualRoles` moves each manual role to the nearest detected peak within 3 Hz, or clears it.
- Automatic roles are simply reassigned.
- Re-record clears both.

**Drag and keyboard:**
- On the spectrum, each role label is a draggable handle (pointer events, so mouse, pen and touch all work).
- Dropping a label within 20 Hz of a peak (the same snap rule as hover) assigns the role to that peak. Dropping it anywhere else returns it to where it was.
- The roles panel offers the same thing without dragging: each role has "Move" (the next click on a peak or a Detected Peaks button assigns it) and "Clear".
- Dragging a text label only moves the role, never the peak.

### 5. Audio in the browser (carried over)

`apps/web/src/components/tap-tone/audio.ts`:

**Decoding:**
- `OfflineAudioContext(1, 1, 48000).decodeAudioData` resamples to 48 kHz for files from any device.
- Recordings keep the `mimeType` that `MediaRecorder` chose.
- File channels are averaged.
- Every channel is high-pass filtered in `@gb/dsp`. The first channel is analyzed, all channels are played and exported, and the unfiltered channels are kept only for the clipping test.

**Capture:**
- `getUserMedia` with the exact device, 1 channel, 48 kHz and the three processing flags off.
- `MediaRecorder` uses the spec's type order with `start(100)`.
- A 100 ms interval drives the counter and the stop at 10.0 s.
- An `AnalyserNode` (2048) feeds the oscilloscope. Its loop starts when the recording state is entered, which fixes the legacy loop that never drew.
- The tracks are stopped on stop and on cancel.

**Mobile detection:** `/android|mobile|tablet/i` on the user agent, `maxTouchPoints > 0` or `ontouchstart`. It is computed once per analysis.

**Playback and export:**
- One `AudioContext`, closed with the dialog.
- `encodeWav` through an object URL, named `wood-frequency-analysis-<UTC timestamp>.wav`.

### 6. The dialog: per-take reducers plus thin hooks

`apps/web/src/lib/tap-tone/machine.ts` is a pure reducer, unit-tested:
- **Dialog state:** `{ mode, takes: Take[], active }`, where Plate has 3 takes and Instrument has 1.
- **Each take:** `idle | recording | analyzing | results`.
- **A results take holds:**
  - the analysis cache;
  - the used-tap set;
  - the selected peak;
  - the roles (Instrument);
  - the audio, or `null` for a saved record;
  - a run id, so that results from a cancelled or superseded run are ignored.
- **Errors:** an error message key in the banner, cleared by a new recording or file load.
- **Switching takes** is disabled while recording.

**Hooks:**
- `useAudioInputs`, `useRecorder` and `usePlayback`, as in the old design: enumeration only on open, `devicechange`, and "Microphone <n>" for unnamed devices;
- `useTakeAnalysis`, which drives the generator and the lazy decay-Q queue.

**Caller interface (a discriminated union):**

```ts
type PlateMode = 'longitudinal' | 'crossGrain' | 'diagonal';
type PlateResult = Partial<Record<PlateMode, {
  frequency: number; spectrum: SpectrumRecord;
  spectralQ: number | null; decayQ: number | null }>>;
type InstrumentResult = { frequency: number; spectrum: SpectrumRecord; roles: MeasurementRoles };

<TapToneDialog mode="plate" label={...}
  currentValues={Partial<Record<PlateMode, number>>}
  savedRecords={Partial<Record<PlateMode, SpectrumRecord>>}
  onConfirm={(r: PlateResult) => void} onCancel={() => void} />
<TapToneDialog mode="instrument" label={...}
  onConfirm={(r: InstrumentResult) => void} onCancel={() => void} />
```

- Each opening is a fresh mount (`key`).
- Outside clicks are disabled.
- On viewports narrower than 640 px the dialog fills the screen.

### 7. Layout and graphs

```
+----------------------------------------------------------------+
| Frequency Detector (?)                      label        [x]   |
| [Longitudinal 181.8] [Cross-grain 92.7] [Diagonal -]  (Plate)  |
| guidance for the active take                                   |
+----------------------------------------------------------------+
| waveform  |--1--|      |--2--|      x3 clipped      3 of 3 used|
+----------------------------------------+-----------------------+
| spectrum 30-1000 Hz, -100..0 dB        | Detected Frequency    |
|   markers, role labels (Instrument)    | Current Value (Plate) |
|                                        | Roles (Instrument)    |
+----------------------------------------+-----------------------+
| Detected Peaks (5)                                             |
| Peak inspector: ring-down, envelope, fit, per-tap Q, median    |
+----------------------------------------------------------------+
| [Play] [Download Audio] [Re-record]          [Cancel] [Confirm]|
+----------------------------------------------------------------+
```

On a phone the right column drops below the spectrum and the inspector folds away.

All the graphs are SVG with token colours:
- the waveform: min/max per pixel column, with tap markers as focusable buttons;
- the spectrum: the old design's marker styles, snap and pointer rules, plus role handles;
- the ring-down plot (decision 3).

The oscilloscope stays a canvas whose colours are read from the CSS tokens. The spectrum has `role="img"` with a label naming the peaks and roles. The keyboard paths are the Detected Peaks buttons, the tap markers and the roles panel.

### 8. "Add Analysis" and roles on build steps

In `StepMeasurements`, owners get "Add Analysis". The flow:
1. The dialog opens with `mode="instrument"`.
2. `onConfirm` asks for the description with `usePrompt` ("Resonance Analysis").
3. Saving sends `add_measurement` with `{ id: crypto.randomUUID(), timestamp, description, frequency, spectrum, roles? }`. `roles` is omitted when empty.

The list shows the roles line, using `decimal1` and the role names from `tapTone.roles.*`.

`@gb/db`:

```ts
type BodyRole = { frequency: number; level: number; spectralQ: number | null;
                  decayQ: number | null; origin: 'auto' | 'user' };
type MeasurementRoles = Partial<Record<'air' | 'top' | 'back', BodyRole>>;
StepMeasurement.roles?: MeasurementRoles
```

`SpectrumGraph`'s dB axis becomes −100..0, as in the delta.

### 9. Server-side checks

One migration adds two SQL functions. Both are `immutable`, `set search_path = ''`, with execute granted to `authenticated` and `service_role`.

**`public.spectrum_record_is_valid(jsonb)`:**
- the six numeric fields;
- 1–1024 points of equal length;
- strictly ascending frequencies in (0, 2000];
- magnitudes ≥ 0;
- `sampleRate > 0`;
- `fftSize` a power of two ≤ 32768;
- `abs(binWidth − sampleRate/fftSize) ≤ 1e-9 · binWidth`.

**`public.measurement_roles_are_valid(jsonb)`:**
- the value is null or an object whose keys are among `air`, `top`, `back`;
- each role is an object with:
  - a numeric `frequency` in [30, 1000];
  - a numeric `level`;
  - `spectralQ` and `decayQ` each null or a number > 0;
  - `origin` either `auto` or `user`;
- no other keys.

**`update_build_step` is redefined** (`create or replace`, same signature and grants). Its `add_measurement` branch:
- calls both functions, raising `Invalid spectrum` or `Invalid measurement` (22023);
- copies `roles` field by field, like the spectrum, so that no unchecked key is stored.

The legacy import writes as `service_role` with single-peak measurements, which still validate.

The wood calculator will use `spectrum_record_is_valid` in its check constraint.

**Alternatives considered:**
- JSON Schema: not available in Supabase's Postgres.
- An app-only check: the specs require the server.

### 10. UI kit and text

`@gb/ui` gains:
- `Tooltip` on `@radix-ui/react-tooltip`, pinned exactly to the newest release at least two weeks old; it opens on hover and focus, and a tap toggles it;
- `SelectField`, a native select in `Field`.

Every string lives under `tapTone.*` in `en.json` and `fr.json`, with French role names:
- Air: "Air";
- Top: "Table";
- Back: "Fond".

The plate take names are:
- Longitudinal: "Longitudinal (f_L)";
- Cross-grain: "Travers (f_C)";
- Diagonal: "Diagonale (f_LC)".

The note label stays the same in both languages.

### 11. Tests

**`@gb/dsp` unit tests (synthetic signals with known answers):**
- the FFT against a direct DFT;
- the Hann sum;
- the 375 Hz calibration;
- the high-pass response;
- onsets for the three-tap scenario;
- a double hit counting once;
- each rejection reason;
- 662 points from 30.76171875 to 999.0234375 Hz;
- the parabolic worked example and the four damped tones within 0.2 Hz;
- candidate rules and ripple, the 35 dB cut, the top 10, the mobile exclusion;
- spectral Q = 20 for the 195/205 Hz example;
- body roles for every scenario of the delta;
- re-attaching manual roles;
- note labels ("F#3 −30 c" for 181.82 Hz);
- records from a 16384-point legacy record;
- WAV bytes;
- the decay-Q cases of decision 3.

**App unit and component tests:**
- the reducer: every transition per take, the run id, switching takes, manual roles;
- the dialog with mocked media APIs:
  - opening calls only `enumerateDevices`;
  - the constraints;
  - "2.3s / 10s";
  - excluding a tap updates the spectrum and the count;
  - dragging a role label and the keyboard "Move" path;
  - the Plate take selector;
  - the Plate Confirm result shape;
  - the Instrument result shape;
  - reopening with saved records.

**pgTAP `10_spectrum_records.test.sql`:**
- 662-point and 331-point records accepted;
- each shape rule refused;
- valid and invalid roles;
- an oversized or invalid `add_measurement` leaves the step unchanged;
- the function settings and grants.

**End-to-end tests:**
- **Fixtures**, generated with `encodeWav`:
  - `taps.wav`: three taps at 0.50, 1.60 and 2.75 s, 190 Hz and 95 Hz modes, 15 Hz rumble;
  - `body.wav`: three taps exciting 98.4, 196.9 and 247.5 Hz;
  - `clipped.wav`: one tap clipped, two clean.
- **`tap-tone.spec.ts`** uses Chromium's fake microphone on `body.wav`. It records on a build step and checks Air, Top and Back and the inspector. It drags Top, confirms, saves "Box closed", reloads, and finds the roles line.
- **File upload:** `taps.wav` and `clipped.wav`, where tap 2 shows "Clipped" and "2 of 3 taps used".
- **Errors:** an unsupported `.flac`; a recording of silence giving "No tap detected".
- **The rest:** cancel during recording; the phone project's mobile exclusion; the French dialog; a refused record showing "Failed to save changes".
- **Plate mode** is tested at component level, because it has no caller until the wood calculator is rewired.

## Risks / Trade-offs

- **[Tap detection misses soft taps or splits ringing]**
  - The threshold adapts to the noise floor, and the 100 ms debounce merges bounces.
  - The waveform shows every decision, and the user can exclude taps.
  - The fixtures cover a quiet tap and a double hit.
- **[Taps closer than ~0.7 s are all rejected]** The help asks for about a second between taps, and the reason is shown on each tap.
- **[Spectral Q is biased by the tap window]**
  - Measured on synthetic damped tones during task 2.2: about 8–16% high for τ of 10–50 ms, because the Hann taper reshapes the start of the decay.
  - It is capped near f / 2.1 Hz for long decays (0.59 × π·f·τ at 180 Hz, τ 0.2 s).
  - The UI shows both Q values, and the inspector explains that decay Q is the more reliable one for high-Q modes.
- **[Decay Q on short or noisy decays]** The method refuses with a reason instead of guessing (decision 3). The inspector shows the evidence.
- **[Instrument mode on a free plate]** All roles are reported as not identified, but a main peak can still be confirmed. A Plate mode for build steps is a possible follow-up.
- **[Performance on phones]** Decay Q is computed lazily, with the 1 s budget measured in task 7.2. The worker fallback is ready if needed.
- **[Chromium's fake microphone in CI]** It was confirmed working in the earlier design. The file-upload tests still cover the whole analysis if the recording test has to be skipped.
- **[Touchscreen laptops count as mobile]** The rule is kept as specified.
- **[Clean-room drift]** A reviewer checks that no task references the third-party code. The black-box comparison uses only the public page.

## Migration Plan

**Deploy:**
- One additive migration: the two functions and `update_build_step` redefined with the same signature and grants.
- No environment variables are added.
- Existing step measurements (single peak, 16384-point records) remain valid and display as before. The graph's dB axis now extends to 0.

**Rollback:**
- Redeploy the previous app build.
- Restore `update_build_step` from `20261102120000_builds_and_steps.sql`.
- Roles already stored are ignored by the old app, because the field is extra JSON.

**Docs:**
- `docs/rewrite/README.md` records that the 2026-11-01 "no sub-bin interpolation" decision was reversed on 2026-11-04.
- The legacy finding is marked as answered.

## Open Questions

- ~~Is the 1 s performance budget met without a worker?~~ Measured in task 7.2 on a 10 s, 8-tap Instrument recording with decay Q for the main peak and three roles. Headless Chromium with Pixel 7 emulation and 4× CPU throttling: about 145 ms of analysis plus 120 ms of decay Q, so about 0.27 s. Desktop: about 65 ms. The analysis stays on the main thread. Checking on a real phone remains a follow-up.
- Should a black-box comparison against the public Resonance Reader, using our three fixtures, be kept as a manual check in the README? It doesn't affect the implementation.
