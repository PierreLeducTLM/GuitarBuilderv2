# Proposal

## Why

The tap-tone reader's graph now stops at 600 Hz (`tap-tone-graph-600hz`, archived 2026-11-05), because the modes a luthier reads sit below it. The step measurement graph still runs to 2000 Hz, so the same tap looks squeezed into the left quarter of the plot, at a different scale from the reader that captured it.

## What Changes

- The step spectrum graph's frequency axis runs from 20 to 600 Hz, with labeled grid lines at 50, 100, 200, 300, 400, 500 and 600 Hz, matching the reader.
- Points above 600 Hz are not drawn, and a peak above 600 Hz gets no marker.
- The peak label flips to the left of its marker in the right 15% of the plot, so it stays inside the plot.
- Stored measurements and spectra are unchanged.

## Capabilities

### Modified Capabilities

- `build-sequence`: Spectrum Graph.

## Impact

- `apps/web/src/lib/sequence/spectrum.ts` and `apps/web/src/components/sequence/SpectrumGraph.tsx`, with their tests.
