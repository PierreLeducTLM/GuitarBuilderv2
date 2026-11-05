# Spec Delta

## MODIFIED Requirements

### Requirement: Wood Panel Data
The system SHALL persist each saved panel with: owner (user); name (required text); sample length, width and thickness (mm); sample mass (g); longitudinal, cross-grain and diagonal frequencies (Hz); target plate length and width (mm); vibrational stiffness parameter (dimensionless, default 75); optional per-field spectra; creation timestamp and last-update timestamp.

#### Scenario: Last-update timestamp
- **WHEN** the user updates a loaded panel
- **THEN** that panel's last-update timestamp is set to the time of the update and its creation timestamp is unchanged

#### Scenario: Invalid data refused by the server
- **WHEN** a client, bypassing the calculator, saves a panel whose name is blank, whose ten inputs are not all finite numbers greater than 0, or whose spectra are not keyed by the three frequency fields or fail Spectrum Record Validation (`tap-tone-capture`)
- **THEN** the server refuses the save and nothing is stored
- **AND** the calculator shows "Failed to save wood panel. Please try again."

### Requirement: PDF Report Download
The system SHALL offer, on the loaded panel's library entry, a "PDF" action that shows "Generating PDF report...", obtains an AI wood analysis of the current values, then downloads a PDF report named `<panel name>_<YYYY-MM-DD>.pdf` (current date) and shows "PDF downloaded successfully!". If the analysis cannot be obtained the report SHALL still be produced without the "AI Analysis" section; if the PDF cannot be produced it SHALL show "Failed to generate PDF. Please try again.".

#### Scenario: Downloading a report
- **GIVEN** the panel "Sitka #3" is loaded on 2026-03-14
- **WHEN** the user activates "PDF"
- **THEN** "Generating PDF report..." is shown
- **AND** a file named "Sitka #3_2026-03-14.pdf" is downloaded
- **AND** "PDF downloaded successfully!" is shown

#### Scenario: Analysis unavailable during report generation
- **WHEN** the AI analysis cannot be obtained while generating the report
- **THEN** the report is still downloaded, without the "AI Analysis" section

#### Scenario: Report generation failure
- **WHEN** the PDF itself cannot be produced
- **THEN** "Failed to generate PDF. Please try again." is shown

#### Scenario: File name characters and date
- **GIVEN** the loaded panel is named "Sitka 3/4: top" and the user's local date is 2026-03-14, while the UTC date is already 2026-03-15
- **WHEN** the user activates "PDF"
- **THEN** the file is named "Sitka 3-4- top_2026-03-14.pdf": each of the characters / \ : * ? " < > | and each control character in the name is replaced by "-", and the date is the user's local date

### Requirement: Tap-Tone Capture for Frequency Fields
The system SHALL offer under "Frequency Measurements" one "Measure plate" action that opens the tap-tone capture (see `tap-tone-capture`) in Plate mode, passing the three fields' current values and stored spectra. Confirming SHALL write each measured mode's frequency into its field rounded to 1 decimal, recompute the results once and keep that mode's spectrum for its field. Modes not measured, and cancelling, SHALL leave their fields unchanged.

#### Scenario: Accepting a captured frequency
- **WHEN** the user measures the plate, only the Cross-grain take is recorded, it selects 104.87 Hz and the user confirms
- **THEN** the Cross-grain field shows 104.9 and the results are recalculated
- **AND** the spectrum of the Cross-grain take is kept as the cross-grain spectrum of the current panel
- **AND** the Longitudinal and Diagonal fields keep their values

#### Scenario: Measuring the three modes at once
- **WHEN** the Longitudinal, Cross-grain and Diagonal takes select 181.82 Hz, 92.71 Hz and 120.44 Hz and the user confirms
- **THEN** the fields show 181.8, 92.7 and 120.4 and the results are recalculated

#### Scenario: Capture labels
- **WHEN** the user activates "Measure plate"
- **THEN** the capture opens in Plate mode labelled "Plate measurement", with the takes "Longitudinal (f_L)", "Cross-grain (f_C)" and "Diagonal (f_LC)", each showing its field's current value

#### Scenario: Cancelling a capture
- **WHEN** the user measures the plate and cancels
- **THEN** the three frequency fields keep their previous values

### Requirement: Tap-Tone Spectrum Storage
The system SHALL save with each panel the most recently accepted spectrum for each of the three frequency fields, as the Tap-Tone Spectrum Record returned by the capture (see `tap-tone-capture`): bin frequencies (Hz), linear magnitudes, magnitudes in dB, sample rate (Hz), transform size (samples) and bin width (Hz), at or below 2000 Hz. A panel MAY have spectra for none, some or all three fields; spectra are deleted with their panel. Q values are not saved.

