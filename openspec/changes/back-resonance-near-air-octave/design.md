# Design

## Context

`identifyBodyResonances` (`packages/dsp/src/tapTone/body.ts`) picks each role as the lowest candidate in its range. For Back that range is f_top + 15 Hz to 400 Hz.

## Decisions

1. **Target 2 × f_air, within the existing range.** Back stays above Top (f_top + 15 Hz) and at or below 400 Hz, so the reliability rules and the "Back requires Top" rule hold as before. Within that range the candidate nearest the air octave wins.
2. **Distance as a ratio.** Closeness is |log(f / (2 × f_air))|, so a peak a given number of cents above the octave counts the same as one the same number of cents below it. A tie keeps the lower candidate.
3. **No extra tolerance window.** "About one octave" covers real bodies where T(1,1)3 lies from roughly 1.9 to 2.6 × f_air (the `body.wav` fixture: 98 / 197 / 248 Hz, 2.52 ×). A narrower window would turn those into "Not identified". The user can still move the label by hand.

4. **Prominence over 30 Hz, not 6 points.** A resonance drops 6 dB at an offset of √3 × f / (2Q) from its centre. With 6 points (8.8 Hz) only modes with Q > 22 at 223 Hz passed, which excludes most back modes. With 30 Hz the limit is Q > 6.4 at 223 Hz and Q > 2.9 at 100 Hz. 30 Hz is the neighbourhood the general peak test already uses, and it is in Hz, so it no longer depends on the sample rate. The 6 dB threshold, the 3-point strict maximum, the 30 dB range and the 15 Hz split rule are unchanged; a true split still needs a 6 dB dip between the two peaks.

   On `mobile-body.wav` the wider window also admits a weak 122.2 Hz bump (6.4 dB). It is 18.6 Hz from Air, so it does not trigger the 15 Hz split rule, and it lies below the Top range. Roles: 103.6 / 186.7 / 223.1 Hz. `body.wav` is unchanged (98 / 197 / 248 Hz).

## Effect

When Top is at or above about 1.85 × f_air, every candidate above f_top + 15 Hz is already above the octave, so the nearest one is still the lowest one and nothing changes. The new rule only matters when Top is low, which is the case the owner reported.

## Risks

- A wider window admits more candidates, so a small bump within 15 Hz of a true mode, with a 6 dB dip between them, now makes that role "Not identified" more often. That is the intended "do not guess" behaviour of the reliability rule.
- A strong unrelated peak closer to the octave than the true T(1,1)3 would now win. The 6 dB prominence and 30 dB range filters on candidates still apply, and manual assignment remains the correction path.
