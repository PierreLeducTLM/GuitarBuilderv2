# Tasks

Every task is test-first: write the failing unit test named in the task, then the code.

## 1. Back near the air octave (`packages/dsp/src/tapTone/body.ts`)

- [x] 1.1 Choose Back as the candidate from f_top + 15 Hz to 400 Hz closest to 2 × f_air (ratio distance, lower wins a tie). Verify unit tests for:
  - air 100, top 150, candidates 170 and 205 Hz: Back is 205 Hz;
  - ratio, not Hz: air 100, top 150, candidates 170 and 232 Hz: Back is 232 Hz (x1.16), though 170 Hz (/1.18) is nearer in Hz;
  - equal ratio distance keeps the lower candidate (air 100, top 140, candidates 160 and 250 Hz: Back is 160 Hz);
  - all candidates above the octave: the lowest still wins (98 / 197 / 248 / 330 Hz: Back is 248 Hz);
  - the existing range, 15 Hz and 400 Hz edge tests and the `body.wav` fixture (98 / 197 / 248 Hz) still pass.
- [x] 1.2 Run mutation testing on `body.ts` and kill the surviving mutants of the new rule. Result: 97.7 %; the three survivors are equivalent (prominence mirror; `>= from`, since a candidate at exactly f_top + 15 Hz already refuses Top; `<= 400`, since candidates stop at the 400 Hz body band).
