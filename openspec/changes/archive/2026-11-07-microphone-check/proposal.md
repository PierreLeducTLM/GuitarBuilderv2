# Proposal

## Why

Every frequency the app measures depends on the audio input delivering samples at the rate the browser claims. On 2026-11-05, Chrome on a MacBook reported an M-Audio Fast Track Pro at 48,000 Hz while it delivered exactly 44,100 frames per second. Every reading came out 8.8% high (146 cents), and nothing warned the user. A luthier needs to be able to check an input, using only the laptop or phone, before trusting its numbers. The app must also catch a wrong rate on every recording.

The unmerged change `tap-tone-capture-rate-check` (branch `PierreLeducTLM/Frequency-analyser-not-working-well-on-mobile`) diagnosed the fault with a device test and designed a rate check that refuses bad captures. This change replaces it. It keeps the device-test findings and the check, corrects captures whose real rate is a standard one instead of refusing them, and adds a check the user runs on demand.

## What Changes

- **Rate check on every recording.** Each recording's real rate is measured against the system clock: the frames delivered (or the length of the decoded audio) over the real elapsed time. Three outcomes:
  - within 3% of the stated rate: analysed as today;
  - within 1% of another standard rate (for example 44,100 Hz): **corrected** by analysing the audio at its real rate, with a note in the results;
  - anything else, or more than 1% of the audio dropped: refused with a message explaining how to fix the input.
- **Microphone Check dialog**, opened from a "Check this input" link next to the Frequency Detector's input selector and from the You page:
  - *Clock*: a 5 s recording that gives the stated rate, the measured rate, the error in cents and a verdict (Accurate, Corrected or Mismatch). The user taps a part during it.
  - *Level*: from the same recording, the noise floor, the loudest tap's peak level and a verdict (Clipping, Low or Good).
  - *Tone* (optional): the device's speaker plays 440 Hz while the input records, and the frequency the app heard is shown. It confirms the clock result but never overrides it, because a speaker and microphone on the same clock can hide the error.
- **Remembered results.** The browser remembers the last check of each input. The Frequency Detector shows it next to the selector ("Checked Nov 7, 2026: Accurate"), or "Not checked". The remembered result is for display only: every recording is still judged on its own.
- **Clipping warnings** (carried over from the unmerged change): a live "Clipping" indicator beside the oscilloscope, and a results notice counting the clipped taps.
- **Out of scope:** correcting measurements saved before this change; checking uploaded files; magnitude (frequency-response) calibration of the microphone; any database or saved-record change. Corrected audio is resampled to 48,000 Hz, so saved spectrum records keep their current shape.

## Capabilities

### New Capabilities

- `microphone-check`: the Microphone Check dialog (clock, level and tone tests), the shared verdict rules, and the per-input results remembered in the browser.

### Modified Capabilities

- `tap-tone-capture`:
  - new requirement for the rate check on every recording, with correction or refusal;
  - new requirement for clipping warnings;
  - new requirement for the input's check status and the "Check this input" link next to the selector;
  - the Error Banner requirement gains the rate-mismatch message.
- `app-shell`: new requirement for a Microphone entry on the You page that opens the Microphone Check. This builds on the You page from `workbench-shell-and-steps`, which must be archived first.

## Impact

- `packages/dsp`: pure functions to judge a capture (accurate, corrected to a standard rate, or refused), to measure the tone and to compute levels, all unit-tested against the specs' worked examples.
- `apps/web/src/components/tap-tone/hooks.ts` (`useRecorder`): elapsed time from the recorder's start and stop events, frame counts from `MediaStreamTrack.stats`, and the live clip flag.
- `apps/web/src/components/tap-tone/audio.ts`: reinterpreting decoded audio at its real rate and resampling it to 48,000 Hz.
- `TapToneDialog.tsx`, `Oscilloscope.tsx`, `panels.tsx` and the dialog machine: the check verdict, the corrected note, the new error, the clipping indicator and notice, and the check status and link.
- A new `MicrophoneCheck` dialog component, and a Microphone group on `apps/web/src/app/(shell)/you/page.tsx`.
- `apps/web/messages/en.json` and `fr.json`: new strings.
- Browser storage: one key holding the remembered check per input. No database, API, migration or dependency changes.
