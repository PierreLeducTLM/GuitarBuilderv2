# Design

## Context

What `foundation` and `builds-and-sequence` left for this change:
- `@gb/dsp` is an empty, DOM-free package wired into `pnpm check`;
- the step dialog's Sound Analysis section lists, edits and deletes measurements (`StepMeasurements`), but has no way to add one;
- `update_build_step` already accepts `add_measurement` with a Tap-Tone Spectrum Record, checking only types, equal list lengths and the 2000 Hz limit;
- `@gb/db` defines `SpectrumRecord` and `StepMeasurement`;
- `DialogFrame`, `usePrompt` (trimmed text, Save disabled while blank) and `useToast` exist;
- the end-to-end suite already starts Chromium with a fake camera in its own file (`camera.spec.ts`).

The requirements are `openspec/specs/tap-tone-capture/spec.md` with this change's delta, and Step Measurement Capture in `openspec/specs/build-sequence/spec.md`. The legacy audit (`docs/rewrite/legacy-findings/tap-tone-capture.md`) lists the defects not to repeat:
- the live waveform never drew;
- cents were floored instead of rounded;
- the WAV scaling had a precedence bug;
- the blob was always labelled WebM;
- files were decoded at the device rate;
- the reopen path threw when there were no peaks;
- playback and analysis outlived the dialog;
- audio contexts were never closed;
- the client-built record was stored unchecked;
- a dozen strings were hard-coded in English.

Two checks were run before writing this design:
- **The pipeline on a synthetic signal.** Two decaying taps at 181.640625 Hz and 93.75 Hz plus 15 Hz rumble, 2 s at 48 kHz, went through a throwaway script implementing the spec's pipeline. It gave 331 points, peaks at exactly 181.641 Hz (−27.5 dB) and 93.750 Hz, a full-scale sine reading 0.5400, and a high-pass response of −10.9 dB at 15 Hz and +0.14 dB at 180 Hz. Ten 16384-point frames took 36 ms in Node.
- **Chromium's fake microphone** (`--use-file-for-fake-audio-capture`). It plays a WAV file as the microphone. `MediaRecorder` supports `audio/webm;codecs=pcm`, and the recording decodes at 48 kHz. Chromium returned 2 identical channels although 1 was requested, which the spec already allows for: the first channel is analyzed, and every channel is filtered and exported.

## Goals / Non-Goals

**Goals:**
- Every `tap-tone-capture` requirement, with the dialog usable by any caller through one small interface.
- Every number of the spec reproduced by unit tests in `@gb/dsp`: bins, levels, thresholds, note labels and WAV bytes.
- Step Measurement Capture on build steps.
- The spectrum record checked on the server, with one shared function.

**Non-Goals:**
- No wood calculator wiring; `wood-panel-calculator` adds the three detect buttons.
- No build analyzer: the FFT and windows are written for reuse, but the analyzer's dBFS scale, interpolation and damping belong to `build-acoustic-analysis`.
- No calibration, onset trigger, sub-bin interpolation or free-frequency selection (owner decisions of 2026-11-01).
- No audio leaves the browser: no upload and no storage.

## Decisions

### 1. `@gb/dsp` modules

Pure functions on `Float64Array`/`Float32Array` and plain objects, with no DOM, Web Audio or Node APIs, each with unit tests:

| Module | Contents |
|---|---|
| `fft.ts` | In-place iterative radix-2 complex FFT, with bit-reversal and twiddle tables cached per size. `realMagnitudes(frame, window, scale)` returns the single-sided magnitudes for k = 0..N/2−1 |
| `windows.ts` | `hamming(N)`, `w[n] = 0.54 − 0.46·cos(2πn/(N−1))`, cached per N. The analyzer adds its other windows here later |
| `biquad.ts` | `highPass(fs, fc, q)`: Audio EQ Cookbook coefficients with `α = sin(ω0)/(2Q)`. `filter(signal, coeffs)` runs a direct form I in double precision from a zero state and keeps the length |
| `tapTone/constants.ts` | Every fixed value of Fixed Analysis Parameters, named once |
| `tapTone/spectrum.ts` | Framing, silence gate, averaging, the −80 dB and all-silent fallbacks, and the 30–1000 Hz output points |
| `tapTone/peaks.ts` | Candidate tests, ranking, the 35 dB and top-10 limits, the 132–138 Hz exclusion, and `nearestPeak` for reopening |
| `tapTone/note.ts` | The note label, with the name, octave and rounded cents of the spec |
| `tapTone/record.ts` | Building a record from output points, and output points from a record |
| `wav.ts` | `encodeWav(channels, sampleRate)` returning a `Uint8Array`, and `wavFileName(date)` |

