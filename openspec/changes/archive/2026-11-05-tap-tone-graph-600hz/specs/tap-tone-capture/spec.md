## MODIFIED Requirements

### Requirement: Spectrum Graph Axes
The system SHALL show the analyzed spectrum, once analysis completes, as a static line graph with a linear 30-600 Hz frequency axis and a -100 to 0 dB level axis, captioned "Frequency Spectrum" with the hint "Click on a peak to select". Spectrum points above 600 Hz are kept by analysis but not drawn.

#### Scenario: Axes and grid
- **WHEN** results are shown
- **THEN** labeled vertical grid lines appear at 50, 100, 200, 300, 400, 500 and 600 Hz and labeled horizontal grid lines at -100, -80, -60, -40, -20 and 0 dB
- **AND** the spectrum is drawn as a continuous line through all output points between 30 and 600 Hz, with levels outside -100..0 dB drawn at the nearest edge

### Requirement: Peak Markers
The system SHALL mark every detected peak between 30 and 600 Hz on the graph with a vertical line from the peak to the frequency axis, a dot and a "<frequency> Hz" label with one decimal, visually distinguishing the strongest peak, the selected peak and the peak under the pointer. Detected peaks above 600 Hz get no marker.

#### Scenario: Results displayed
- **WHEN** analysis finds peaks at 181.6 Hz (strongest) and 92.8 Hz
- **THEN** markers labeled "181.6 Hz" and "92.8 Hz" are drawn
- **AND** the 181.6 Hz marker is emphasized as selected (solid line, larger dot, bold label) while the other uses a dashed line and small dot

#### Scenario: Peak beyond the axis
- **WHEN** analysis finds peaks at 720.4 Hz (strongest) and 181.6 Hz
- **THEN** only the "181.6 Hz" marker is drawn
- **AND** 720.4 Hz still appears in the Detected Peaks list

### Requirement: Hover Readout and Snap
The system SHALL show the frequency under the pointer on the spectrum graph and SHALL snap to a detected peak drawn on the graph when the pointer's frequency is within 20 Hz of it. The pointer position maps linearly onto 30-600 Hz, clamped to that range. Leaving the graph removes the readout and the snap highlight.

#### Scenario: Pointer near a peak
- **WHEN** the pointer is at 175 Hz and the nearest peak is at 181.6 Hz
- **THEN** the 181.6 Hz marker is highlighted as the snap target (emphasized marker with a ring) and no cursor line is drawn

#### Scenario: Pointer far from peaks
- **WHEN** the pointer is at 600 Hz and the nearest peak is at 410.2 Hz
- **THEN** a vertical cursor line with the label "600.0 Hz" is drawn at the pointer

### Requirement: Peak Selection by Click
The system SHALL select a peak when the user clicks the graph: the snap target if there is one, otherwise the detected peak drawn on the graph closest to the clicked frequency wherever the click lands. A frequency that is not a detected peak cannot be selected in the dialog.

#### Scenario: Click between peaks
- **WHEN** the user clicks the graph at 300 Hz and the detected peaks are 181.6 Hz and 410.2 Hz
- **THEN** 410.2 Hz is selected

#### Scenario: Click near the right edge
- **WHEN** the user clicks the graph at 600 Hz and the detected peaks are 720.4 Hz and 410.2 Hz
- **THEN** 410.2 Hz is selected
