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

## ADDED Requirements

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