**The FFT is written once here.** The legacy app had two transforms, and the analyzer will use this one.
- Alternative considered: a library such as `fft.js` (MIT). Rejected because the radix-2 transform is about 40 lines, it is fully testable against a direct DFT, and the package stays dependency-free.

**The filter is computed in TypeScript, not by Web Audio's `BiquadFilterNode`.**
- The spec's Q of 10^(1/20) is what Web Audio's highpass node derives from its Q setting of 1 dB. Computing the filter ourselves makes the result identical in every browser, and testable in Node.
- Alternative considered: `OfflineAudioContext` with a `BiquadFilterNode`. Rejected because the result cannot be unit-tested and depends on the browser's implementation.

### 2. One analysis entry point, run in steps

`analyzeTapTone(channels, sampleRate, { mobile })` returns `{ points, peaks, record }`:
- `points`: the output points, each with frequency, magnitude and dB;
- `peaks`: the selectable peaks, loudest first, after the exclusion;
- `record`: the Tap-Tone Spectrum Record, which holds exactly the output points, since all of them are at most 2000 Hz.

**The work is a generator.** It yields after each batch of 16 frames.
- Tests and the reopen path drive it to completion synchronously.
- The dialog drives it with a `setTimeout(0)` between batches. A long file therefore keeps the page responsive, Cancel works during "Analyzing..." (delta scenario), and a cancelled run is simply not resumed.
- Alternative considered: a Web Worker. Rejected for now: a 5 s recording takes about 50 ms, and a worker adds a bundling path that the build and end-to-end setup don't exercise yet. If long files ever need it, the generator moves into a worker unchanged.

**Edge cases the spec leaves to the implementation:**
- **Not enough audio.** A signal with fewer than 2 samples, or one that yields no output point (N below 64, under 1.4 ms), counts as audio that "cannot be analyzed", which gives "Error processing audio. Please try again."
- **The quiet fallback measures the average over the whole spectrum,** as the spec says ("max over all k"). The legacy finding that it ignores the 30–1000 Hz range is noted, but the spec is followed.

**Reopening:**
- `peaksFromRecord(record)` rebuilds the points from the record's lists and re-runs the candidate tests and limits, without the mobile exclusion.
- `nearestPeak(peaks, value)` picks the peak with the smallest |f − value|; ties go to the louder peak.
- With no peaks it returns nothing, so the results state shows the graph with "—" (No Peak Found). The legacy reopen path threw here.

### 3. Audio in the browser (`apps/web/src/components/tap-tone/audio.ts`)

**Decoding:**
- Recordings and files are decoded with `new OfflineAudioContext(1, 1, 48000).decodeAudioData(bytes)`. Web Audio resamples to the context's rate, which gives the spec's 48,000 Hz for files from any device.
- **Recordings:** the blob carries the `mimeType` that `MediaRecorder` actually chose. The channels are kept as decoded.
- **Files:** the channels are averaged into one (Loading an Audio File).
- Every channel is then high-pass filtered in `@gb/dsp`. The first channel is analyzed, and all of them are played and exported (High-Pass Pre-Filter).

**Capture:**
- `getUserMedia({ audio: { deviceId: { exact }, channelCount: 1, sampleRate: 48000, echoCancellation: false, noiseSuppression: false, autoGainControl: false } })`. The device id is omitted when no device is listed.
- `MediaRecorder` uses the first supported type of the spec's list, with `start(100)` for 100 ms chunks.
- A 100 ms interval updates the counter and stops at 5.0 s.
- An `AnalyserNode` (`fftSize` 2048) feeds the oscilloscope through `getFloatTimeDomainData` in a `requestAnimationFrame` loop. The loop starts when the recording state is entered, which fixes the legacy loop that never ran.
- The stream's tracks are stopped as soon as the recording stops or is cancelled.

**Mobile detection:** `/android|mobile|tablet/i` on `navigator.userAgent`, or `navigator.maxTouchPoints > 0`, or `'ontouchstart' in window`. It is computed once per analysis and passed to `@gb/dsp` as a flag.

**Playback:**
- One `AudioContext`, created on the first Play and closed when the dialog closes.
- `AudioBufferSourceNode.onended` turns Stop back into Play.
- Re-record, Cancel, close and unmount stop playback.

**Export:**
- `encodeWav` bytes in a `Blob`, downloaded through a temporary object URL.
- The name comes from `wavFileName(new Date())`: `wood-frequency-analysis-<UTC ISO date-time with ":" as "-" and no fraction>.wav`, as the spec states for every caller.

### 4. The dialog: a reducer plus thin hooks

