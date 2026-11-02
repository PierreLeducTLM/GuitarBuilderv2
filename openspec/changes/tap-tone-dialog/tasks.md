# Tasks

## 1. Signal processing (`packages/dsp`)

- [ ] 1.1 Implement `fft.ts` (iterative radix-2 FFT with cached tables, `realMagnitudes`) and `windows.ts` (`hamming`). Verify unit tests: the FFT matches a direct DFT on random input of sizes 8 to 4096, and a full-scale sine at an exact bin reads 0.54 with the Hamming window and 2/N scaling
- [ ] 1.2 Implement `biquad.ts` (cookbook high-pass coefficients and the direct form I filter). Verify unit tests:
  - the response is −10.9 dB at 15 Hz, +1.0 dB at 30 Hz and within 0.2 dB at 180 Hz for fc 30 Hz, Q 10^(1/20), fs 48 kHz;
  - the length is kept;
  - 15 Hz rumble mixed with a 180 Hz tone loses its 15 Hz component
- [ ] 1.3 Implement `tapTone/constants.ts` and `tapTone/spectrum.ts`: framing, silence gate, averaging, the −80 dB and all-silent fallbacks, the 30–1000 Hz points, and the "cannot be analyzed" result for fewer than 2 samples or no output point. Verify unit tests:
  - N, H and M for L = 10,000 and 96,000;
  - silent frames excluded;
  - each fallback;
  - 331 points from 32.2265625 to 999.0234375 Hz at 48 kHz with N = 16384
- [ ] 1.4 Implement `tapTone/peaks.ts` (candidates, ranking, the 35 dB and top-10 limits, the 132–138 Hz exclusion, `peaksFromRecord`, `nearestPeak`) and `tapTone/note.ts`. Verify unit tests:
  - Ripple rejected;
  - first and last points never peaks;
  - the −22 dB / −57 dB threshold;
  - 14 candidates cut to 10;
  - the Android and desktop scenarios;
  - nearest-peak ties;
  - "F#3 −32 c" for 181.640625 Hz;
  - −0.2 c showing "+0 c"
- [ ] 1.5 Implement the `analyzeTapTone` generator and its synchronous runner, `tapTone/record.ts`, and `wav.ts` (`encodeWav`, `wavFileName`). Verify unit tests:
  - the synthetic two-tap signal gives peaks 181.640625 Hz then 93.75 Hz and a 331-point record;
  - driving the generator in batches gives the same result as the runner;
  - WAV header bytes and data size for 96,000 mono samples;
  - −0.25 stored as −8192;
  - the name "wood-frequency-analysis-2026-03-14T15-09-26.wav"

## 2. Database

- [ ] 2.1 Add a migration with `public.spectrum_record_is_valid(jsonb)` (decision 7), and redefine `update_build_step` so its spectrum check calls it. Write `supabase/tests/database/10_spectrum_records.test.sql`:
  - the 331-point record is valid;
  - each shape rule is refused (unequal lengths, 0 and 1025 points, unsorted or out-of-range frequencies, a negative magnitude, fftSize 3 and 32768, a wrong binWidth, a non-numeric entry);
  - an oversized `add_measurement` raises 22023 and leaves the step's measurements unchanged;
  - the function's settings and grants.

  Verify with `supabase test db` (CLI 2.122.0) and `pnpm test:db` where pgTAP is installed
- [ ] 2.2 Add the function's signature to `packages/db/src/database.types.ts`. Verify `pnpm --filter @gb/db test` and `pnpm typecheck` pass

## 3. UI components (`packages/ui`)

- [ ] 3.1 Add `@radix-ui/react-tooltip`, pinned exactly to the newest release at least two weeks old, and build `Tooltip` (hover, focus, tap to toggle) and `SelectField` (native select in `Field`). Verify component tests: the tooltip opens on hover, on focus and on tap; the select has its label and keeps the chosen value

## 4. The dialog

- [ ] 4.1 Write the reducer in `apps/web/src/lib/tap-tone/machine.ts`. Verify unit tests for:
  - every transition of decision 4;
  - the banner cleared by a new recording or file load;
  - Confirm enabled only in results with a selection;
  - a result arriving after cancel being ignored
