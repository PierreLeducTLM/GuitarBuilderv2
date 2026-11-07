# Tasks

Every task is test-first: write the failing test named in the task, then the code.

## 1. Body mode colours (`packages/ui`)

- [x] 1.1 Add `modeAir`, `modeTop`, `modeBack` and their `Soft` tints to both themes, regenerate `tokens.css`, expose them in `theme.css`, and add their contrast pairs (each ink on every surface and on its soft tint; `fg` and `fgDim` on each soft tint). Verify `contrast.test.ts` passes for both themes.

## 2. Label placement (`apps/web/src/lib/tap-tone/graph.ts`)

- [x] 2.1 `spreadLabels({ centers, width, gap, min, max })`. Verify unit tests for: labels far apart stay on their peaks; two touching labels are centred on the mean of their peaks, `gap` apart; the phone case (103.4 / 186.7 / 220.8 Hz at 358 px) keeps order, gap and bounds; a cluster pushed past either edge is shifted inside; a chain that only touches after a first merge merges again; an empty list. Mutation: 98.4 %; the one survivor (`>` to `>=` at exactly the gap) is equivalent, since merging groups that already sit exactly `gap` apart leaves every label where it was.

## 3. Graph (`TapToneSpectrum`)

- [x] 3.1 Body mode chips: colour per mode, "<Role> <frequency>" text, leader to the peak, spread with `spreadLabels`, fixed on-screen size from the measured width, band above the plot only when roles are shown; dragging a chip still assigns the role. Verify the existing drag tests (updated to the chip) and new tests for the chip text, the spread positions and no band in Plate mode.
- [x] 3.2 Quiet markers in Instrument mode: unlabeled dots except the selected peak (ring and label) and the snap target (label). Verify Plate mode markers are unchanged.
- [x] 3.3 Spotlight: a `focused` mode dims the other modes. Verify with a test.

## 4. Readouts and main frequency (`panels.tsx`)

- [x] 4.1 `BodyModes` tiles replacing `RolesPanel`: content per the spec scenario (Air 103.4 Hz, Ab2 -7 c, Q 26 and 31), "set by you", "Not identified", pressed state, and the Move / Clear bar with the moving status. English and French.
- [x] 4.2 `MainFrequency`: frequency, "Same peak as <Role>", level, note, Q values and reasons, and the peak buttons. English and French.

## 5. Dialog (`TapToneDialog`)

- [x] 5.1 Instrument layout: graph full width, then body modes, then main frequency; spotlight state wired to the graph; Move then a peak assigns the role. Plate layout unchanged. Verify dialog tests, then update `e2e/tap-tone.spec.ts` to the readouts and run it.
- [x] 5.2 Run `pnpm check`, mutation testing on `spreadLabels`, and `openspec validate --strict`.

## 6. Plate mode in the same design

- [x] 6.1 Rename the colour tokens to slots `mode1`, `mode2`, `mode3` (and `Soft`), keeping the values and contrast pairs. Verify `contrast.test.ts` and every tap-tone test still pass.
- [x] 6.2 Graph without a mode: `marks` with a colour slot, name and optional subscript, `onDragMark` only for Instrument; quiet markers in both modes; the band always present. Verify graph tests for the Plate chip ("fC 92.7", not draggable), quiet markers without chips, and the existing Instrument tests on `marks`.
- [x] 6.3 `PlateTakes` tiles (name, symbol, frequency or "—", note, pressed, disabled while recording) and `MainFrequency` for Plate (take heading, "Current value"); remove `DetectedFrequency` and `DetectedPeaks`. English and French.
- [x] 6.4 Dialog Plate layout: tiles above the guidance in every state, then the same results layout as Instrument. Verify the Plate dialog tests, update `e2e/wood-plate.spec.ts`, run `pnpm check`, the tap-tone and wood e2e specs, and `openspec validate --strict`.
