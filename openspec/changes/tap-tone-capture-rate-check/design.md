# Design

## Context

The diagnosis is in proposal.md (Why). Measurements from the user's files, analysed on 2026-11-05 with the app's own `@gb/dsp` code:

| | Desktop + Fast Track Pro | Pixel 10 + Fast Track Pro |
|---|---|---|
| Peaks (Hz) | 203.6, 234.4, 329.6 | 187.5, 215.3, 307.6 |
| Peak level | 0.33 of full scale | 1.0 (clipped) |
| 1–3 kHz / 3–8 kHz energy | −82.8 / −90.3 dB | −49.6 / −57.7 dB |

Each phone peak is low by about 48000/44100 = 1.088. Across the three taps of one phone take, the peaks agree within 0.4 Hz, so the analysis is stable. It is the input that is wrong. The phone's built-in mic records at the correct pitch.

Current capture path (`apps/web/src/components/tap-tone/hooks.ts`):
- `getUserMedia` asks for 48 kHz mono with processing off.
- `MediaRecorder` records 100 ms chunks.
- An `AnalyserNode` feeds the oscilloscope.
- On stop, the blob is decoded at 48 kHz by `decodeAudio` and analysed.

Nothing records how long the capture really took. Nothing reads the track's frame counts.

We do not yet know which signals the browser exposes when Android mislabels the rate. Android may deliver fewer frames per second (visible in timing). It may also patch the gaps so the frame count looks right (visible only as dropped frames, if at all). That unknown is why the work starts with a device test.

## Goals / Non-Goals

**Goals:**
- Never show a frequency from a capture whose rate is known to be wrong.
- Keep the judgement in a pure, unit-tested function. The browser code only measures numbers.
- Tell the user about clipping while they can still fix it.

**Non-Goals:**
- Correcting the frequencies of a mismatched capture.
- Talking to the USB interface directly.
- Changing the recording format, the high-pass filter or any peak rule.
- Checking uploaded files.

## Decisions

### D1. Device test first, as throwaway code

Before any production code, a temporary diagnostics panel goes onto a preview deployment, shown only with `?captureDiagnostics=1`. For each recording it shows:
- `track.getSettings()`, and the `sampleRate` from `track.getCapabilities()`;
- the `AudioContext` sample rate;
- `track.stats` frame counts at start and stop, when the browser has them;
- real elapsed time and decoded duration;
- the strongest peak.

It can also request 48 kHz, 44.1 kHz or no rate.

The user records a steady 440 Hz tone from any tone generator on:
- Pixel + Fast Track Pro;
- Pixel built-in mic;
- desktop + Fast Track Pro.

The results go into a "Device test results" section of this file. The panel is never merged: the last task deletes it. That's why it's exempt from TDD: it is a measuring instrument, not product code.

*Alternative considered:* building the check straight away from the duration signal alone. Rejected: if Android pads the gaps, durations match and the check never fires. We'd ship a check that can't catch the case that triggered the change.

### D2. A pure judge in `packages/dsp`

`judgeCapture({ elapsedSeconds, decodedSeconds, statedRate, frames? })` returns one of:
- `{ ok: true }`;
- `{ ok: false, reason: "rate", ratio }`;
- `{ ok: false, reason: "dropped", fraction }`.

The formulas and limits are the ones in the spec's Duration check and Frame check. Keeping the judge pure lets the spec's worked examples become plain unit tests. It also means a limit can change after the device test without touching browser code.

### D3. Measurements in `useRecorder`

- **Elapsed time** is `performance.now()` at the recorder's `start` event and at its `stop` event, not the 100 ms UI tick. The tick drifts and starts before the recorder does.
- **Frame counts** come from `MediaStreamTrack.stats` (`totalFrames`, `deliveredFrames`), read at start and at stop. Only the differences are used.
- The stats object is detected at runtime. Missing stats leave `frames` undefined, and only the duration check applies.
- `onFinished` receives `{ blob, elapsedSeconds, frames?, statedRate }`. The dialog judges the capture after decoding, before calling `analyse`.

### D4. Refuse, don't correct

When the judge fails a recording, the dialog dispatches a new `captureRate` error. The take returns to idle with the banner (the spec's message). We don't rescale by the measured ratio, because:
- the clicks and dropped audio would remain;
- the measured ratio has timing noise, so the "corrected" frequency would be wrong by up to a few percent with no sign it was guessed;
- the luthier would rather re-record with a native app than trust a patched number.

### D5. Limits: 3% rate, 1% dropped, 0.2 s floor

- Real mismatches are large: 44.1↔48 kHz is 8.8%, and 16↔48 kHz is far more.
- Clock drift between a healthy device and the system clock is well under 0.1%.
- 3% leaves room for timing jitter while catching every standard mismatch.
- The 0.2 s floor absorbs the recorder's start and stop latency on short recordings. A ≥ 2.3 s recording at 8.8% still exceeds it.

The device test checks that healthy captures sit well inside these limits and that the Pixel's sits well outside. If they don't, the limits change in the spec and in the tests before task 2.

### D6. Native-rate request is an experiment only

The device test also tries asking for 44.1 kHz and for no rate. The "Raw Microphone Capture" requirement stays at 48 kHz unless one of these makes the Pixel take read 440 Hz without clicks. In that case, a `/opsx:update` of this change adds a modified capture rule and its tasks before task 3. The rate check stays either way, for other devices.

### D7. Clipping indicator from the existing analyser

- The oscilloscope already reads the latest 2048 samples on each animation frame. At 48 kHz and 60 frames per second that covers every sample.
- The same buffer gives the peak |x|. When it reaches 0.999, the indicator shows "Clipping" for 1 s.
- The indicator is a text label next to the canvas in a polite live region, so it's announced without being repeated on every frame.
- The results notice counts taps whose rejection is `"clipped"` in `TakeResult.taps`. No new analysis is needed.

## Risks / Trade-offs

- **[The browser gives no signal of the Pixel mismatch]** → The device test finds out before any product code. If neither duration nor frame counts reveal it, stop after task 1 and revise this change with `/opsx:update`. Candidate fallbacks:
  - a one-off "check input" with a reference tone;
  - a notice when a USB input is used on Android.
- **[`MediaStreamTrack.stats` is missing on some browsers]** → Feature detection, with the duration check as the fallback (D3).
- **[False alarms on slow devices]** → The 0.2 s floor and the device-test calibration. A false alarm costs a re-record. A missed mismatch costs a wrong frequency in the wood calculator, so we accept leaning towards refusal.
- **[The live indicator misses a clip when the tab is throttled]** → Acceptable: the results notice still counts clipped taps from the full recording.

## Migration Plan

No data or schema changes. Saved records and existing measurements are unaffected. To roll back, revert the change.

## Device test results

To be filled in by task 1.2.