**State machine:** `apps/web/src/lib/tap-tone/machine.ts` is a pure reducer, unit-tested.
- States: `idle`, `recording`, `analyzing`, `results`.
- Results carry the points, peaks, selected index and the audio, or `null` audio for a saved record.
- An error message key is shown in the banner. Starting a recording or a file load clears it.

**Every effect lives in a hook:**
- `useAudioInputs()`:
  - `enumerateDevices()` on open, which never prompts for permission;
  - a `devicechange` listener;
  - a fresh enumeration after permission is granted;
  - "Microphone <n>" for devices without a label;
  - the chosen device kept in a module-level variable, so it lasts while the page stays open.
- `useRecorder()`: decision 3.
- `usePlayback()`: decision 3.

**Interface for callers:**

```ts
<TapToneDialog
  open label currentValue? savedRecord?
  onConfirm={(frequency: number, record: SpectrumRecord) => void}
  onCancel={() => void} />
```

- `label` is already translated by the caller.
- `onConfirm` receives the unrounded peak frequency.
- The dialog uses `DialogFrame` with outside clicks disabled, as Opening the Capture Dialog requires.
- Each open is a fresh mount (a `key` per opening), so the dialog never carries state from an earlier opening.

### 5. The spectrum graph

`TapToneSpectrum` is an SVG in the style of the existing `SpectrumGraph`:
- linear 30–1000 Hz across and −100 to −20 dB up, with the spec's grid labels;
- an amber trace through all points, with levels clamped to the edges;
- the peak markers.

**Marker styles:**
- the selected peak: solid line, larger dot, bold label;
- the other peaks: dashed line and small dot;
- the strongest peak: amber when not selected;
- the snap target: an extra ring.

**Pointer handling:**
- The pointer's x maps linearly to 30–1000 Hz, clamped.
- Within 20 Hz of a peak, that peak is the snap target. Otherwise a cursor line is drawn with "<f> Hz".
- A click selects the snap target, or else the nearest peak.
- Pointer events cover mouse, pen and touch, so phones get tap-to-select.

**Keyboard:**
- The graph itself is not focusable.
- With more than one peak, the Detected Peaks buttons are the keyboard path.
- With one peak, it is already selected.
- The graph has `role="img"` and a label naming the peaks.

**Oscilloscope:** a `<canvas>` drawn with colors read from the CSS tokens (`getComputedStyle`), so there is no raw hex value in app code and both themes work.

### 6. "Add Analysis" on build steps

In `StepMeasurements`, owners (`canEdit`) get an "Add Analysis" button above the list, also when the list is empty.

The flow:
1. The dialog opens with `label = t('tapTone.stepLabel', { step })`.
2. `onConfirm` runs `prompt({ title: 'Description', initialValue: 'Resonance Analysis' })`.
3. Cancelling discards the capture.
4. Saving calls `store.change(stepKey, { op: 'add_measurement', measurement: { id: crypto.randomUUID(), timestamp: Date.now(), description, frequency, spectrum: record } })`.

Failures use the store's existing revert and "Failed to save changes" (Step Save Failures).

The spectrum shown in the list is the existing 20–2000 Hz `SpectrumGraph`, which the build-sequence spec defines separately from the dialog's 30–1000 Hz graph.

### 7. Server-side record validation

`public.spectrum_record_is_valid(p jsonb) returns boolean` is `immutable`, `language sql` and `set search_path = ''`, with execute granted to `authenticated` and `service_role`. It applies the shape rules of the delta's Spectrum Record Validation:
- the six fields, with numeric types;
- 1–1024 points, with equal lengths;
- strictly ascending frequencies in (0, 2000];
- magnitudes ≥ 0;
- `sampleRate > 0`;
- `fftSize` a power of two ≤ 16384;
- `abs(binWidth − sampleRate/fftSize) ≤ 1e-9 · binWidth`.

**Where it is used:**
- A new migration replaces the spectrum branch of `update_build_step` (`create or replace`, same signature and grants) with a call to this function. The function still raises `Invalid spectrum` (22023).
- `wood-panel-calculator` uses it in a check constraint on its spectra column.

**The limits:**
- 1024 points leaves room for every record the app or the legacy data can produce: 682 points up to 2000 Hz at 48 kHz, 743 at 44.1 kHz.
- One record stays under about 60 KB.
- Spacing between frequencies is not checked. Ascending order is all the graph and peak detection need, and imported legacy records keep their exact values.

**Alternatives considered:**
- A JSON Schema extension: not available in Supabase's Postgres.
- A check in the app only: the specs require the server to enforce it.

### 8. UI additions in `@gb/ui`

