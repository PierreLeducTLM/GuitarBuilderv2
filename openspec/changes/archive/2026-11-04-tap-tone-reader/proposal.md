# Proposal

## Why

The specified "Frequency Detector" averages a fixed 5 s window and reports peaks at the nearest 2.93 Hz bin. It hands back one frequency per opening, so the wood calculator needs three separate sessions, and nothing in it tells a luthier which peak is which mode. Rick Molloy's Resonance Reader shows a better workflow:
- taps are detected and checked one by one;
- peaks are named by mode, and the names can be corrected;
- Q is read both from the spectrum and from the ring-down.

`tap-tone-dialog`, which would have built the old dialog, has not started (0 of 17 tasks), so now is the cheapest moment to replace it. This change replaces it and is built clean-room. The Resonance Reader's source is licensed for viewing only, so nothing is taken from its code: the methods come from published signal processing, with our own thresholds and tests.

## What Changes

- **Tap-based analysis replaces the whole-recording average.**
  - The dialog finds each tap in a recording or file.
  - Clipped, overlapping or cut-off taps are rejected automatically.
  - The user can exclude any other tap.
  - Only the accepted taps are averaged, as a 32768-point Hann spectrum (1.46 Hz bins).
  - The silence gate and the two quiet-audio fallbacks go away. A recording with no tap gives "No tap detected".
  - Recording stops after 10 s instead of 5 s, which leaves room for several taps.
- **Sub-bin peaks.** Every peak's frequency and level are refined with a parabola through the three bins around it. **This reverses the owner decision of 2026-11-01** ("no sub-bin interpolation"). Moduli scale with f², so the old 2.93 Hz grid could move E_C by several percent.
- **Spectral Q and decay Q for every peak.**
  - Spectral Q is the peak frequency divided by its −3 dB bandwidth.
  - Decay Q is π × f × τ, from each tap's isolated ring-down, combined as the median over taps.
  - When the evidence is too weak, the dialog shows a reason instead of a number.
  - A peak inspector shows the ring-down, its envelope and the fitted decay.
- **Two modes, chosen by the caller.**
  - **Plate mode** has one take per mode: Longitudinal, Cross-grain, Diagonal.
    - Each take comes with guidance on where to hold the plate.
    - Each take keeps its own spectrum.
    - Confirm returns every measured mode at once.
  - **Instrument mode** has one take of an assembled body.
    - The dialog labels Air, Top and Back automatically with the identification rules moved from `acoustic-signal-analysis`. It reports a role as not identified rather than guessing.
    - The user can move a label to another peak or clear it.
    - Confirm returns the selected main peak plus the roles.
- **"Add Analysis" on build steps** opens Instrument mode. Step measurements gain optional roles: each holds frequency, level, spectral Q, decay Q, and whether it was found automatically or set by the user. Measurements stored before this change (a single peak, no roles) stay valid and display as before.
- **Server-side checks.** One database function validates spectrum records, and `update_build_step` also checks roles. A record may now hold a 32768-point FFT, still with at most 1024 points.
- **BREAKING (spec only, nothing built yet):**
  - The dialog's caller interface changes from "one frequency" to a mode-specific result.
  - The wood calculator's three detect buttons become one plate measurement. That rewiring is a follow-up update to `wood-panel-calculator`.
- **Not in this change:**
  - removing the build analyzer (`build-acoustic-analysis`, `acoustic-signal-analysis`), which is its own change, `retire-build-analyzer`;
  - free overlay of takes, brace stock, played-note analysis, a tone generator, the 4-DOF hand-off and user-adjustable analysis settings.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `tap-tone-capture`:
  - tap detection and per-tap windows;
  - the Hann spectrum averaged over the accepted taps;
  - sub-bin peaks;
  - spectral Q and decay Q;
  - the peak inspector;
  - Plate and Instrument modes;
  - the waveform with tap markers;
  - the mode-specific caller result;
  - a 10 s recording limit;
  - new record limits and server validation;
  - cancelling during analysis.
- `build-sequence`:
  - Step Measurement Capture opens Instrument mode;
  - Step Measurement Record gains optional roles;
  - Step Measurement List shows them.

## Impact

- **Packages:** `@gb/dsp` gains these modules, unit-tested on synthetic signals, still dependency-free:
  - FFT, Hann window, biquad high-pass;
  - tap detection;
  - tap spectrum averaging;
  - peak detection with parabolic refinement;
  - bandwidth Q;
  - body-resonance identification;
  - decay Q;
  - note labels, record building and WAV encoding.
- **App:**
  - the dialog, its reducer and hooks under `apps/web/src/components/tap-tone/` and `apps/web/src/lib/tap-tone/`;
  - the waveform navigator, the spectrum graph with role labels, and the inspector;
  - "Add Analysis" in `StepMeasurements`, and roles in the measurement list;
  - `tapTone.*` messages in `en` and `fr`.
- **Database:**
  - one migration adds `public.spectrum_record_is_valid(jsonb)` and `public.measurement_roles_are_valid(jsonb)`, and redefines `update_build_step`;
  - a new pgTAP file;
  - `StepMeasurement` in `@gb/db` gains `roles`.
- **UI kit:** `@gb/ui` gains `Tooltip` (Radix, pinned exactly) and `SelectField`.
- **Docs:** `docs/rewrite/README.md` records the reversed sub-bin decision.
- **Other changes:**
  - `wood-panel-calculator` must be updated to open Plate mode;
  - `retire-build-analyzer` follows this change;
  - the legacy import is unaffected, because legacy step measurements fit the unchanged single-peak shape.
