# Proposal

## Why

In Instrument mode the detector labels three body resonances: Air, T(1,1)1; Top, T(1,1)2; and Back, T(1,1)3. The owner reports that Back is often wrong. Today Back is the lowest candidate from f_top + 15 Hz to 400 Hz, so it ignores where T(1,1)3 is expected to be. On an assembled guitar T(1,1)3 sits above T(1,1)2 and about one octave above T(1,1)1. When Top is low, the detector picks a peak just above Top instead of the one near twice the air frequency.

A phone recording of an assembled body (5 Nov 2026, now the `mobile-body.wav` fixture) shows a second fault. The owner reads T(1,1)1, T(1,1)2 and T(1,1)3 at 103.6, 186.7 and 223.1 Hz, but the detector labels Back at 300.3 Hz. The 223.1 Hz mode is the second-strongest peak in the spectrum, but it is damped (spectral Q about 15). Its level falls only 2.3 dB within the 6 bins (8.8 Hz at 48 kHz) the candidate test looks at, short of the 6 dB needed, so it never becomes a candidate. That window turns away any mode whose Q is below about 22 at 223 Hz, or about 10 at 100 Hz.

## What Changes

- **Back follows the air octave (`tap-tone-capture`).** Back is the candidate from f_top + 15 Hz to 400 Hz closest to 2 × f_air, measured as a frequency ratio, instead of the lowest one in that range. On a tie the lower candidate wins.
- **Damped modes become candidates (`tap-tone-capture`).** The 6 dB prominence of a body resonance candidate is measured against the points within 30 Hz on each side, the same neighbourhood the general peak test uses, instead of the 6 nearest points. This accepts modes down to a Q of about 6.4 at 223 Hz.
- Air and Top assignment, the reliability rules and manual role assignment are unchanged.

## Capabilities

### Modified Capabilities

- `tap-tone-capture`: Instrument Body Resonance Candidates; Instrument Body Resonance Assignment.

## Impact

- `packages/dsp/src/tapTone/body.ts`, its constants and unit tests; a new end-to-end fixture `apps/web/e2e/fixtures/mobile-body.wav`.
- No database, API, UI or translation changes. Roles already saved on measurements are not recomputed.
