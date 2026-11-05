# Tasks

Task 1 is a device test on the user's phone, and its outcome gates the rest. If no browser signal reveals the Pixel mismatch, stop after 1.3 and revise this change with `/opsx:update`. Production code in tasks 2–4 is test-driven: write a failing test first, then run mutation testing on the changed modules.

## 1. Device test (throwaway, never merged)

- [ ] 1.1 Add a temporary diagnostics panel to the Frequency Detector, shown only with `?captureDiagnostics=1`, as described in design D1:
  - shows settings, capabilities, context rate, `track.stats` frame differences, elapsed time, decoded duration and strongest peak;
  - has a 48 kHz / 44.1 kHz / no-rate request switch.

  Verify the panel shows on the branch's preview deployment and is absent without the flag.
- [ ] 1.2 With the user, record a 440 Hz reference tone at each requested rate on Pixel + Fast Track Pro, Pixel built-in mic and desktop + Fast Track Pro. Verify every reading is written into design.md "Device test results".
- [ ] 1.3 Decide from the results:
  - which signals detect the mismatch;
  - whether the 3% / 1% / 0.2 s limits hold;
  - whether a native-rate request fixes the Pixel (design D6).

  Record the decisions in design.md. If the spec or the tasks change, update them with `/opsx:update` and verify `openspec validate --strict` passes.

## 2. Capture judge (`packages/dsp`)

- [ ] 2.1 Add `judgeCapture` with the duration check. Verify unit tests for the spec's worked examples:
  - 6.0 s elapsed / 5.51 s decoded fails with reason "rate";
  - 1.0 s / 0.85 s passes;
  - 5.0 s / 4.95 s passes.
- [ ] 2.2 Add the frame check. Verify unit tests:
  - 220,500 frames in 5.0 s at 48 kHz fails with ratio 0.919 (within 0.001);
  - 240,000 frames passes;
  - 245,000 captured with 5,000 dropped fails with reason "dropped";
  - 0.5% dropped passes;
  - missing frame counts fall back to the duration check.
- [ ] 2.3 Export `judgeCapture` from `@gb/dsp`. Run Stryker on it and verify no surviving mutants, or each survivor is justified in the task notes.

## 3. Rate check in the dialog (`apps/web`)

- [ ] 3.1 Extend `useRecorder` to measure elapsed time between the recorder's start and stop events, and frame-count differences from `track.stats` when present (design D3), passing them with the recording. Verify hooks tests with a fake recorder and track: elapsed time follows the start and stop events, not the UI tick, and frame counts are omitted when the track has no stats.
- [ ] 3.2 Add the `captureRate` error to the dialog machine and judge each decoded recording before analysis. Verify dialog and machine tests:
  - a failing recording returns the take to idle with the banner and never starts analysis;
  - a passing one is analysed as before;
  - a loaded file is never judged;
  - loading a file clears the banner.
- [ ] 3.3 Add the rate-mismatch message to `en.json` and `fr.json` with the spec's wording. Verify the French dialog test shows the French banner and `pnpm check` finds no missing keys.

## 4. Clipping warnings (`apps/web`)

- [ ] 4.1 Show the live "Clipping" indicator beside the oscilloscope: it appears at |x| >= 0.999, holds for 1 s and is a text label in a polite live region (design D7). Verify tests with a fake analyser and fake timers: it appears on a full-scale sample, clears 1 s after the last one, and stays hidden below 0.999.
- [ ] 4.2 Show the results notice "N of M taps clipped. Tap more lightly or turn the input gain down." for recorded and loaded takes. Verify panel tests: 2 of 3 clipped shows the notice in English and French, and no clipped taps shows nothing.
- [ ] 4.3 Add the indicator and notice strings to `en.json` and `fr.json`, using design tokens only for the indicator's styling. Verify `pnpm check` passes and AA contrast holds in both themes.

## 5. Wrap-up

- [ ] 5.1 Delete the diagnostics panel from task 1.1. Verify `?captureDiagnostics=1` no longer changes the dialog and no diagnostics code remains (grep for `captureDiagnostics`).
- [ ] 5.2 Retest on the preview with the user:
  - Pixel + Fast Track Pro shows the rate-mismatch message;
  - Pixel built-in mic and desktop + Fast Track Pro give results as before;
  - a hard tap lights the clipping indicator;
  - a WAV from a native USB recorder, loaded into the dialog, reads about 203 Hz on the user's plate.

  Verify each outcome is confirmed by the user.
- [ ] 5.3 Run `pnpm check`, `pnpm test:e2e` and `openspec validate tap-tone-capture-rate-check --strict`, and verify all pass.