#### Scenario: Spectrum saved with the panel
- **GIVEN** the user measured only the longitudinal mode with "Measure plate" and typed the other two frequencies
- **WHEN** the user saves the panel
- **THEN** the panel stores a longitudinal spectrum of the 662 points from 30.8 Hz to 999.0 Hz returned by the capture, and no cross-grain or diagonal spectrum
- **AND** no spectral or decay Q is stored

### Requirement: Tap-Tone Spectrum Review
The system SHALL restore a panel's stored spectra when the panel is loaded. Measuring the plate SHALL open each take that has a stored spectrum on that spectrum, with its peaks and the peak nearest the field's current value preselected (see `tap-tone-capture`), instead of an empty recording; a take without a stored spectrum SHALL open ready to record.

#### Scenario: Re-viewing a saved spectrum
- **GIVEN** a panel was saved after measuring its longitudinal mode
- **WHEN** the user later loads that panel and activates "Measure plate"
- **THEN** the Longitudinal take shows the previously recorded spectrum without recording again

#### Scenario: Field without a stored spectrum
- **GIVEN** a loaded panel whose diagonal frequency was typed by hand
- **WHEN** the user activates "Measure plate" and switches to the Diagonal take
- **THEN** the take is empty, ready to record

## ADDED Requirements

### Requirement: Measured Q Display
The system SHALL show, under each frequency field confirmed from a plate measurement in the current session, that mode's spectral Q and decay Q with no decimals, or "—" when missing. These values SHALL NOT be saved; they SHALL be cleared when the field is edited by hand, when a panel is loaded, on reset and on deselect.

#### Scenario: Q after a measurement
- **WHEN** the user confirms a Longitudinal take with spectral Q 64.3 and decay Q 71.8
- **THEN** "Spectral Q 64 · Decay Q 72" is shown under the Longitudinal field

#### Scenario: Missing decay Q
- **WHEN** the confirmed Cross-grain take has spectral Q 41.2 and no decay Q
- **THEN** "Spectral Q 41 · Decay Q —" is shown under the Cross-grain field

#### Scenario: Q cleared
- **GIVEN** Q values are shown under the Longitudinal field
- **WHEN** the user types a new longitudinal frequency, loads a panel, resets or deselects
- **THEN** no Q values are shown under that field

#### Scenario: Loaded panel
- **WHEN** the user loads a panel saved with three measured spectra
- **THEN** no Q values are shown

### Requirement: Library Load Failures
The system SHALL show "Failed to load wood panels" in the library area, instead of the list, the empty state and "Load Default Panels", when the user's panels cannot be loaded. When one panel cannot be opened, the system SHALL show "Failed to load wood panel" and leave the calculator and the selection unchanged.

#### Scenario: Library cannot be read
- **GIVEN** the server fails while the calculator page loads the user's panels
- **WHEN** the page is shown
- **THEN** the library area shows "Failed to load wood panels"
- **AND** neither "No saved wood panels yet" nor "Load Default Panels" is shown

#### Scenario: Panel deleted in another tab
- **GIVEN** "Sitka #3" is listed, but was deleted in another browser tab
- **WHEN** the user clicks the "Sitka #3" entry
- **THEN** "Failed to load wood panel" is shown, the inputs keep their values and no entry is marked "Currently editing"

### Requirement: Load Default Panels Feedback
The system SHALL show "Loading..." on the "Load Default Panels" action and disable it while the copy runs, SHALL report a failure with "Failed to load default panels" and leave the library unchanged, and SHALL show "No default panels are available yet" when the reference set is empty. The copy SHALL happen at most once, even when the action is triggered from two tabs at the same time.

#### Scenario: Copy in progress
- **WHEN** the user activates "Load Default Panels"
- **THEN** the action reads "Loading..." and is disabled until the library has been refreshed

#### Scenario: Copy fails
- **WHEN** the server fails during the copy
- **THEN** "Failed to load default panels" is shown and the library is still empty

#### Scenario: No reference panels
- **GIVEN** the reference set is empty
- **WHEN** the user activates "Load Default Panels"
- **THEN** "No default panels are available yet" is shown and the library stays empty

#### Scenario: Two tabs at once
- **GIVEN** a user with an empty library and a reference set of 5 panels, with the calculator open in two tabs
- **WHEN** the user activates "Load Default Panels" in both tabs at the same time
- **THEN** the library holds exactly 5 panels
