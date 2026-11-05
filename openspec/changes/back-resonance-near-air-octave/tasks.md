# Tasks

Every task is test-first: write the failing unit test named in the task, then the code.

## 1. Back near the air octave (`packages/dsp/src/tapTone/body.ts`)

- [x] 1.1 Choose Back as the candidate from f_top + 15 Hz to 400 Hz closest to 2 × f_air (ratio distance, lower wins a tie). Verify unit tests for:
  - air 100, top 150, candidates 170 and 205 Hz: Back is 205 Hz;
  - ratio, not Hz: air 100, top 150, candidates 170 and 232 Hz: Back is 232 Hz (x1.16), though 170 Hz (/1.18) is nearer in Hz;
  - equal ratio distance keeps the lower candidate (air 100, top 140, candidates 160 and 250 Hz: Back is 160 Hz);
  - all candidates above the octave: the lowest still wins (98 / 197 / 248 / 330 Hz: Back is 248 Hz);
  - the existing range, 15 Hz and 400 Hz edge tests and the `body.wav` fixture (98 / 197 / 248 Hz) still pass.
- [x] 1.2 Measure the 6 dB candidate prominence against the points within 30 Hz on each side (`BODY_PROMINENCE_HZ = 30`, replacing `BODY_PROMINENCE_POINTS = 6`). Verify unit tests for:
  - a 6 dB dip exactly 30 Hz away is enough, 5.9 dB is not, and a dip 31 Hz away does not count;
  - a dip on one side only, below or above, is not enough;
  - a damped Back (Q 15 at 223 Hz) between a Top at 187 Hz and a peak at 300 Hz is labelled Back;
  - end to end, `mobile-body.wav` (phone) gives 103.6 / 186.7 / 223.1 Hz.
- [x] 1.3 Run mutation testing on `body.ts` and kill the surviving mutants of the new rules. Result: 96.6 %, then the one-sided-dip test was split into below and above to kill `lowest(-1)` → `lowest(+1)`. The four remaining survivors are equivalent: `points[i]?.` (i is always in range); `offset >= 0` (the point itself is already in the minimum); `>= from` (a candidate at exactly f_top + 15 Hz already refuses Top); `<= 400` (candidates stop at the 400 Hz body band).
