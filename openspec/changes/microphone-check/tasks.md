# Tasks

Production code is test-driven: write a failing test first, make it pass with the minimum code, then run mutation testing on the changed `@gb/dsp` modules. The device test is already done (design.md, "Device test results"), so no throwaway diagnostics are needed.

## 1. Rate judge (`packages/dsp`)

- [x] 1.1 Add `judgeRate` with the frame-count rules (design D1). Verify unit tests for the spec's worked examples:
  - 220,500 frames in 5.0 s at 48 kHz is Corrected to 44,100 Hz, with r = 0.91875 and +147 cents;
  - 240,000 frames is Accurate;
  - 245,000 delivered with 5,000 dropped is Mismatch, reason "dropped";
  - 210,000 frames (42,000 Hz) is Mismatch, reason "rate".

  Notes: the limits compare in Hz (|R - fs| <= 0.03 * fs, |R - S| <= 0.01 * S), the same formulas as the spec, because the ratio form misjudges the exact boundaries in floating point (|46560/48000 - 1| reads 0.030000000000000027). Stryker: 43 killed, 1 survivor, which is equivalent: the nearest-rate tie-break (`<` vs `<=`) only matters halfway between two standard rates, which is always a Mismatch that exposes no rate.
- [x] 1.2 Add the decoded-length fallback. Verify unit tests:
  - E 6.0 s and D 5.51 s is Corrected to 44,100 Hz (R = 44,080 Hz);
  - E 1.0 s and D 0.85 s is Accurate thanks to the 0.2 s floor;
  - E 5.0 s and D 4.95 s is Accurate.

  Notes: Stryker 62 killed; the only survivor is the equivalent tie-break noted in 1.1.
- [x] 1.3 Add `measureLevel` (noise floor and peak in dBFS, with the No tap heard / Clipping / Low / Good verdicts) and `measureTone` (centre 32768 samples, strongest refined point from 220 to 880 Hz, cents from 440 Hz, not heard below −60 dB). Verify unit tests with synthetic signals:
  - a full-scale tap gives Clipping, a 0.03 peak gives Low, silence gives No tap heard;
  - a 440.2 Hz sine reads +1 cent, a 478.9 Hz sine reads about +147 cents, and a −70 dB sine is not heard.

  Notes: `taps.ts` now exports `noiseFloor`, so the level check and tap detection share one definition. Stryker: level 28 killed, tone 33 killed. The survivors are equivalent:
  - passing the raw signal to tap detection only affects clip rejection, while the level verdict counts every tap found;
  - no bin falls exactly on 220 Hz or 880 Hz at 48 kHz (two band-edge comparisons);
  - equal levels only occur in silence, which is below the floor;
  - exactly −60.0 dB can't be produced in floating point;
  - the `?.` guard matters only when the band holds no point, which can't happen at 48 kHz.
- [x] 1.4 Export the three functions from `@gb/dsp`. Run Stryker on them (`rtk proxy`) and verify no surviving mutants, or justify each survivor in the task notes.

  Notes: combined run over `src/capture/*.ts`: 124 killed, 7 survived (score 94.66%). All 7 are the equivalent mutants justified in 1.1 and 1.3.

## 2. Measuring and correcting captures (`apps/web`)

- [x] 2.1 Extend `useRecorder` so `onFinished` receives `{ blob, elapsedSeconds, statedRate, frames? }` (design D3). Verify hooks tests with a fake recorder and track:
  - elapsed time runs from the recorder's start event to the Stop request, not the UI tick;
  - frame counts are differences of `track.stats` and are left out when the track has no stats;
  - the stated rate falls back to 48,000 Hz.

  Notes: the stop time and final frame counts are taken when Stop is requested, before the track is released (design D3 updated). Stryker on the new code: 49 killed, 1 equivalent survivor (`cancelled: false` as the initial value, which both the stop and cancel paths overwrite before the recorder stops).
- [x] 2.2 Add the correction to `audio.ts`: relabel decoded samples at the true rate and resample them to 48,000 Hz with `resample` from `@gb/dsp` (design D2). Verify unit tests: a 440 Hz tone sampled at 44,100 Hz and labelled 48,000 Hz reads 440 ± 0.5 Hz after correction, and the result has 48,000 Hz and the expected length.

  Notes: `apps/web` has no Vitest browser mode, so the resampling moved from an `OfflineAudioContext` to a pure linear resampler in `@gb/dsp` (design D2 updated). Stryker: `resample` 13 killed and 1 timeout, `correctRate` 6 killed, no survivors.
- [x] 2.3 Add a live clip flag from the oscilloscope's analyser read: the oscilloscope reports a frame holding a sample with |x| >= 0.999, and `useClipFlag` holds the flag until 1 s after the last report. Verify with a fake analyser and fake timers.

  Notes: the flag lives beside the oscilloscope's frame loop (`onClip` prop plus `useClipFlag` in `hooks.ts`), not inside `useRecorder`, which has no frame loop. `CLIP_LEVEL` is now exported from `@gb/dsp`, shared with tap rejection. Stryker: 18 killed. 3 equivalent survivors: two constant hook dependency arrays, and `>=` vs `>` at 0.999, which a `Float32Array` can't hold exactly.

