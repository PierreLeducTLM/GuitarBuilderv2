# Design

## Colours

Three new token slots in `themes.ts`: `mode1`, `mode2`, `mode3` (ink used for text, strokes and dots) and `mode1Soft`, `mode2Soft`, `mode3Soft` (tile background when chosen). They are slots, not body-mode names, because Plate mode reuses them for its takes.

| Slot | Instrument | Plate | Dark ink | Dark soft | Light ink | Light soft |
|---|---|---|---|---|---|---|
| mode1 | Air | Longitudinal | #6CB6FF | #132233 | #1D5FA8 | #E6F0FB |
| mode2 | Top | Cross-grain | #5FE0A8 | #11271F | #0A7149 | #E2F5EC |
| mode3 | Back | Diagonal | #F28CC8 | #2A1726 | #A3286E | #FBE8F2 |

They avoid the amber trace hue and the teal "completed" hue, and differ in lightness as well as hue (Top is the lightest in dark). The role name is always written next to its colour, so colour is never the only cue. Each ink is added to `contrastPairs` on every surface and on its own soft tint, so `contrast.test.ts` enforces AA in both themes.

## Label placement

`spreadLabels({ centers, width, gap, min, max })` in `lib/tap-tone/graph.ts` is a pure function: each label wants to be centred on its peak; labels sorted by position are merged into clusters while neighbours would be closer than `gap`; a cluster is laid out edge to edge (`gap` apart) centred on the mean of its members' wanted centres, then shifted inside `[min, max]`. Merging repeats until no clusters touch. Order is preserved, so a chip never crosses another.

## Fixed-size chips on a scaled graph

The graph SVG scales with its container (viewBox 640 wide). To keep chips readable on a 360 px phone, the component measures its rendered width (ResizeObserver; 640 when not measurable, as in jsdom) and sizes the chips in viewBox units as `px / scale`. The chip band is added above the plot by extending the viewBox upwards (negative y), so `GRAPH` and every existing coordinate stay as they are. The band is always there, so the graph does not jump when a mode is cleared.

## One graph for both modes

`TapToneSpectrum` has no mode. It takes `marks` (id, colour slot, name, optional subscript, frequency, level) and an optional `onDragMark`. The dialog passes Air, Top and Back with `onDragMark` in Instrument mode, and the active take's selected peak (`f` with subscript `L`, `C` or `LC`) without it in Plate mode. Markers are quiet in both modes.

## Spotlight and moving

The dialog keeps `focused: RoleName | null` beside the existing `moving`. Choosing a tile toggles `focused`; the graph draws the other modes at reduced opacity. Move sets `moving` to the focused mode and the next peak chosen on the graph assigns it, as today. Clear dispatches `roleCleared`. The action bar lives under the tiles, so the touch and keyboard path no longer needs six buttons.

## Main frequency

A `MainFrequency` component in `panels.tsx` serves both modes: heading (Instrument: "Main frequency"; Plate: the take's name), frequency, "Same peak as <Role>" (Instrument, when a mode is within 0.5 Hz of it, the dialog's existing same-peak tolerance) or "Current value" (Plate, when the caller supplied one), a line with level, note, spectral and decay Q, the Q reasons, and the peak buttons. `DetectedFrequency` and `DetectedPeaks` are removed.

## Plate takes

`PlateTakes` renders the take selector as three tiles in the slot colours (name, `f` symbol, selected frequency or "—", note). It sits above the guidance and is shown in every take state, since it is how the user moves between takes; tiles other than the active one are disabled while recording.
