# Proposal

## Why

In Instrument mode the detector labels three body resonances: Air, T(1,1)1; Top, T(1,1)2; and Back, T(1,1)3. The owner reports that Back is often wrong. Today Back is the lowest candidate from f_top + 15 Hz to 400 Hz, so it ignores where T(1,1)3 is expected to be. On an assembled guitar T(1,1)3 sits above T(1,1)2 and about one octave above T(1,1)1. When Top is low, the detector picks a peak just above Top instead of the one near twice the air frequency.

## What Changes

- **Back follows the air octave (`tap-tone-capture`).** Back is the candidate from f_top + 15 Hz to 400 Hz closest to 2 × f_air, measured as a frequency ratio, instead of the lowest one in that range. On a tie the lower candidate wins.
- Air and Top assignment, the reliability rules and manual role assignment are unchanged.

## Capabilities

### Modified Capabilities

- `tap-tone-capture`: Instrument Body Resonance Assignment.

## Impact

- `packages/dsp/src/tapTone/body.ts` and its unit tests.
- No database, API, UI or translation changes. Roles already saved on measurements are not recomputed.
