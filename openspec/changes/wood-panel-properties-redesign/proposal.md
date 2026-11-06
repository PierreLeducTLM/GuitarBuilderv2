# Proposal

## Why

The owner reported that the Wood Panel Properties page does not look like the rest of the app. Its section headings are spaced-out mono capitals that no other screen uses, and its three frequencies are plain text fields, while the tap-tone reader that measures them shows each take as a colour-coded tile (Longitudinal blue, Cross-grain mint, Diagonal pink) with its symbol, frequency and note. The same three numbers look unrelated on the two screens.

## What Changes

- **Frequency tiles (`wood-panel-properties`).** The three frequency inputs become three tiles in the reader's take colours and order: the take's name (the reader's wording), its symbol (f_L, f_C, f_LC), the frequency as a large editable mono value with "Hz", and the note label of a valid value. The measured Q line, the hint and the validation error stay in the tile. The tiles stay editable by typing; the accessible name of each input is unchanged.
- **Measure plate in the group header.** The "Measure plate" action moves next to the "Frequency Measurements" heading, above the tiles it fills.
- **Headings like the other screens.** Group headings in the inputs and results areas use the app's plain semibold section heading instead of letter-spaced mono capitals.
- No change to the formulas, validation, saving, the reader or what is stored.

## Capabilities

### Modified Capabilities

- `wood-panel-properties`: Frequency Inputs.

## Impact

- `apps/web/src/components/wood/` (`WoodInputs`, `WoodCalculator`, `WoodResults`), `apps/web/src/components/tap-tone/panels.tsx` (shares its slot colours), unit tests, `e2e/wood*.spec.ts` if selectors move.
- No database, API, DSP or message changes.
