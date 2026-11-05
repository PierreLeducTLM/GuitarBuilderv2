## MODIFIED Requirements

### Requirement: Instrument Body Resonance Candidates
The system SHALL, in Instrument mode, find body resonance candidates in the tap spectrum with fixed settings: strict local maxima over 60-400 Hz within 30 dB of the strongest such maximum, with at least 6 dB prominence against the points within 30 Hz on each side, and 3 bins of spacing. Each candidate's frequency and level are refined per Sub-Bin Peak Refinement and its spectral Q computed per Spectral Q.

#### Scenario: Candidate rules
- **GIVEN** points in 60-400 Hz with levels dB_k in bin order
- **WHEN** candidates are searched
- **THEN** point k qualifies when dB_k is strictly greater than dB_(k-j) and dB_(k+j) for j = 1..3, dB_k >= (strongest qualifying level) - 30 dB, and dB_k - max(L, R) >= 6 dB, where L (R) is the lowest of dB_k and the points below (above) it with |f - f_k| <= 30 Hz
- **AND** scanning from low to high frequency, a point fewer than 3 bins from an accepted candidate is skipped

#### Scenario: Weak peak rejected
- **GIVEN** the strongest candidate between 60 and 400 Hz is at -20 dB
- **WHEN** candidates are found
- **THEN** a peak at -52 dB is not a candidate

#### Scenario: Damped mode accepted
- **GIVEN** a phone recording of an assembled body with resonances at 103.6 Hz, 186.7 Hz and 223.1 Hz, where the 223.1 Hz mode has a spectral Q of about 15 and falls only 2.3 dB within 8.8 Hz but more than 10 dB within 30 Hz
- **WHEN** candidates are found and roles assigned
- **THEN** 223.1 Hz is a candidate and is labelled Back, not the weaker peak at 300.3 Hz

### Requirement: Instrument Body Resonance Assignment
The system SHALL assign the roles Air, T(1,1)1, Top, T(1,1)2, and Back, T(1,1)3, by mode order: Air is the lowest candidate from 70 to 130 Hz; Top the lowest from max(140 Hz, 1.4 x f_air) to 300 Hz; Back the candidate from f_top + 15 Hz to 400 Hz closest to one octave above the air resonance, 2 x f_air, measured as a frequency ratio, the lower one on a tie. Each role's label is drawn on the spectrum at its frequency.

#### Scenario: Typical assembled body
- **GIVEN** candidates at 98.4 Hz, 196.9 Hz and 247.5 Hz, each with a spectral Q
- **WHEN** roles are assigned
- **THEN** Air is 98.4 Hz, Top is 196.9 Hz and Back is 247.5 Hz, and the labels "Air", "Top" and "Back" mark those peaks

#### Scenario: Candidate too close above the air resonance
- **GIVEN** candidates at 110 Hz, 150 Hz, 212 Hz and 262 Hz, each with a spectral Q
- **WHEN** roles are assigned
- **THEN** Air is 110 Hz, Top is 212 Hz (150 Hz is below 1.4 x 110 = 154 Hz) and Back is 262 Hz

#### Scenario: Back near the air octave rather than just above Top
- **GIVEN** candidates at 100 Hz, 150 Hz, 170 Hz and 205 Hz, each with a spectral Q
- **WHEN** roles are assigned
- **THEN** Air is 100 Hz, Top is 150 Hz and Back is 205 Hz, the candidate above Top nearest 2 x 100 = 200 Hz, not 170 Hz
