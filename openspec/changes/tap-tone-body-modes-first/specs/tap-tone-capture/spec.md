## ADDED Requirements

### Requirement: Body Mode Labels
The system SHALL, in Instrument mode, draw each identified body mode in its own colour (Air blue, Top mint, Back pink): a dot with a halo on its peak and a chip "<Role> <frequency>" (one decimal) in a band above the plot, joined to the peak by a leader line. The chips sit on one row at a fixed on-screen size, never overlap each other and never leave the plot.

#### Scenario: Modes far apart
- **GIVEN** Air at 98.4 Hz, Top at 196.9 Hz and Back at 247.5 Hz on a desktop-width graph
- **WHEN** results are shown
- **THEN** chips "Air 98.4", "Top 196.9" and "Back 247.5" are drawn, each centred over its peak where it does not touch another

#### Scenario: Close modes on a phone
- **GIVEN** Air at 103.4 Hz, Top at 186.7 Hz and Back at 220.8 Hz on a 358 px wide graph
- **WHEN** results are shown
- **THEN** the three chips stay in the order Air, Top, Back, at least 6 px apart and inside the plot, each leader line ending on its own peak

#### Scenario: Label placement rule
- **GIVEN** chips of width w and a gap g, each wanting to be centred at its peak x_i, sorted by x_i
- **WHEN** chips are placed
- **THEN** neighbouring chips that would be closer than g form a cluster laid out edge to edge g apart, centred on the mean of its members' x_i and shifted inside the plot; clusters merge until none touch

#### Scenario: Plate mode
- **WHEN** the dialog is in Plate mode
- **THEN** no chip band and no body mode colours are drawn

### Requirement: Body Mode Readouts
The system SHALL, in Instrument mode, show under the graph one tile per body mode in the order Air, Top, Back, with the mode's colour, name and number (T(1,1)1, T(1,1)2, T(1,1)3), frequency (one decimal, "Hz"), note label, spectral Q and decay Q (no decimals, "—" when missing) and "set by you" for a mode the user set. A mode not identified shows "—" and "Not identified".

#### Scenario: Three modes found
- **GIVEN** Air at 103.4 Hz with spectral Q 26.2 and decay Q 31.4, set automatically
- **WHEN** results are shown
- **THEN** the Air tile reads "Air", "T(1,1)₁", "103.4 Hz", "Ab2 -7 c", spectral Q "26" and decay Q "31", without "set by you"

#### Scenario: Back not identified
- **WHEN** Back is not identified
- **THEN** the Back tile shows "—" and "Not identified" and no Back chip is drawn on the graph

#### Scenario: Spotlight a mode
- **WHEN** the user chooses the Top tile
- **THEN** the tile is shown as pressed, Air and Back are dimmed on the graph, and Move and Clear actions for Top appear under the tiles
- **AND** choosing the Top tile again removes the spotlight and the actions

## MODIFIED Requirements

### Requirement: Peak Markers
The system SHALL mark every detected peak between 30 and 600 Hz on the graph, visually distinguishing the strongest peak, the selected peak and the peak under the pointer. In Plate mode each marker has a vertical line, a dot and a "<frequency> Hz" label (one decimal). In Instrument mode a peak that is not selected and not under the pointer is a small dot with no label, the selected peak gets a ring, and a body mode's chip stands in for its peak's label. Peaks above 600 Hz get no marker.

#### Scenario: Results displayed
- **WHEN** analysis finds peaks at 181.6 Hz (strongest) and 92.8 Hz
- **THEN** markers labeled "181.6 Hz" and "92.8 Hz" are drawn
- **AND** the 181.6 Hz marker is emphasized as selected (solid line, larger dot, bold label) while the other uses a dashed line and small dot

#### Scenario: Peak beyond the axis
- **WHEN** analysis finds peaks at 720.4 Hz (strongest) and 181.6 Hz
- **THEN** only the "181.6 Hz" marker is drawn
- **AND** 720.4 Hz still appears in the Detected Peaks list

#### Scenario: Quiet markers in Instrument mode
- **GIVEN** Instrument mode with peaks at 186.7 Hz (selected), 103.4 Hz and 412.0 Hz
- **WHEN** results are shown and the pointer is away from the graph
- **THEN** only the 186.7 Hz marker has a "<frequency> Hz" label and a ring; 103.4 Hz and 412.0 Hz are dots without a label
- **AND** moving the pointer within 20 Hz of 412.0 Hz shows its "412.0 Hz" label