- **`Tooltip`** on `@radix-ui/react-tooltip`. It opens on hover and on keyboard focus of its trigger. A tap on the trigger toggles it, because touch devices have no hover. Used for Help Instructions.
- **`SelectField`**: a native `<select>` in the `Field` frame, accessible and native on phones. Used for the device selector.

The pinned version is the newest release at least two weeks old, the same rule as earlier changes.

### 9. Text and formats

- Every string lives under `tapTone.*` in `en.json` and `fr.json`, including "or", "(highest)", "Microphone {n}", the five help lines, all error messages and "Analysis for {step}". The key-parity test covers them. The wood calculator's three field labels belong to its own `wood.*` keys.
- Hz and dB values use the existing `decimal1` format.
- The note label is built in `@gb/dsp` and is the same in both languages: note names stay as written in the spec.
- "Current Value" uses a `decimal2` format.

### 10. Tests

**Unit tests in `@gb/dsp`:**
- FFT against a direct DFT on random input;
- the Hamming coherent gain of 0.54;
- the high-pass response at 15, 30 and 180 Hz, and preserved length;
- frame layout for L below and above 16384;
- the silence gate and both fallbacks;
- 331 points from 32.2265625 to 999.0234375 Hz;
- candidate rules, ripple rejection, the 35 dB cut, the top 10 and the mobile exclusion;
- note labels, including "F#3 −32 c" and rounding to the nearest cent;
- WAV header bytes, the negative-sample scaling and the file name;
- record round-trips;
- the synthetic two-tap signal of the Context check.

**Unit tests in the app:**
- the reducer: every transition, errors clearing, and a cancelled analysis being discarded;
- the dialog with mocked `navigator.mediaDevices`, `MediaRecorder` and `AudioContext`:
  - opening calls only `enumerateDevices`;
  - the capture constraints;
  - "Microphone 1" and "Microphone 2" before permission;
  - unsupported, corrupt and stereo files;
  - the results panels for a known record;
  - reopening with and without a current value;
  - Confirm disabled with no peak.

**pgTAP:** `10_spectrum_records.test.sql`:
- a valid 331-point record;
- each shape rule refused;
- `update_build_step` refusing an oversized record and keeping the earlier measurements.

**End-to-end tests:**
- **Fixture:** `apps/web/e2e/fixtures/taps.wav` is generated by a script that uses `encodeWav`: two decaying taps at bin 62 (181.640625 Hz) and bin 32 (93.75 Hz), plus 15 Hz rumble. A second fixture adds a tone at bin 46 (134.765625 Hz) for the mobile exclusion.
- **`tap-tone.spec.ts`** runs in its own browser with `--use-file-for-fake-audio-capture`. It records on a build step, checks "181.6 Hz", "F#3 −32 c" and the Detected Peaks list, selects 93.8 Hz, confirms, saves a description and finds "Peak: 93.8 Hz" in the list.
- **File upload:** the same assertions through Upload Audio File; an unsupported `.flac` file; Re-record; cancel.
- **Phone project:** the 134.8 Hz tone is excluded on the phone and offered on the desktop.
- **French:** the French dialog title.
- **Fake Supabase server:** its `update_build_step` already applies `add_measurement`. It gains the record checks, so a refused record shows the save-failure message.

## Risks / Trade-offs

- **[Chromium's fake microphone in CI]** Confirmed working locally. If a CI runner behaves differently, the recording test is tagged and can be skipped there, and the file-upload tests still cover the whole analysis path.
- **[Browsers that ignore the 48 kHz request]** The recording is decoded into a 48 kHz context, so analysis is at 48 kHz whatever the device delivers. Results only differ in the device's own anti-aliasing, which is far above 1000 Hz.
- **[Touchscreen laptops count as mobile]** The spec keeps this rule (a legacy finding asked about it). A genuine resonance between 132 and 138 Hz disappears on such laptops. If the owner narrows the rule to Android, only the detection function changes.
- **[Long files block nothing but take time]** There is no length limit, as specified. The generator keeps the page responsive; a one-hour file still takes many seconds. A size guard can be added if it becomes a problem.
- **[Record validation versus legacy data]** The import writes as `service_role` without going through the function. Panel spectra will meet the check constraint, and legacy records fit its limits (743 points at most).

## Migration Plan

**Deploy:**
- One additive migration: the new function and the redefinition of `update_build_step`, with the same signature and grants.
- No environment variables are added.

**Rollback:**
- Redeploy the previous app build.
- The previous `update_build_step` body can be restored by re-running its definition from `20261102120000_builds_and_steps.sql`. Stored data is unaffected.

## Open Questions

None that change the approach. The owner's tap-tone questions remain as decided on 2026-11-01:
- no calibration;
- no sub-bin peaks;
- selection limited to detected peaks;
- the mobile rule as specified.
