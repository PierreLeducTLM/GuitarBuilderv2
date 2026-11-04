# Tasks

Clean-room rule for every task: never open, paste or paraphrase the Resonance Reader's source code. Use only this change's specs and design and general signal-processing literature.

## 1. Signal processing foundations (`packages/dsp`)

- [x] 1.1 Implement `fft.ts` (iterative radix-2 FFT with cached tables, inverse, `realSpectrum`) and `windows.ts` (`hann` with its sum). Verify unit tests:
  - the FFT matches a direct DFT on random input of sizes 8 to 4096;
  - the inverse returns the input within 1e-12;
  - a full-scale 375 Hz sine in a 32768-point Hann window reads 1.0 within 0.001 at bin 256
- [x] 1.2 Implement `biquad.ts` (cookbook high-pass, direct form I). Verify unit tests:
  - −10.9 dB at 15 Hz, +1.0 dB at 30 Hz and within 0.2 dB at 180 Hz for fc 30 Hz, Q 10^(1/20), fs 48 kHz;
  - the length is kept;
  - 15 Hz rumble is removed from a 180 Hz tone
- [x] 1.3 Implement `tapTone/constants.ts` and `tapTone/taps.ts` (block RMS, noise floor, onsets, debounce, the 50-tap cap, rejection reasons). Verify unit tests:
  - the three-tap scenario gives onsets 24000, 76800 and 132000;
  - a double hit 40 ms apart counts once;
  - silence gives no onset;
  - a sample at 0.999 in the first 50 ms rejects as "Clipped";
  - onsets 400 ms apart reject the first as "Too close to another tap";
  - a tap 200 ms before the end rejects as "Cut off by the end of the recording"
- [x] 1.4 Implement `tapTone/spectrum.ts` (per-tap spectra with cached A_t², the power average over a used-tap set, the 30–1000 Hz points). Verify unit tests:
  - 662 points from 30.76171875 to 999.0234375 Hz;
  - the power average of two known taps;
  - re-averaging after excluding a tap equals a fresh average of the remaining taps, with no extra FFT

## 2. Peaks, Q and roles (`packages/dsp`)

- [x] 2.1 Implement `tapTone/peaks.ts`: candidates with the 30 Hz prominence neighbourhood, parabolic refinement, ranking, the 35 dB and top-10 limits, the mobile exclusion and `nearestPeak`. Verify unit tests:
  - the worked example (d = 0.125, 181.82373046875 Hz, −19.875 dB) and the clamp at ±0.5;
  - damped tones at 93.1, 181.73, 182.3 and 250.7 Hz (τ 0.05–0.4 s) refined within 0.2 Hz;
  - ripple rejected;
  - first and last points never peaks;
  - −22/−57 dB;
  - 14 candidates cut to 10;
  - the Android and desktop scenarios;
  - a 16384-point legacy record uses 10 points per side
