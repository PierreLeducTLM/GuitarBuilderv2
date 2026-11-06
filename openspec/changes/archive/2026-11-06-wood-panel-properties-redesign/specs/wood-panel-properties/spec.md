## MODIFIED Requirements

### Requirement: Frequency Inputs
The system SHALL offer, under "Frequency Measurements", three inputs in Hz with these defaults: Longitudinal (f_L), default 180; Cross-grain (f_C), default 90; Diagonal (f_LC), default 120. f_L is the first bending mode along the grain, f_C the first bending mode across the grain and f_LC the first twisting mode of the sample. Each input SHALL be a tile in its take's slot colour from the tap-tone reader, with the take's name and symbol, the editable value and the note of a valid value.

#### Scenario: Frequency defaults
- **WHEN** the user opens the calculator
- **THEN** the frequency inputs show 180 Hz, 90 Hz and 120 Hz

#### Scenario: Tiles match the reader
- **WHEN** the user opens the calculator
- **THEN** the tiles read, in order, "Longitudinal" f_L in blue, "Cross-grain" f_C in mint and "Diagonal" f_LC in pink, the same names and colours as the reader's Plate mode takes

#### Scenario: Note label
- **WHEN** the longitudinal frequency is 180 Hz
- **THEN** its tile shows "F#3 -47 c" under the value

#### Scenario: No note for an invalid value
- **WHEN** the user clears the cross-grain frequency
- **THEN** its tile shows no note label and the validation message

### Requirement: Numeric Entry
The system SHALL accept decimal values (increment 0.1) in every input, show each input's symbol and unit in its label, and treat an empty or non-numeric entry as missing (zero), displaying the field empty. Each input SHALL be shown as a tile with a short name, its symbol, the editable value and its unit; only the frequency tiles are coloured.

#### Scenario: Clearing a field
- **WHEN** the user deletes the content of the Sample Mass field
- **THEN** the field is shown empty and is treated as missing for validation

#### Scenario: Sample tiles
- **WHEN** the user opens the calculator
- **THEN** the sample measurements show four tiles, "Length" L 280 mm, "Width" W 70 mm, "Thickness" h 3.0 mm and "Mass" m 25 g