### Requirement: Selected Frequency Display
The system SHALL show the selected peak's frequency (one decimal, "Hz"), level (dB, one decimal), note label, spectral Q and decay Q (no decimals), with "—" for a missing value and the reason for a missing Q. In Plate mode this is the "Detected Frequency" panel, with a "Current Value" panel (two decimals) when the caller supplied one. In Instrument mode it heads the "Main frequency" section.

#### Scenario: Compare with the existing value
- **GIVEN** the wood calculator's longitudinal field holds 180
- **WHEN** a Longitudinal take selects a peak refined to 181.82 Hz at -19.9 dB with spectral Q 64.3 and decay Q 71.8
- **THEN** "Current Value" shows "180.00 Hz" and "Detected Frequency" shows "181.8" Hz, peak level "-19.9 dB", "F#3 -30 c", spectral Q "64" and decay Q "72"

#### Scenario: Saved spectrum has no decay Q
- **WHEN** the take shows a saved spectrum record
- **THEN** "Decay Q" shows "—" with the reason "Needs the recording; record the take again to measure it"

#### Scenario: Main peak is a body mode
- **GIVEN** Instrument mode with Top at 186.7 Hz
- **WHEN** the 186.7 Hz peak is selected
- **THEN** "Main frequency" shows "186.7" Hz and "Same peak as Top"

### Requirement: Detected Peaks List
The system SHALL list, when more than one peak is detected, the first 5 peaks by level as buttons labeled "<frequency> Hz" with one decimal, the first suffixed "(highest)": under "Detected Peaks" in Plate mode, inside the "Main frequency" section in Instrument mode. Clicking a button selects that peak and the selected button is highlighted.

#### Scenario: Choose the second peak
- **GIVEN** detected peaks 181.6 Hz (strongest) and 92.8 Hz
- **WHEN** the user clicks the "92.8 Hz" button
- **THEN** 92.8 Hz becomes the selected peak

#### Scenario: Single peak
- **WHEN** only one peak is detected
- **THEN** no list of peak buttons is shown

### Requirement: Instrument Body Resonance Assignment
The system SHALL assign the roles Air, T(1,1)1, Top, T(1,1)2, and Back, T(1,1)3, by mode order: Air is the lowest candidate from 70 to 130 Hz; Top the lowest from max(140 Hz, 1.4 x f_air) to 300 Hz; Back the candidate from f_top + 15 Hz to 400 Hz closest to one octave above the air resonance, 2 x f_air, measured as a frequency ratio, the lower one on a tie. Each role is drawn on the spectrum per Body Mode Labels.

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

### Requirement: Instrument Body Resonance Reliability
The system SHALL report a role as not identified, rather than guess, when no candidate lies in its range, when the chosen candidate has no spectral Q, or when another candidate lies within 15 Hz of it. Top requires an identified Air and Back requires an identified Top. A role that is not identified shows "Not identified" in its body mode readout.

#### Scenario: Free plate on a build step
- **GIVEN** a free-plate spectrum with candidates at 152 Hz and 233 Hz only
- **WHEN** roles are assigned
- **THEN** Air, Top and Back are all not identified, and the user can still select and confirm a main peak

#### Scenario: Split peak
- **GIVEN** air-range candidates at 96 Hz and 108 Hz
- **WHEN** roles are assigned
- **THEN** Air is not identified, and neither are Top and Back

### Requirement: Manual Role Assignment
The system SHALL let the user, in Instrument mode, set a role to any detected peak or clear it, by dragging the role's chip onto a peak or, with keyboard or touch, by choosing the role's readout, then Move and a peak, or Clear. A role set this way is marked as set by the user and is no longer changed by automatic assignment until the take is re-recorded.

#### Scenario: Correct the Top label
- **GIVEN** Top was assigned automatically to 212.0 Hz and a peak exists at 204.6 Hz
- **WHEN** the user drags the "Top" chip onto the 204.6 Hz peak
- **THEN** Top becomes 204.6 Hz with that peak's level, spectral Q and decay Q, and its readout marks it "set by you"

#### Scenario: Move with touch or keyboard
- **WHEN** the user chooses the Top readout, then Move, then the 204.6 Hz peak
- **THEN** Top becomes 204.6 Hz, set by the user

#### Scenario: Clear a role
- **WHEN** the user chooses the Back readout and then Clear
- **THEN** Back shows "Not identified" and is not returned on Confirm

#### Scenario: Excluding a tap keeps manual roles
- **GIVEN** the user set Top to 204.6 Hz
- **WHEN** the user excludes a tap and the spectrum is recomputed
- **THEN** Top stays on the detected peak nearest 204.6 Hz within 3 Hz, or becomes "Not identified" if there is none
