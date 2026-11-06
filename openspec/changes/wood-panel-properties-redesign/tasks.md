# Tasks

Every task is test-first: write the failing test named in the task, then the code.

## 1. Frequency tiles (`WoodInputs`)

- [x] 1.1 Each frequency is a tile in its take's slot colour with the reader's take name, the symbol, the editable value and "Hz", the hint, the Q line and the error; the input keeps its accessible name. Verify unit tests for the names and order (English and French), the slot colour per take, typing a value, and the error inside the tile.
- [x] 1.2 The note label of a valid frequency (180 Hz reads "F#3 -47 c"), none for an empty or invalid value. Verify unit tests.

- [x] 1.3 The other seven inputs as uncoloured tiles with a short name (English and French), symbol, value, unit, hint and error; each input keeps its accessible name with its unit. Verify unit tests for the names, symbols, units, French names, the stiffness input without a unit, and the hint and error in the tile.

## 2. Page alignment

- [x] 2.1 "Measure plate" in the frequency group header; plain semibold group headings in inputs and results. Verify the wood unit and e2e tests still pass.
- [ ] 2.2 Run `pnpm check`, mutation testing on the changed components, and `openspec validate --strict`.
