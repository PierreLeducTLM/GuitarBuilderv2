# Spec Delta

## MODIFIED Requirements

### Requirement: Step Measurement Capture
The system SHALL offer an "Add Analysis" action in a step's Sound Analysis section. The action opens the tap-tone capture (`tap-tone-capture`) in Instrument mode, labelled "Analysis for <step label>". When the user confirms, the system asks for a description in a dialog titled "Description", pre-filled with "Resonance Analysis". Save is disabled while the text is blank, and the text is trimmed. Cancel discards the measurement.

#### Scenario: Attach a measurement
- **WHEN** the user records taps on "Tap test panels", confirms the main peak at 187.4 Hz with no body role identified, and saves the description "Back plate free"
- **THEN** a measurement "Back plate free" with peak 187.4 Hz and no roles is listed under Sound Analysis

#### Scenario: Attach a body measurement
- **WHEN** the user records taps on the bridge of a closed box, confirms with Air 98.4 Hz, Top 196.9 Hz and Back 247.5 Hz, and saves "Box closed"
- **THEN** a measurement "Box closed" is listed with its main peak and the three roles

#### Scenario: Description cancelled
- **WHEN** the user confirms a capture but cancels the description dialog
- **THEN** no measurement is attached to the step

### Requirement: Step Measurement Record
The system SHALL store each attached measurement in its step with: a unique identifier; the recording time in milliseconds since the epoch; the description; the main peak frequency in Hz; the captured spectrum record; and optionally the identified body roles. A capture without a spectrum is not attached. Measurements stored without roles remain valid.

#### Scenario: Stored spectrum range
- **WHEN** a measurement is attached
- **THEN** its stored spectrum holds frequencies (Hz), linear magnitudes, magnitudes (dB), sample rate (Hz), FFT size (samples) and bin width (Hz), and contains no frequency above 2000 Hz
- **AND** the frequency, linear magnitude and dB lists have the same length

#### Scenario: Stored roles
- **WHEN** a measurement with body roles is attached
- **THEN** its roles hold at most one each of air, top and back, each with frequency (Hz, 30 to 1000), level (dB), spectral Q (a number above 0, or none), decay Q (a number above 0, or none) and origin ("auto" or "user")

#### Scenario: Malformed roles refused
- **WHEN** a modified client attaches a measurement whose roles contain "side", or a top frequency of 1500 Hz, or a spectral Q of 0
- **THEN** the step change is refused, the step keeps its earlier measurements, and the user sees "Failed to save changes"

### Requirement: Step Measurement List
The system SHALL list a step's measurements in the order they were added, or show "No sound analysis recorded." when there are none. Each entry shows the description, the local date and time, "Peak: <frequency> Hz" with one decimal, the identified roles if any, and the spectrum graph. Clicking a description opens an "Edit Description" dialog pre-filled with the current text, and Save stores the trimmed new text.

#### Scenario: Edit a description
- **WHEN** the user clicks the description "Resonance Analysis" and saves "Top after bracing"
- **THEN** the measurement is listed as "Top after bracing" and the change is persisted

#### Scenario: Peak formatting
- **WHEN** a measurement with peak 98.25 Hz is listed
- **THEN** it shows "Peak: 98.3 Hz"

#### Scenario: Roles shown
- **WHEN** a measurement has Air 98.41 Hz and Top 196.94 Hz and no Back
- **THEN** it shows "Air 98.4 Hz · Top 196.9 Hz" under the peak, in the user's language ("Air 98,4 Hz · Table 196,9 Hz" in French)

#### Scenario: Measurement without roles
- **WHEN** a measurement stored before body roles existed is listed
- **THEN** it shows its description, date, peak and graph, and no roles line

### Requirement: Spectrum Graph
The system SHALL draw a stored spectrum as a line graph with these properties:
- a linear frequency axis from 20 to 2000 Hz;
- a dB axis from −100 dB at the bottom to 0 dB at the top;
- labelled grid lines at every 20 dB and at 100, 250, 500, 750, 1000, 1500 and 2000 Hz.

Points are plotted in ascending frequency up to 2000 Hz, with dB values clamped to [−100, 0]. A point sits at x = (f − 20) / 1980 of the plot width and y = −dB / 100 of the plot height from the top.

#### Scenario: Peak marker
- **WHEN** a measurement with peak 187.4 Hz is graphed
- **THEN** a dashed vertical line is drawn at 187.4 Hz with the label "187.4 Hz"

#### Scenario: Clamping
- **WHEN** a spectrum point has −120 dB
- **THEN** it is drawn on the −100 dB bottom edge
