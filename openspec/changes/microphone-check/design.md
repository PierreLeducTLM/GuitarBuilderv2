# Design

## Context

See proposal.md (Why). The live capture path today (`apps/web/src/components/tap-tone/`):
- `useRecorder` (`hooks.ts`) opens the input with `captureConstraints`: 48 kHz mono, processing off. It records 100 ms `MediaRecorder` chunks and feeds an `AnalyserNode` to the oscilloscope.
- On stop, `TapToneDialog` decodes the blob with `decodeAudio` (`audio.ts`), using an `OfflineAudioContext` at 48,000 Hz, then runs the `@gb/dsp` analysis. Every downstream rule (tap blocks of 240 samples, the 32768-sample window, the 30–1000 Hz range, the saved record's 662 points) assumes 48,000 Hz.
- Nothing measures how long the capture really took, and nothing reads the track's frame counts.
- The page-wide input choice is a module variable in `hooks.ts` (`chosenInput`), so a second dialog can share it.
- The You page exists at `apps/web/src/app/(shell)/you/page.tsx`. Its requirements are in the completed but unarchived change `workbench-shell-and-steps`.

### Device test results (carried over from `tap-tone-capture-rate-check`)

Recorded 2026-11-05 on a preview deployment with a throwaway diagnostics panel. A steady 440 Hz tone was played near the microphone, about 5 to 10 s per run. Every capture reported `audio/webm;codecs=pcm`, a 48,000 Hz context, processing off, `getCapabilities().sampleRate` of 48000–48000, and no dropped frames.

| Setup (Chrome 156) | Request | Tone read | Strongest peak | Frames/s (ratio to 48k) | Decoded / elapsed | Verdict |
|---|---|---|---|---|---|---|
| Pixel 10 + Fast Track Pro ("USB audio") | none | 440.03 Hz | tone | 47,924 (0.998) | 9.920 / 9.896 s | healthy |
| Pixel 10 + Fast Track Pro | 44100 | 439.99 Hz | tone | 47,885 (0.998) | 7.040 / 7.017 s | healthy |
| Pixel 10 + Fast Track Pro | 48000 | 440.02 Hz | tone | 47,874 (0.997) | 7.160 / 7.139 s | healthy |
| Pixel 10 built-in ("Par défaut") | 48000 | 440.03 Hz | tone | 48,043 (1.001) | 7.760 / 7.753 s | healthy |
| MacBook Pro built-in | 48000 | 440.00 Hz | tone | 47,999 (1.000) | 5.696 / 5.699 s | healthy |
| MacBook Pro + Fast Track Pro (2 channels) | 48000 | not the strongest | 65.29 Hz | **44,100 (0.919)** | **4.363 / 4.751 s** | **mismatched** |
| MacBook Pro + Fast Track Pro, repeat | 48000 | not the strongest | 65.33 Hz | **44,091 (0.919)** | **5.139 / 5.597 s** | **mismatched** |
| MacBook Pro + Fast Track Pro | 44100 | not the strongest | 65.28 Hz | **44,098 (0.919)** | **5.155 / 5.617 s** | **mismatched** |

What the test established:
- On the Mac, the Fast Track Pro delivers 44,100 frames/s while Chrome states 48,000. Mains hum at 60 Hz read 65.3 Hz (60 × 48000/44100), the same factor.
- Both signals catch it: frame ratio 0.919 (8.1% off), and decoded length 0.388 s short. No healthy run came within 0.3% or 0.024 s.
- Asking for 44.1 kHz or for no rate changes nothing. Every input offers only 48 kHz.
- The Pixel, with the Fast Track Pro or its built-in mic, reads correctly.

## Goals / Non-Goals

**Goals:**
- Every rule that decides a verdict lives in pure `@gb/dsp` functions, unit-tested against the specs' worked examples. Browser code only measures and displays.
- The analysis after decoding stays byte-for-byte the same pipeline for every capture, corrected or not.
- The Microphone Check reuses the Frequency Detector's recorder, input list and oscilloscope, not a second capture path.

**Non-Goals:**
- Detecting a rate error the browser hides completely, with correct frame counts and correct decoded length but wrong pitch. No such case has been seen.
- Telling whether the speaker and the microphone share a clock. The tone test always shows its caveat instead.
- Syncing remembered results across devices or accounts.

## Decisions

### D1. One pure judge shared by both dialogs

`judgeRate({ elapsedSeconds, statedRate, decodedSeconds, frames? })` in `packages/dsp` returns one of:
- `{ verdict: "accurate", measuredRate, cents }`;
- `{ verdict: "corrected", trueRate, measuredRate, cents }`;
- `{ verdict: "mismatch", reason: "rate" | "dropped", measuredRate, cents }`.

The Frequency Detector and the Microphone Check call the same function, so a check that says "Corrected (44,100 Hz)" is guaranteed to match what the next recording does. The standard-rate list and the 3% / 1% / 0.2 s limits are constants of this module.

*Alternative:* the earlier pass/fail judge from `tap-tone-capture-rate-check`. Rejected because the user chose correction over refusal. The new judge keeps its accurate and dropped rules unchanged.

### D2. Correct by reinterpreting the samples, then resampling to 48 kHz

When the verdict is Corrected to S, the decoded samples are labelled S Hz (they really were sampled at S) and resampled to 48,000 Hz with an `OfflineAudioContext`. This is the same mechanism the file path already uses for files that aren't at 48 kHz. Everything after that point (high-pass, taps, spectrum, peaks, Q, saved record, playback, WAV export) sees an ordinary 48 kHz signal.

*Why not refuse* (the earlier change's D4): its objection was that a measured ratio is noisy, so a "corrected" number would be a guess. Snapping to a standard rate removes the guess. The device test measured 0.9183–0.9188 against an exact 0.91875, and the nearest other candidate pair is more than 8% away. Inside the 1% window the true rate is known exactly. Outside it, the judge still refuses.

*Why not analyse at S directly:* bin width, tap block length, the 662-point range and the saved record shape are all specified at 48 kHz. Analysing at 44.1 kHz would change all of them and the saved records' shape. Resampling keeps one pipeline and needs no spec changes downstream.

The correction can't restore content above S/2. That doesn't matter: analysis stops at 1000 Hz and the lowest standard rate is 8000 Hz.

### D3. Measurements in `useRecorder`

- **Elapsed time** is `performance.now()` at the recorder's `start` event and at its `stop` event, not the 100 ms UI tick. The tick drifts and starts before the recorder does.
- **Frame counts** are read from `MediaStreamTrack.stats` (`totalFrames`, `deliveredFrames`) at start and at stop, and only the differences are used. The stats object is detected at runtime: when it's missing, `frames` is left out and the judge falls back to decoded length.
- **Stated rate** is `track.getSettings().sampleRate`, falling back to 48,000 Hz.
- `onFinished` receives `{ blob, elapsedSeconds, statedRate, frames? }`. Each dialog decodes, judges, corrects if needed, then analyses.
- The live clip flag uses the oscilloscope's existing 2048-sample analyser read. At 48 kHz and 60 frames per second that covers every sample. The flag holds for 1 s, in a polite live region.

### D4. Microphone Check as its own dialog, shared input choice

`MicrophoneCheck` is a modal built from `useAudioInputs`, `useRecorder` and `Oscilloscope`. Opened from the Frequency Detector, it stacks over it as a nested Radix dialog, so the take state is untouched. The input choice is the module-level `chosenInput`, so a choice made in either dialog carries over (spec: Choice carried back).

The check recording is fixed at 5.0 s. That is long enough for the frame ratio to settle (healthy runs were within 0.3% at 5–10 s). Even without frame counts, 5 s puts an 8.8% error at 0.44 s, well past the 0.2 s floor.

### D5. Level from the check recording

The user taps during the clock recording, so one 5 s take gives both results. The level uses the unfiltered signal (clipping is a property of the raw input) and the existing `detectTaps` for "No tap heard".

The Low threshold, P < 0.05 (−26 dBFS), is a starting point:
- Tap detection works down to 0.001 RMS.
- A reasonable desktop tap peaked at 0.33 in the device test.
- 0.05 leaves about 26 dB of headroom below clipping.

It is a spec constant, so changing it later is a spec edit.

### D6. Tone test: synthesised, judged, then measured

An `OscillatorNode` (sine, 440 Hz, gain 0.5) plays on a separate `AudioContext` to the default output for 3.0 s, while `useRecorder` records the selected input. The recording goes through `judgeRate` and D2's correction exactly as a tap recording would. The heard frequency is then taken from the centre 32768 samples using the existing `tapSpectrum`-style transform and `refinePeak`. The search band, 220–880 Hz (one octave each way), contains 478.9 Hz and any other standard-pair error up to 2×.

Showing "Corrected from 478.9 Hz" next to "Heard 440.0 Hz" makes the correction visible, which is the point of the test. The caveat text is always shown (Non-Goals).

*Alternative:* run the tone through the speaker and use the tone alone as the reference. Rejected: on a phone, or with an interface's own headphone output, the speaker and mic share a clock, so the error cancels and the test passes silently.

### D7. Remembered results in `localStorage`

There is one key, `gb.microphoneChecks.v1`. It holds a map from input identifier (`deviceId`, or the label when the id is empty or changes) to `{ checkedAt, rateVerdict, trueRate?, measuredRate, levelVerdict }`. A schema validates it on read. A missing, unreadable or corrupt value reads as empty, and every access is wrapped so that blocked storage only disables the memory.

The remembered result is display-only (spec). The judge never reads it, so a stale entry, for example after the user fixes Audio MIDI Setup, can't distort a recording. The next recording or check simply shows the new truth.

*Alternative:* store results in Supabase per user. Rejected: input identifiers are per browser and per origin, so a server copy would rarely match on another device. It would also add a table, policies and pgTAP tests for no gain.

## Risks / Trade-offs

- **[Duration-only browsers and short recordings]** → Without frame counts, a recording shorter than about 2.3 s hides an 8.8% error behind the 0.2 s floor and is judged Accurate. Chrome on Mac and Android reports frame counts, and the Microphone Check always records 5 s. Accepted.
- **[A wrong snap]** → Neighbouring standard-rate candidates are at least 8% apart, and the window is 1%. A wrong snap would need about 7% of timing error, far beyond anything measured (0.3%).
- **[Resampling quality]** → The browser's resampler is the one already trusted for loaded files. A unit-style browser test checks a 440 Hz tone at 44.1 kHz, labelled 48 kHz, reads 440 ± 0.5 Hz after correction.
- **[The tone test disagrees with the clock]** → The clock wins, and the spec adds a note saying recordings are unaffected. The disagreement is shown rather than hidden.
- **[A false Mismatch on a slow device]** → It costs a re-record or a file upload. A missed mismatch costs a wrong number in the wood calculator, so leaning towards refusal is accepted.
- **[A nested dialog on a phone]** → The Microphone Check is full-screen on narrow viewports, so two layers of modal never show at once.

## Migration Plan

- There are no data, schema or API changes. Rollback is a revert.
- Saved measurements stay as they were, including any made through the mismatched Mac input (proposal: out of scope).
- `workbench-shell-and-steps` should be archived before this change is archived, so the You page requirement exists in the main `app-shell` spec. This change's `app-shell` delta only adds a requirement, so validation doesn't depend on that order.
- When this change merges, close the branch `PierreLeducTLM/Frequency-analyser-not-working-well-on-mobile` without merging. Its findings are carried over here.