- [ ] 4.2 Implement `audio.ts` (decoding into a 48 kHz context, file type recognition, channel averaging for files, filtering every channel, mobile detection, WAV download) and the `useAudioInputs`, `useRecorder` and `usePlayback` hooks. Verify component tests with mocked media APIs:
  - opening calls only `enumerateDevices`;
  - the exact `getUserMedia` constraints;
  - the `MediaRecorder` type order and 100 ms chunks;
  - "Microphone 1/2" before permission and real names after it;
  - a `devicechange` adding a device;
  - the stop at 5.0 s;
  - the microphone released on stop and on cancel;
  - playback stopped on re-record and close, and the audio context closed
- [ ] 4.3 Build `TapToneSpectrum` (axes, grid labels, clamped trace, marker styles, hover readout, 20 Hz snap, click selection, pointer events) and `Oscilloscope` (canvas, last 2048 samples, dashed center line, token colors). Verify component tests:
  - the grid labels;
  - pointer at 175 Hz snapping to 181.6 Hz with no cursor line;
  - pointer at 600 Hz showing "600.0 Hz";
  - a click at 300 Hz selecting 410.2 Hz;
  - a clamped point drawn at the edge
- [ ] 4.4 Assemble `TapToneDialog`:
  - title with the help tooltip and label;
  - idle contents;
  - recording progress "2.3s / 5s";
  - "Analyzing...";
  - results with the Detected Peaks list (first 5, "(highest)"), the Detected Frequency and Current Value panels, Play / Download Audio only for session audio, Re-record, Confirm and Cancel;
  - reopening from a saved record;
  - the error banner messages;
  - every string under `tapTone.*` in `en.json` and `fr.json`.

  Verify component tests:
  - "Compare with the existing value" (180.00 Hz, 181.6, −24.3 dB, F#3 −32 c);
  - No Peak Found with Confirm disabled;
  - a single peak with no list;
  - the unsupported-file and decode-failure messages;
  - reopening preselecting the peak nearest 92.8;
  - the French title "Détecteur de fréquence"

## 5. "Add Analysis" on build steps

- [ ] 5.1 Add "Add Analysis" to `StepMeasurements` for owners: the dialog labelled "Analysis for <step label>", the "Description" prompt pre-filled with "Resonance Analysis", and `add_measurement` with a new id, the current time, the unrounded frequency and the record; nothing is attached on cancel. Teach `apps/web/e2e/fake-supabase.ts` the record checks of decision 7. Verify that the existing step-dialog end-to-end tests still pass and that the administrator's read-only view has no "Add Analysis"

## 6. End-to-end tests

- [ ] 6.1 Add the fixture generator script and the two WAV fixtures (two taps with 15 Hz rumble; the same plus a 134.765625 Hz tone). Verify that the script regenerates byte-identical files, and that `analyzeTapTone` on each fixture gives the expected peaks in a unit test
- [ ] 6.2 Write `apps/web/e2e/tap-tone.spec.ts` with a browser using the fake microphone fixture:
  - record on a build step, see "181.6 Hz (highest)" and "F#3 −32 c", select 93.8 Hz, confirm, save "Back plate free" and see "Peak: 93.8 Hz" after a reload;
  - cancel the description and see nothing attached;
  - the same through Upload Audio File;
  - a `.flac` file refused;
  - Re-record returning to idle;
  - Cancel while recording;
  - Download Audio producing a `.wav` with the expected name pattern;
  - the phone project excluding 134.8 Hz while the desktop offers it;
  - the French dialog;
  - a refused oversized record showing "Failed to save changes".

  Verify `pnpm test:e2e` passes on both projects

## 7. Documentation and integration

- [ ] 7.1 Note in the root `README.md` that the end-to-end suite uses Chromium's fake microphone with a generated fixture, and how to regenerate it. Verify the documented command runs as written
- [ ] 7.2 Run `pnpm check`, `pnpm build`, the database tests (`supabase test db`, and `pnpm test:db` where pgTAP is installed), `pnpm test:e2e` and `openspec validate --strict`. Verify all pass

## Workflow follow-up

- Try the dialog with a real microphone and a real tap on desktop and on a phone; the fake microphone does not exercise browser audio processing or device quirks.
- `wood-panel-calculator` builds on this change; apply it after this one is merged.
- Archive with `/opsx:archive` once reviewed.
