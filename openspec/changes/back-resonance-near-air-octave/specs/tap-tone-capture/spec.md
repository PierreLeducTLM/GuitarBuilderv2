## MODIFIED Requirements

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
