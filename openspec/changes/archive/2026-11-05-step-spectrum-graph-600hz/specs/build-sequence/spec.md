## MODIFIED Requirements

### Requirement: Spectrum Graph
The system SHALL draw a stored spectrum as a line graph with these properties:
- a linear frequency axis from 20 to 600 Hz;
- a dB axis from −100 dB at the bottom to 0 dB at the top;
- labelled grid lines at every 20 dB and at 50, 100, 200, 300, 400, 500 and 600 Hz.

Points are plotted in ascending frequency from 20 up to 600 Hz, with dB values clamped to [−100, 0]. A point sits at x = (f − 20) / 580 of the plot width and y = −dB / 100 of the plot height from the top.

#### Scenario: Peak marker
- **WHEN** a measurement with peak 187.4 Hz is graphed
- **THEN** a dashed vertical line is drawn at 187.4 Hz with the label "187.4 Hz"

#### Scenario: Peak beyond the axis
- **WHEN** a measurement with peak 720.4 Hz is graphed
- **THEN** no peak marker is drawn

#### Scenario: Clamping
- **WHEN** a spectrum point has −120 dB
- **THEN** it is drawn on the −100 dB bottom edge