- [x] 2.2 Implement `tapTone/bandwidthQ.ts`. Verify unit tests:
  - the 195/205 Hz example gives Q = 20;
  - a single damped tone gives a spectral Q within 20% of π·f·τ for τ from 10 to 100 ms, and is capped below it for long decays (the tap window's resolution; decay Q covers those);
  - no crossing within 50 Hz gives none;
  - BW below 0.1 Hz gives none
- [x] 2.3 Implement `tapTone/body.ts` (candidates, assignment, reliability, `reattachManualRoles`). Verify unit tests for every scenario of the delta:
  - typical body;
  - 110/150/212/262 Hz;
  - weak peak;
  - free plate;
  - split peak;
  - Top without spectral Q;
  - a manual role kept within 3 Hz and cleared beyond it
- [x] 2.4 Implement `tapTone/note.ts`, `tapTone/record.ts` and `wav.ts`. Verify unit tests:
  - "F#3 −30 c" for 181.82 Hz and "F#3 −32 c" for 181.640625 Hz;
  - −0.2 c shows "+0 c";
  - record round-trips for 662-point and 331-point records;
  - WAV header bytes, −0.25 stored as −8192, and the file name pattern

## 3. Decay Q (`packages/dsp/src/tapTone/decay/`, clean-room)

- [ ] 3.1 Implement the tap segment, the isolation band (relevant neighbours, d_min, T_h, the 7 Hz limit, the bandwidth pre-check) and the isolation chain (demodulation, the 4×48 smoother decimating to 1000 Hz, the Blackman kernel, the envelope). Verify unit tests T1c, T3, T3b, T3c, T13, T14 and T15 of design decision 3, and the segment example (71520 samples)
- [ ] 3.2 Implement the quiet stretches, the noise floor and the tap-tail fallback. Verify unit tests T16, T11, T11b and T11c, and the 0.79 s quiet-stretch example
- [ ] 3.3 Implement the fit interval, the dB line fit, the half-slope ratio and the ordered quality checks with their reason codes. Verify unit tests T1, T1b, T2, T2b, T2c, T4, T4b, T5, T6, T6b, T7 and T12
- [ ] 3.4 Implement combining across taps (at least 3 valid, median, MAD/median ≤ 0.15, the most frequent reason with its tie order) and the inspector series (400 min/max buckets, the strided envelope, the fit curve, the markers). Verify unit tests T8, T9, T10, T10b and T17. Add T18 (200-seed Monte Carlo) as a nightly test that does not run in `pnpm check`
- [ ] 3.5 Implement the `analyzeTake` generator and `recompute`, with decay Q computed lazily and memoized per (tap, peak). Verify unit tests:
  - the generator and its synchronous runner give the same result;
  - `taps.wav`-like input gives the expected taps and peaks;
  - toggling a tap reruns only averaging, peaks and roles;
  - a second request for the same decay Q is served from memory

## 4. Database

- [x] 4.1 Add a migration with `public.spectrum_record_is_valid(jsonb)` and `public.measurement_roles_are_valid(jsonb)`, and redefine `update_build_step` so that `add_measurement` calls both and copies `roles` field by field. Write `supabase/tests/database/10_spectrum_records.test.sql`:
  - 662-point and 331-point records valid;
  - each shape rule refused (unequal lengths, 0 and 1025 points, unsorted or out-of-range frequencies, a negative magnitude, fftSize 3 and 65536, a wrong binWidth, a non-numeric entry);
  - valid roles, and roles with "side", frequency 1500, spectralQ 0, origin "guess" or an extra key refused;
  - a refused change leaves the step unchanged;
  - function settings and grants.

  Verify with `supabase test db` (and `pnpm test:db` where pgTAP is installed)
- [x] 4.2 Add `BodyRole`, `MeasurementRoles` and `StepMeasurement.roles` to `packages/db/src/steps.ts`, and the function signatures to `database.types.ts`. Verify `pnpm --filter @gb/db test` and `pnpm typecheck` pass

## 5. UI kit (`packages/ui`)

- [x] 5.1 Add `@radix-ui/react-tooltip` pinned exactly (newest release at least two weeks old), and build `Tooltip` (hover, focus, tap toggles) and `SelectField`. Verify component tests: the tooltip opens on hover, on focus and on tap; the select keeps its label and value

## 6. The dialog (`apps/web`)

- [ ] 6.1 Write the reducer in `src/lib/tap-tone/machine.ts` (dialog with takes, per-take states, run ids, used taps, selection, manual roles). Verify unit tests:
  - every transition per take;
  - switching takes disabled while recording;
  - late results from a cancelled or superseded run ignored;
  - a Re-record clears only its own take;
  - Confirm enabled only when the mode has something to return
- [ ] 6.2 Implement `audio.ts` and the `useAudioInputs`, `useRecorder`, `usePlayback` and `useTakeAnalysis` hooks. Verify component tests with mocked media APIs:
  - opening calls only `enumerateDevices`;
  - the exact `getUserMedia` constraints;
  - the `MediaRecorder` type order with 100 ms chunks;
  - "Microphone 1/2" before permission;
  - `devicechange`;
  - the stop at 10.0 s;
  - the microphone released on stop and cancel;
  - the audio context closed
- [x] 6.3 Build the waveform with tap markers (used, excluded, rejected; toggling; reasons; keyboard). Verify component tests:
  - "2 of 3 taps used" after excluding tap 2;
  - a rejected tap shows "Clipped" and cannot be included;
  - Space on a focused marker toggles it, with the announcement
- [x] 6.4 Build the spectrum graph (−100..0 dB, markers, hover, snap, click) with draggable role labels, and the oscilloscope. Verify component tests:
  - grid labels;
  - 175 Hz snapping to 181.8 Hz;
  - a click at 300 Hz selecting the nearest peak;
  - dragging "Top" onto 204.6 Hz assigns it;
  - dropping it away from any peak returns it
- [ ] 6.5 Build the panels: Detected Frequency with spectral and decay Q and their reasons, Current Value, the roles panel (Move, Clear, "set by you", "Not identified") and the peak inspector (ring-down, envelope, fit, interval, per-tap Q, median). Verify component tests:
  - "Compare with the existing value";
  - "Saved spectrum has no decay Q";
  - the keyboard Move path;
  - the inspector shows the reason when decay Q is not determinable
- [ ] 6.6 Assemble `TapToneDialog` for both modes:
  - title, help tooltip and plate guidance;
  - the take selector;
  - idle, recording ("2.3s / 10s"), analyzing and results;
  - "None of the taps can be used";
  - reopening Plate takes from saved records;
  - Play, Download Audio, Re-record, Confirm and Cancel;
  - the result shapes of design decision 6;
  - every string under `tapTone.*` in `en.json` and `fr.json`.

  Verify component tests:
  - the Plate Confirm result with two of three takes;
  - the Instrument result with roles;
  - the French title and role names;
  - the key-parity test

## 7. Build steps and end-to-end

- [ ] 7.1 Add "Add Analysis" (Instrument mode) to `StepMeasurements` for owners: the description prompt, then `add_measurement` with roles when present. Add the roles line to the list, and the −100..0 dB axis to `SpectrumGraph`. Teach `apps/web/e2e/fake-supabase.ts` the record and role checks. Verify:
  - the existing step-dialog tests still pass;
  - a legacy measurement shows no roles line;
  - the administrator's read-only view has no "Add Analysis"
- [ ] 7.2 Add the fixture generator script and the three WAV fixtures (`taps.wav`, `body.wav`, `clipped.wav`). Measure `analyzeTake` plus decay Q on a 10 s, 8-tap recording in a mobile-emulated Chromium, against the 1 s budget of design decision 2. Verify:
  - the script regenerates byte-identical files;
  - a unit test gives the expected taps, peaks and roles for each fixture;
  - the measured time is recorded in the PR (if it misses the budget, move the generator into a module worker before continuing)
- [ ] 7.3 Write `apps/web/e2e/tap-tone.spec.ts`:
  - record `body.wav` through the fake microphone on a build step; see Air, Top and Back; drag Top; confirm; save "Box closed"; reload; see the roles line;
  - upload `taps.wav` and `clipped.wav` ("Clipped", "2 of 3 taps used");
  - a `.flac` refused;
  - recording silence gives "No tap detected";
  - cancel during recording;
  - the phone project's mobile exclusion;
  - the French dialog;
  - a refused record showing "Failed to save changes".

  Verify `pnpm test:e2e` passes on both projects

## 8. Documentation and integration

- [ ] 8.1 Update `docs/rewrite/README.md` (the sub-bin decision reversed on 2026-11-04, the tap-tone open questions answered) and `docs/rewrite/legacy-findings/tap-tone-capture.md`. In the root `README.md`, note the fake-microphone fixtures and how to regenerate them. Verify the documented command runs as written
- [ ] 8.2 Run `pnpm check`, `pnpm build`, the database tests, `pnpm test:e2e` and `openspec validate --strict`. Verify all pass

## Workflow follow-up

- Try both modes with a real microphone on a real plate and a real guitar, on desktop and on a phone.
- Optionally compare the three fixtures against the public Resonance Reader page as a black box, and note any large differences.
- Update `wood-panel-calculator` to open Plate mode (one "Measure plate" action, results per field). Then propose `retire-build-analyzer`.
- Archive with `/opsx:archive` once reviewed.
