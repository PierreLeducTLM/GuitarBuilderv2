# Proposal

## Why

On a Google Pixel 10 in Chrome, recording through an M-Audio Fast Track Pro gives frequencies that are about 8.8% too low and jump from take to take. The same plate reads 203.6 Hz on a desktop and 187.5 Hz on the phone, and every peak is off by the same factor, 48000/44100. The phone recording also has about 33 dB more energy between 1 and 8 kHz than the desktop one, which the user hears as a metallic sound. The app's analysis is correct for the audio it receives: run on the recorded files, it gives the same peaks with or without the mobile rule. The fault lies before the app. Android reads the interface's 44.1 kHz stream as if it were 48 kHz, and patches the shortfall with gaps that cause clicks.

A web page cannot work around Android's USB audio path. Today, though, the dialog shows the wrong frequency with full confidence, and a luthier may enter it into the wood calculator or a build step. It should refuse instead, and explain what to do.

Two of the three taps in the phone take were also clipped. The dialog rejects clipped taps, as it should, but the user is told only through a per-tap reason on the waveform. When every tap clips, the analysis falls back on handling noise, and the reported frequencies jump.

## What Changes

- **Capture rate check.** The dialog checks during and after each recording that audio arrived at the rate the browser claims. It compares the frames the browser captured, and the length of the decoded recording, with the real elapsed time, and it counts dropped audio. When the rate is off by more than 3%, or more than 1% of the audio was dropped, the take shows no frequency. It returns to idle with a message explaining that this input is not read correctly on this device. The message tells the user to record with a native app that supports USB audio and load the WAV file, or to use another device.
- **Clipping warnings.**
  - While recording, a "Clipping" indicator lights next to the oscilloscope whenever the input reaches full scale.
  - In the results, a notice says how many taps clipped and asks the user to tap more lightly or turn the input gain down.
- **Native-rate experiment (no behaviour change unless it works).** A device test checks whether asking the browser for the device's own rate (44.1 kHz) instead of 48 kHz removes the mismatch on the Pixel. If it does, a follow-up update to this change adds it to the capture rule. If it doesn't, the capture rule stays as it is.
- No change to the signal processing, peak rules or saved records. Uploaded files are not rate-checked, since they don't come through the live capture path.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `tap-tone-capture`:
  - new requirement for the capture rate check;
  - new requirement for clipping warnings;
  - the Error Banner requirement gains the rate-mismatch message.

## Impact

- `apps/web/src/components/tap-tone/hooks.ts` (`useRecorder`): timing, frame statistics and the live clip flag.
- `TapToneDialog.tsx`, `Oscilloscope.tsx`, the results panels and `lib/tap-tone/machine.ts`: a new error, a new notice and the live indicator.
- `packages/dsp`: a pure function that judges the capture from the measured numbers, so it can be unit-tested without a browser.
- `apps/web/messages/en.json` and `fr.json`: new strings.
- A temporary diagnostics page on a preview deployment, used only to run the device test on the Pixel and deleted before merge.
- No database, API or dependency changes.
