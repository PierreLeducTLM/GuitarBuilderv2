# Proposal

## Why

The tap-tone spectrum graph runs from 30 to 1000 Hz, but the modes a luthier reads on a plate or a guitar body (air, top, back and the first plate modes) sit well below 600 Hz. The top 400 Hz of the graph is empty space that squeezes the part that matters.

## What Changes

- The spectrum graph's frequency axis runs from 30 to 600 Hz, with labeled grid lines at 50, 100, 200, 300, 400, 500 and 600 Hz.
- The trace stops at 600 Hz. Peaks above 600 Hz get no marker and cannot be picked on the graph. They are still detected and still appear in the Detected Peaks list.
- The pointer readout maps onto 30-600 Hz.
- Analysis does not change: the spectrum is still kept and searched for peaks between 30 and 1000 Hz.

## Capabilities

### Modified Capabilities

- `tap-tone-capture`: Spectrum Graph Axes, Peak Markers, Hover Readout and Snap, Peak Selection by Click.

## Impact

- `apps/web/src/lib/tap-tone/graph.ts` and `apps/web/src/components/tap-tone/TapToneSpectrum.tsx`, with their tests.
- Every place that shows the reader's graph (the reader itself, wood panel spectrum review) gets the narrower axis. Stored spectra are unchanged.
