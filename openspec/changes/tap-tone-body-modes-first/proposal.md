# Proposal

## Why

In Instrument mode the Frequency Detector finds the three body modes a luthier is looking for (Air, T(1,1)1; Top, T(1,1)2; Back, T(1,1)3), but the screen does not put them first. On the graph every peak carries the same "<frequency> Hz" label, the three role labels share one colour and sit in a row near the top of the plot, and close modes overlap on a phone. The details of each mode are spread across a "Detected Frequency" panel (the main peak only), a roles panel with six buttons, and a separate peak list. The owner reported the screen is not intuitive and asked for the three modes to stand out on the graph, each in its own colour, with a compact readout of each one below the graph.

The agreed mockup (5 Nov 2026): https://claude.ai/artifact/WepNmi89ySJpJYoxLKQAG9

## What Changes

- **A colour per body mode (`packages/ui`).** New design tokens for Air (blue), Top (mint) and Back (pink), with light-theme counterparts that meet WCAG AA, used only for the body modes.
- **Body mode labels on the graph (`tap-tone-capture`).** In Instrument mode each identified mode is drawn in its colour: a dot with a halo on its peak and a chip "<Role> <frequency>" in a band above the plot, joined to the peak by a leader line. The chips sit on one row and never overlap or leave the plot: chips that would touch are spread apart around their peaks. Chips keep a fixed on-screen size, so they stay readable on a phone. The chip is still what the user drags to move a mode.
- **Quieter peak markers (`tap-tone-capture`).** In Instrument mode a peak that is not a body mode, not selected and not under the pointer is drawn as a small dot with no label. The selected peak gets a ring.
- **Body mode readouts (`tap-tone-capture`).** The roles panel becomes three compact tiles under the graph, in the order Air, Top, Back: name, mode number, frequency, note, spectral Q and decay Q, and "set by you". Choosing a tile spotlights its mode on the graph and shows Move and Clear for it.
- **Main frequency (`tap-tone-capture`).** In Instrument mode the "Detected Frequency" panel and the "Detected Peaks" list merge into one "Main frequency" section, which says when the main peak is also a body mode.
- Plate mode, the detection rules, what Confirm returns and what is stored are unchanged. No wolf-note indicator (considered and dropped by the owner).

## Capabilities

### Modified Capabilities

- `tap-tone-capture`: Peak Markers; Selected Frequency Display; Detected Peaks List; Instrument Body Resonance Assignment; Instrument Body Resonance Reliability; Manual Role Assignment. New: Body Mode Labels; Body Mode Readouts.

## Impact

- `packages/ui/src/tokens/themes.ts` and the generated `tokens.css`, `theme.css`.
- `apps/web/src/lib/tap-tone/graph.ts` (label spreading), `apps/web/src/components/tap-tone/` (`TapToneSpectrum`, `panels`, `TapToneDialog`), `messages/en.json` and `fr.json`, unit tests and `e2e/tap-tone.spec.ts`.
- No database, API or DSP changes.
