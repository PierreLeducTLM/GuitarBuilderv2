# Proposal

## Why

The step dialog lists tap-tone measurements, but nobody can record one: "Add Analysis" is still missing (`builds-and-sequence` deferred it). The wood calculator, next in the recommended order (`docs/rewrite/README.md`), needs the same capture dialog for its three frequency fields. `packages/dsp` is still an empty placeholder, and the later build analyzer needs its transform, windows and dB scale. So the shared capture dialog and the signal processing under it come first.

## What Changes

- **Signal processing in `packages/dsp`** (pure TypeScript, no DOM), unit-tested against the spec's numbers:
  - a radix-2 FFT and the Hamming window, written to be reused by the build analyzer;
  - the 30 Hz high-pass biquad;
  - framing, the silence gate, frame averaging and the two fallbacks;
  - the 30–1000 Hz output points;
  - peak candidates, ranking and limits, the mobile 132–138 Hz exclusion and the note label;
  - the spectrum record builder, re-detection from a saved record, and the 16-bit WAV encoder.
- **The "Frequency Detector" dialog (`tap-tone-capture`)**, reusable by any screen:
  - idle, recording, analyzing and results states, with the error banner;
  - device selection that never prompts for the microphone on opening;
  - raw 48 kHz mono capture with the format preference, the 5 s window and a live oscilloscope;
  - WAV, MP3 and OGG files, decoded at 48 kHz and mixed to mono;
  - the interactive 30–1000 Hz spectrum graph (markers, hover readout, snap and click selection), the Detected Peaks list and the Detected Frequency and Current Value panels;
  - Play and Download Audio for audio captured in the session, Re-record, Confirm and Cancel;
  - reopening on a saved spectrum record;
  - every string in English and French, including the help tooltip.
- **"Add Analysis" on build steps (`build-sequence`, Step Measurement Capture).** Owners get the action in the Sound Analysis section. It opens the dialog labelled "Analysis for <step label>", then asks for a description, pre-filled with "Resonance Analysis", and attaches the measurement through the existing step function.
- **Server-side record validation.** One database check of the spectrum record shape is shared by every table that stores records. `update_build_step` switches to it and gains a size limit. The wood calculator's change will use the same check.
- **Spec additions (`tap-tone-capture`):**
  - the server refuses malformed or oversized spectrum records (a legacy finding: client-built JSON was stored unchecked);
  - cancelling while "Analyzing..." discards the analysis (a legacy defect).
- **Not in this change:** the wood calculator's three detect buttons, which arrive with the calculator itself (`wood-panel-calculator`). The owner's open questions in `docs/rewrite/legacy-findings/tap-tone-capture.md` (calibration, sub-bin peaks, free selection) stay closed as decided on 2026-11-01.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `tap-tone-capture`:
  - new requirement "Spectrum Record Validation": the record shape and size the server accepts;
  - "Cancelling the Dialog" gains a scenario for cancelling during analysis; the behavior is otherwise unchanged.

`build-sequence` (Step Measurement Capture) is implemented as written.

## Impact

- **Database:**
  - a new migration with `public.spectrum_record_is_valid(jsonb)`, and `update_build_step` redefined to use it;
  - a new pgTAP file (`10_spectrum_records.test.sql`; `09` is taken by `legacy-account-and-build-import`).
- **Packages:**
  - `@gb/dsp` gains the modules above, with no runtime dependencies;
  - `@gb/ui` gains a `Tooltip` built on Radix, and a native select field.
- **App:**
  - the dialog and its hooks under `apps/web/src/components/tap-tone/`;
  - its state machine under `apps/web/src/lib/tap-tone/`;
  - "Add Analysis" in `StepMeasurements`;
  - new `tapTone.*` message keys in both catalogs.
- **New dependency, pinned exactly:** `@radix-ui/react-tooltip` in `@gb/ui`.
- **Tests:**
  - DSP unit tests on synthetic signals with known answers;
  - component tests of the dialog with mocked media APIs;
  - end-to-end tests with a generated WAV fixture, both uploaded and played through Chromium's fake microphone, on the desktop and phone projects.
- **Later changes:**
  - `wood-panel-calculator` opens this dialog and validates its stored spectra with the same function;
  - `build-acoustic-analysis` reuses the FFT, the windows and the dB scale.