## 3. Rate check in the Frequency Detector

- [x] 3.1 Judge each decoded recording in `TapToneDialog` before analysis, and add the `captureRate` error to the dialog machine. Verify dialog and machine tests:
  - Accurate is analysed as before, with no note;
  - Corrected is analysed after correction, and the results show the corrected note;
  - Mismatch returns the take to idle with the banner and never starts analysis;
  - a loaded file is never judged;
  - loading a file clears the banner.

  Notes: the dialog's rate-check strings (the corrected note and the mismatch banner) were added to `en.json` and `fr.json` here, because the dialog renders them. Two extra dialog tests: the decoded-length fallback when the browser reports no frame counts, and an empty recording showing "Error processing audio" (spec: Recording Analysis Hand-off). Stryker on the new code: the machine's `captureRejected` 6 of 6 killed. In the dialog, the remaining survivors are equivalent:
  - `{}` behaves like `{ accepted: false }` at runtime;
  - `channels[0]` always exists, because decoding throws on empty audio;
  - `mixToMono` makes no difference for a mono recording.

  `setChosenTap(null)` predates this change.
- [x] 3.2 Confirm a corrected take and verify (dialog test) that the record returned to the caller has sampleRate 48000, fftSize 32768 and binWidth 1.46484375.

  Notes: a verification test with no new production code. It passed first time, because the correction resamples to 48 kHz before analysis (design D2).
- [ ] 3.3 Show the "Clipping" indicator beside the oscilloscope as text in a polite live region, and the results notice "N of M taps clipped…" for recorded and loaded takes. Verify component tests: the indicator appears and clears, 2 of 3 clipped shows the notice, and no clipped taps shows nothing.

## 4. Microphone Check dialog

- [ ] 4.1 Add remembered results in `localStorage` under `gb.microphoneChecks.v1`, validated by a schema on read, matched by device id with the label as fallback, and safe when storage throws (design D7). Verify unit tests: round trip, a corrupt value reads as empty, a throwing storage reads as empty and writes nothing, and a label match is used when the id differs.
- [ ] 4.2 Build the `MicrophoneCheck` dialog: input selector sharing the page-wide choice, the remembered result, "Start check" recording 5.0 s with the oscilloscope and the tap instruction, then the Clock Result and Level Result (spec wording). Verify component tests with a fake recorder:
  - no permission prompt on opening;
  - the Accurate, Corrected and Mismatch texts;
  - the four level verdicts;
  - "Check again" after a run;
  - the result is remembered;
  - the permission-denied message.
- [ ] 4.3 Add "Play test tone": a 440 Hz sine at gain 0.5 for 3.0 s on the default output while the input records, then judged, corrected and measured (design D6). Verify component tests with a fake oscillator and recorder for Matches, "Corrected from 478.9 Hz", Off by N cents (with the clock-reference note when the clock is Accurate), Tone not heard, and the reference note always shown.
- [ ] 4.4 Make the dialog full-screen on narrow viewports and verify (component test at a narrow width) that it fills the viewport.

## 5. Entry points

- [ ] 5.1 Add the input check status ("Not checked" or "Checked <date>: <verdict>") and the "Check this input" link beside the Frequency Detector's selector. The link is disabled while recording, opens the Microphone Check over the dialog, and the status refreshes on close. Verify dialog tests: the status for unchecked and checked inputs, the take is unchanged after closing the check, and a choice made in the check shows in the selector.
- [ ] 5.2 Add the "Microphone" group with "Check microphone" to the You page. Verify page tests on wide and narrow viewports that it opens the Microphone Check.

## 6. Text and styling

- [ ] 6.1 Add every new string to `en.json` and `fr.json` with the spec wording, including the French verdicts, the corrected note, the mismatch banner, the clipping notice and the You page group. Verify French tests for the corrected note, the mismatch banner and the check dialog title, and verify `pnpm check` finds no missing keys.
- [ ] 6.2 Style the verdicts, indicator and dialog with `packages/ui` tokens only (no raw hex), with verdicts in words as well as colour. Verify `pnpm check` passes and AA contrast holds in both themes.

## 7. Wrap-up

- [ ] 7.1 Add a Playwright test that opens the Microphone Check from the You page and from the Frequency Detector with a faked input, runs a check, and sees the verdict and the remembered status. Verify `pnpm test:e2e` passes.
- [ ] 7.2 Retest on a preview deployment with the user:
  - Mac + Fast Track Pro at 44.1 kHz: the check shows Corrected (44,100 Hz, +147 cents), the test tone reads about 440 Hz "Corrected from 478.9 Hz", and the user's plate reads about 187.5 Hz with the corrected note;
  - Mac + Fast Track Pro set to 48 kHz, the Pixel + Fast Track Pro and the Pixel built-in mic: the check shows Accurate and the plate still reads about 187.5 Hz;
  - a hard tap shows Clipping in the check and lights the live indicator;
  - the remembered status shows in the Frequency Detector after reloading the page.

  Verify each outcome is confirmed by the user.
- [ ] 7.3 Run `pnpm check`, `pnpm test:e2e` and `openspec validate microphone-check --strict`, and verify all pass.
