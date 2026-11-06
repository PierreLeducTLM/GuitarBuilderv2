# wood-panel-properties Specification

## Purpose
The wood panel (tonewood) properties calculator lets a signed-in luthier enter the dimensions, mass and three tap-tone frequencies of a wood sample, and instantly see its density, elastic constants, the recommended thickness for a target guitar plate and that plate's estimated mass. Users can save measured panels to a personal library, reload and update them, start from a shared set of reference panels, keep the recorded tap-tone spectra with each panel, ask the assistant for an AI analysis of a panel and download a PDF report.

## Requirements

### Requirement: Calculator Access
The system SHALL provide the wood panel calculator as a page of the signed-in application, reachable from the main navigation entry "Wood Props" and at the bookmarkable path `/wood-properties`; visitors who are not signed in SHALL see the sign-in screen instead. The page has three areas: "Input Measurements", "Calculated Results" (outputs and save form) and "Saved Wood Panels" (the user's library).

#### Scenario: Signed-in user opens the calculator
- **GIVEN** a signed-in user
- **WHEN** the user selects "Wood Props" in the navigation or opens `/wood-properties`
- **THEN** the calculator page is shown with the input, results and saved-panels areas

#### Scenario: Anonymous visitor
- **WHEN** a visitor who is not signed in opens `/wood-properties`
- **THEN** the sign-in screen is shown instead of the calculator

### Requirement: Sample Measurement Inputs
The system SHALL offer, under "Sample Measurements", four inputs with these units and defaults: Sample Length (L) in mm, default 280; Sample Width (W) in mm, default 70; Sample Thickness (h) in mm, default 3.0; Sample Mass (m) in grams, default 25. L is the dimension along the grain and W the dimension across the grain.

#### Scenario: Sample defaults
- **WHEN** the user opens the calculator
- **THEN** the sample inputs show 280 mm, 70 mm, 3.0 mm and 25 grams

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

### Requirement: Target Plate and Stiffness Inputs
The system SHALL offer, under "Target Plate Dimensions", Plate Length (a) in mm, default 500, and Plate Width (b) in mm, default 380; and, under "Vibrational Stiffness", Parameter (f), dimensionless, default 75, with the hint "Typical value: 75".

#### Scenario: Target defaults
- **WHEN** the user opens the calculator
- **THEN** the plate inputs show 500 mm and 380 mm and the stiffness parameter shows 75 with the hint "Typical value: 75"

### Requirement: Numeric Entry
The system SHALL accept decimal values (increment 0.1) in every input, show each input's symbol and unit in its label, and treat an empty or non-numeric entry as missing (zero), displaying the field empty. Each input SHALL be shown as a tile with a short name, its symbol, the editable value and its unit; only the frequency tiles are coloured.

#### Scenario: Clearing a field
- **WHEN** the user deletes the content of the Sample Mass field
- **THEN** the field is shown empty and is treated as missing for validation

#### Scenario: Sample tiles
- **WHEN** the user opens the calculator
- **THEN** the sample measurements show four tiles, "Length" L 280 mm, "Width" W 70 mm, "Thickness" h 3.0 mm and "Mass" m 25 g

### Requirement: Input Validation
The system SHALL require every input to be a number strictly greater than 0 and, for each failing input, show a message under that field reading "<Field> must be greater than 0" and highlight the field as invalid. The field names used in the messages are: Sample length, Sample width, Sample thickness, Sample mass, Longitudinal frequency, Cross-grain frequency, Diagonal frequency, Target plate length, Target plate width, Vibrational stiffness parameter.

#### Scenario: Zero sample length
- **WHEN** the user sets Sample Length to 0
- **THEN** "Sample length must be greater than 0" appears under the field

#### Scenario: Negative stiffness parameter
- **WHEN** the user sets the vibrational stiffness parameter to -5
- **THEN** "Vibrational stiffness parameter must be greater than 0" appears under the field

#### Scenario: Error clears when fixed
- **GIVEN** Sample Length shows a validation error
- **WHEN** the user enters 300
- **THEN** the error disappears and the results are displayed again

### Requirement: Results Hidden While Invalid
The system SHALL, while any input is invalid, hide all computed results and the save form and show "Please fix input errors to see results" in the results area.

#### Scenario: Invalid input hides results
- **WHEN** any input fails validation
- **THEN** the results area shows "Please fix input errors to see results" and no computed values or save form

### Requirement: Real-Time Recalculation
The system SHALL recompute and redisplay all outputs immediately whenever any input changes, without a separate "calculate" action, whenever all inputs are valid.

#### Scenario: Editing a dimension updates results
- **WHEN** the user changes Sample Length to 300, Width to 80, Thickness to 3.5 and Mass to 30
- **THEN** the displayed density becomes 357.1 kg/m³ without any further action

### Requirement: Density Calculation
The system SHALL compute the sample density as `rho = m / (L * W * h)`, where m is the sample mass in kg (grams x 0.001) and L, W, h are the sample length, width and thickness in metres (mm / 1000); rho is in kg/m³. Equivalently `rho [kg/m³] = m[g] / (L[mm] * W[mm] * h[mm]) * 10^6`.

#### Scenario: Default density
- **WHEN** the inputs are at their defaults (25 g, 280 x 70 x 3.0 mm)
- **THEN** the density is shown as 425.2 kg/m³

#### Scenario: Unit-cube check
- **WHEN** the sample is 100 g and 100 x 100 x 10 mm
- **THEN** the density is 1000 kg/m³

### Requirement: Longitudinal Young's Modulus
The system SHALL compute the Young's modulus along the grain as `E_L = 0.94146 * rho * L^4 * f_L^2 / h^2`, in pascals, with rho in kg/m³, sample length L and thickness h in metres and f_L in Hz, and SHALL display it in GPa (Pa / 10^9) labelled "Young's Modulus (Longitudinal)" as "E_L = <value> GPa".

#### Scenario: Default longitudinal modulus
- **WHEN** the inputs are at their defaults
- **THEN** E_L is shown as 8.86 GPa

### Requirement: Cross-Grain Young's Modulus
The system SHALL compute the Young's modulus across the grain as `E_C = 0.94146 * rho * W^4 * f_C^2 / h^2`, in pascals, with rho in kg/m³, sample width W (across the grain) and thickness h in metres and f_C in Hz, and SHALL display it in GPa labelled "Young's Modulus (Cross-grain)" as "E_C = <value> GPa".

#### Scenario: Reference spruce panel
- **WHEN** the sample is 605 x 238 x 4.00 mm, 228 g, with f_C = 105.0 Hz
- **THEN** E_C is shown as 0.82 GPa

### Requirement: Shear Modulus
The system SHALL compute the in-plane shear modulus from the diagonal (twisting) frequency as `G_LC = 1.21585 * rho * L^2 * W^2 * f_LC^2 / h^2`, in pascals, with rho in kg/m³, L, W and h in metres and f_LC in Hz, and SHALL display it in GPa labelled "Shear Modulus" as "G_LC = <value> GPa".

#### Scenario: Reference spruce panel shear
- **WHEN** the sample is 605 x 238 x 4.00 mm, 228 g, with f_LC = 38.2 Hz
- **THEN** G_LC is shown as 0.91 GPa

### Requirement: Recommended Target Thickness
The system SHALL compute the recommended target plate thickness as
`h_target = 0.95977 * f * a^2 * sqrt(rho) / sqrt(E_L + r^4 * E_C + r^2 * (0.02857 * E_L + 1.12 * G_LC))`,
where f is the vibrational stiffness parameter, a and b are the target plate length and width in metres, r = a / b, rho is in kg/m³ and E_L, E_C, G_LC are in pascals; the result in metres SHALL be displayed in mm (x 1000) as "Recommended Thickness".

#### Scenario: Reference spruce panel thickness
- **WHEN** the sample is 605 x 238 x 4.00 mm, 228 g, f_L = 61.6 Hz, f_C = 105.0 Hz, f_LC = 38.2 Hz, the target plate is 500 x 380 mm and f = 75
- **THEN** density is 395.9 kg/m³, E_L is 11.84 GPa, E_C is 0.82 GPa and G_LC is 0.91 GPa
- **AND** the recommended thickness is shown as 2.77 mm

### Requirement: Estimated Panel Mass
The system SHALL estimate the mass of the finished target plate as `M = rho * a * b * h_target * 0.755`, with rho in kg/m³ and a, b, h_target in metres, displayed in grams (kg x 1000) as "Estimated Panel Mass". The fixed factor 0.755 accounts for material removed by the sound hole, outline shaping and thickness graduation (a 24.5 % reduction from the rectangular blank).

#### Scenario: Mass correction
- **WHEN** the density is 500 kg/m³, the target plate is 500 x 400 mm and the target thickness is 3 mm
- **THEN** the estimated panel mass is 226.5 g

#### Scenario: Reference spruce panel mass
- **WHEN** the inputs are those of the reference spruce panel thickness scenario
- **THEN** the estimated panel mass is shown as 157.5 g

### Requirement: Results Display
The system SHALL present the outputs in three groups with fixed precision: "Calculated Density" (Wood Density, 1 decimal, kg/m³); "Elastic Properties" (E_L, E_C and G_LC, 2 decimals, GPa); and "Target Specifications" (Recommended Thickness, 2 decimals, mm, shown most prominently; Estimated Panel Mass, 1 decimal, g).

#### Scenario: Formatting
- **WHEN** valid inputs produce a thickness of 2.7738 mm and a mass of 157.515 g
- **THEN** the page shows "2.77 mm" and "157.5 g"

### Requirement: Reset to Defaults
The system SHALL provide a reset control ("Reset to defaults") that restores every input to its default value, clears the panel name, deselects any loaded panel and discards any captured tap-tone spectra that have not been saved.

#### Scenario: Reset after loading a panel
- **GIVEN** a saved panel is loaded and being edited
- **WHEN** the user activates the reset control
- **THEN** all inputs return to their defaults, the name field is empty and no panel is marked as being edited

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

### Requirement: Save a New Panel
The system SHALL let the user save the current inputs, computed results and kept spectra as a new panel in their library under the name typed in "Wood Panel Name" (placeholder "e.g., Sitka Spruce #1"). The "Save Wood Panel" action SHALL be enabled only while results are valid and the name is not blank, and SHALL read "Saving..." while in progress. Names need not be unique.

#### Scenario: Saving a panel
- **GIVEN** valid inputs and no panel loaded
- **WHEN** the user types "Test Spruce Top" and activates "Save Wood Panel"
- **THEN** "Wood panel saved successfully!" is shown
- **AND** "Test Spruce Top" appears at the top of the Saved Wood Panels list

#### Scenario: Blank name
- **WHEN** the name field is empty or only spaces
- **THEN** the save action is disabled
- **AND** any save attempt without a name shows the warning "Please enter a name for this wood panel"

### Requirement: Save Outcome
The system SHALL, after a successful save or update, show the matching success message, refresh the library, clear the name field and leave no panel selected while keeping the current input values; after a failed save or update it SHALL show "Failed to save wood panel. Please try again." and keep everything as it was.

#### Scenario: After saving
- **WHEN** a save succeeds
- **THEN** the name field is empty, no library entry is marked as being edited and the inputs keep their values

#### Scenario: Save failure
- **WHEN** the server rejects the save
- **THEN** "Failed to save wood panel. Please try again." is shown

### Requirement: Update a Loaded Panel
The system SHALL, while a saved panel is loaded, turn the save action into "Update Wood Panel", which overwrites that panel's name, inputs, computed results and spectra with the current values instead of creating a new panel, and shows "Wood panel updated successfully!" on success.

#### Scenario: Updating after a new measurement
- **GIVEN** the panel "Sitka #3" is loaded
- **WHEN** the user changes the sample mass and activates "Update Wood Panel"
- **THEN** "Wood panel updated successfully!" is shown and the library entry "Sitka #3" reflects the new values
- **AND** no new panel is created

### Requirement: Saved Panel Library
The system SHALL list the signed-in user's own saved panels under "Saved Wood Panels", newest first by creation date. Each entry SHALL show the panel name, its creation date in the user's locale, "Target thickness" (2 decimals, mm) and, when available, "Est. Mass" (1 decimal, g) - both as stored at the last save - and a delete control.

#### Scenario: Library ordering
- **GIVEN** the user saved "A" on Monday and "B" on Tuesday
- **WHEN** the user opens the calculator
- **THEN** "B" is listed above "A"

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

### Requirement: Empty Library State
The system SHALL, when the user has no saved panels, show "No saved wood panels yet", the hint "Calculate and save your first wood panel to see it here" and a "Load Default Panels" action in the library area.

#### Scenario: Empty library
- **GIVEN** a user with no saved panels
- **WHEN** the user opens the calculator
- **THEN** the library shows "No saved wood panels yet" and a "Load Default Panels" action

### Requirement: Load a Panel
The system SHALL load a saved panel when the user clicks its library entry: the ten inputs take the stored values (frequencies rounded to 1 decimal), the name field takes the panel name, stored spectra are restored, results are recomputed from the inputs, and the entry is highlighted with a "Currently editing" marker plus "Analyse" and "PDF" actions. Clicking another entry SHALL load that panel instead.

#### Scenario: Loading a panel
- **WHEN** the user clicks the library entry "Sitka #3"
- **THEN** the inputs show the stored measurements of "Sitka #3" and the name field shows "Sitka #3"
- **AND** the entry is marked "Currently editing" with "Analyse" and "PDF" actions

### Requirement: Deselect a Panel
The system SHALL, when the user clicks the entry of the panel that is already loaded, deselect it and reset the calculator to its defaults.

#### Scenario: Deselecting
- **GIVEN** "Sitka #3" is loaded
- **WHEN** the user clicks the "Sitka #3" entry again
- **THEN** the calculator returns to its default inputs and no entry is marked as being edited

### Requirement: Delete Confirmation
The system SHALL delete a panel only after the user confirms a dialog titled "Delete Wood Panel" with the message "Are you sure you want to delete this wood panel? This action cannot be undone." and a "Delete" confirm button; cancelling SHALL leave the panel untouched.

#### Scenario: Cancelled deletion
- **WHEN** the user activates the delete control of a panel and then cancels the dialog
- **THEN** the panel remains in the library

### Requirement: Delete Outcome
The system SHALL, after a confirmed deletion succeeds, show "Wood panel deleted successfully", remove the entry and its stored spectra, and reset the calculator to defaults if the deleted panel was the one loaded; if the deletion fails it SHALL show "Failed to delete wood panel".

#### Scenario: Confirmed deletion
- **WHEN** the user activates the delete control of "Test Spruce Top" and confirms with "Delete"
- **THEN** "Wood panel deleted successfully" is shown and "Test Spruce Top" is no longer listed

#### Scenario: Deleting the loaded panel
- **GIVEN** "Sitka #3" is loaded
- **WHEN** the user deletes "Sitka #3"
- **THEN** the calculator returns to its default inputs

### Requirement: Reference Panel Set
The system SHALL maintain a shared set of reference ("default") wood panels, curated by administrators (see `admin-console`), each holding a name, the ten inputs and the computed results but no spectra. Every signed-in user SHALL be able to read the reference set; only administrators SHALL change it.

#### Scenario: Non-admin cannot change references
- **WHEN** a non-admin user attempts to add, change or delete a reference panel
- **THEN** the change is refused

### Requirement: Load Default Panels
The system SHALL, when the user activates "Load Default Panels" while their library is empty, copy every reference panel into the user's own library as independent panels owned by the user, then refresh the list. Copies are unaffected by later changes to the reference set. New accounts SHALL NOT receive reference panels automatically, and no copy is made if the user already has panels.

#### Scenario: Loading defaults into an empty library
- **GIVEN** a user with no panels and a reference set of 5 panels
- **WHEN** the user activates "Load Default Panels"
- **THEN** the user's library lists 5 panels with the reference names
- **AND** deleting one of them does not change the reference set

#### Scenario: New account
- **WHEN** a new user signs up and opens the calculator
- **THEN** the library is empty and offers "Load Default Panels"

#### Scenario: Empty reference set
- **GIVEN** the reference set is empty
- **WHEN** the user activates "Load Default Panels"
- **THEN** the library stays empty

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

### Requirement: Wood Panel Data
The system SHALL persist each saved panel with: owner (user); name (required text); sample length, width and thickness (mm); sample mass (g); longitudinal, cross-grain and diagonal frequencies (Hz); target plate length and width (mm); vibrational stiffness parameter (dimensionless, default 75); optional per-field spectra; creation timestamp and last-update timestamp.

#### Scenario: Last-update timestamp
- **WHEN** the user updates a loaded panel
- **THEN** that panel's last-update timestamp is set to the time of the update and its creation timestamp is unchanged

#### Scenario: Invalid data refused by the server
- **WHEN** a client, bypassing the calculator, saves a panel whose name is blank, whose ten inputs are not all finite numbers greater than 0, or whose spectra are not keyed by the three frequency fields or fail Spectrum Record Validation (`tap-tone-capture`)
- **THEN** the server refuses the save and nothing is stored
- **AND** the calculator shows "Failed to save wood panel. Please try again."

### Requirement: Stored Results Snapshot
The system SHALL also store with each panel a snapshot of its results at save time - E_L, E_C and G_LC (GPa), target thickness (mm) and estimated panel mass (g, absent on some older panels). Results shown in the calculator SHALL always be recomputed from the stored inputs; the snapshot is used only for the library summary and data export.

#### Scenario: Older panel without estimated mass
- **GIVEN** a stored panel with no estimated panel mass
- **WHEN** the library is displayed
- **THEN** its entry shows the target thickness and omits the "Est. Mass" line

### Requirement: Panel Ownership and Access
The system SHALL let a user see, create, change and delete only their own wood panels, and the calculator SHALL show only the signed-in user's panels, including for administrators. Administrators MAY read every user's panels but SHALL NOT create, change or delete another user's panels (see `user-auth`). Deleting a user account SHALL delete all of that user's panels and spectra.

#### Scenario: Panels are private
- **GIVEN** user A has saved "Maple #1"
- **WHEN** user B opens the calculator
- **THEN** "Maple #1" is not listed and cannot be loaded, changed or deleted by user B

#### Scenario: Administrator's own library
- **GIVEN** an administrator and other users each have saved panels
- **WHEN** the administrator opens the calculator
- **THEN** only the administrator's own panels are listed

### Requirement: AI Wood Analysis
The system SHALL offer, on the loaded panel's library entry, an "Analyse" action that sends the knowledge assistant (see `knowledge-assistant`) a question built from the analysis prompt template, with `{properties}` replaced by a text block of the values currently in the calculator (including unsaved edits), and shows the answer. The answer SHALL come from the assistant's pipeline grounded in the shared reference library, as a one-off question not added to the user's chat conversations.

#### Scenario: Analysing a loaded panel
- **GIVEN** the panel "Sitka #3" is loaded
- **WHEN** the user activates "Analyse"
- **THEN** the analysis window opens showing "Analyzing wood properties..."
- **AND** when the answer is complete it is displayed as formatted text
- **AND** no new conversation appears in the user's chat history

#### Scenario: No panel loaded
- **WHEN** no saved panel is loaded
- **THEN** no "Analyse" action is available

### Requirement: Analysis Properties Block
The system SHALL format the `{properties}` block as five sections separated by blank lines - "Sample Measurements:", "Frequency Measurements:", "Elastic Properties:", "Target Plate Specifications:" and a final "Vibrational Stiffness Parameter: <f>" line - each section listing one "- <label>: <value> <unit>" line per value, with density and frequencies to 1 decimal, moduli and thickness to 2 decimals, mass to 1 decimal and raw inputs as entered.

#### Scenario: Properties block for the reference spruce panel
- **WHEN** the reference spruce panel (605 x 238 x 4.0 mm, 228 g, 61.6 / 105 / 38.2 Hz, plate 500 x 380 mm, f = 75) is analysed
- **THEN** the "Sample Measurements:" section reads "- Length: 605 mm", "- Width: 238 mm", "- Thickness: 4 mm", "- Mass: 228 g", "- Density: 395.9 kg/m³"
- **AND** the "Frequency Measurements:" section reads "- Longitudinal (f_L): 61.6 Hz", "- Cross-grain (f_C): 105.0 Hz", "- Diagonal (f_LC): 38.2 Hz"
- **AND** the "Elastic Properties:" section reads "- Young's Modulus (Longitudinal, E_L): 11.84 GPa", "- Young's Modulus (Cross-grain, E_C): 0.82 GPa", "- Shear Modulus (G_LC): 0.91 GPa"
- **AND** the "Target Plate Specifications:" section reads "- Plate Length: 500 mm", "- Plate Width: 380 mm", "- Recommended Thickness: 2.77 mm", "- Estimated Panel Mass: 157.5 g"
- **AND** the block ends with "Vibrational Stiffness Parameter: 75"

### Requirement: Analysis Prompt Template
The system SHALL build the analysis question from an operator-configurable prompt template (edited by administrators, see `admin-console`) containing a `{properties}` placeholder, and SHALL apply the configured template to analyses requested by any user. When no template is configured, the system SHALL use "Do you think that a top with those properties is a good choice:" followed by a blank line and `{properties}`.

#### Scenario: Customised template used for regular users
- **GIVEN** an administrator changed the template to "Assess this soundboard for a classical guitar:" followed by a blank line and `{properties}`
- **WHEN** a non-admin user analyses a panel
- **THEN** the question sent starts with "Assess this soundboard for a classical guitar:"

#### Scenario: No template configured
- **WHEN** no template has been configured
- **THEN** the question starts with "Do you think that a top with those properties is a good choice:"

### Requirement: Analysis Language
The system SHALL produce the AI wood analysis, both in the analysis window and in the PDF report's "AI Analysis" section, in the user's selected interface language (English or French), by requesting that language from the knowledge assistant (see `knowledge-assistant`). The prompt template and properties block are sent as configured.

#### Scenario: French user analyses a panel
- **GIVEN** the user's interface language is French and the prompt template is in English
- **WHEN** the user activates "Analyse"
- **THEN** the analysis shown is written in French

#### Scenario: French PDF report
- **GIVEN** the user's interface language is French
- **WHEN** the user downloads the PDF report
- **THEN** its "AI Analysis" section is written in French

### Requirement: Analysis Window
The system SHALL show the analysis in a modal window titled "Wood Properties Analysis" with a progress indicator and "Analyzing wood properties..." until the answer is complete, then the answer as formatted text (headings, emphasis, lists, paragraphs). On failure it SHALL show "Error" with the failure message; for an empty answer, "No analysis content available.". It SHALL close via its close control or a click outside it.

#### Scenario: Assistant unavailable
- **WHEN** the analysis request fails
- **THEN** the window shows "Error" and the failure message instead of the progress indicator

#### Scenario: Closing
- **WHEN** the user clicks outside the analysis window
- **THEN** the window closes

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

### Requirement: PDF Report Contents
The system SHALL lay out the report as: title "Wood Panel Analysis Report"; the panel name (name field, or the loaded panel's name if empty); "Generated on <local date and time>"; section "Input Parameters"; section "Calculated Results"; then, on a new page, section "AI Analysis" with the analysis as plain wrapped paragraphs (markdown formatting removed). Content SHALL continue on further pages as needed.

#### Scenario: Input Parameters section
- **WHEN** a report is generated
- **THEN** "Input Parameters" contains "Sample Measurements" (Length (L) mm, Width (W) mm, Thickness (h) mm, Mass (m) g, Density (rho) kg/m³ to 1 decimal)
- **AND** "Frequency Measurements" (Longitudinal (f_L), Cross-grain (f_C), Diagonal (f_LC) in Hz to 1 decimal)
- **AND** "Target Plate Dimensions" (Plate Length (a) mm, Plate Width (b) mm) and "Vibrational Stiffness Parameter" (Parameter (f))

#### Scenario: Calculated Results section
- **WHEN** a report is generated
- **THEN** "Calculated Results" contains "Elastic Properties" (E_L, E_C and G_LC in GPa to 2 decimals)
- **AND** "Target Specifications" (Recommended Thickness in mm to 2 decimals, Estimated Panel Mass in g to 1 decimal)

#### Scenario: AI Analysis section formatting
- **WHEN** the analysis contains bold text, headings, inline code or links
- **THEN** the "AI Analysis" page shows their plain text without markdown symbols, wrapped to the page width

### Requirement: Notifications
The system SHALL report the outcome of calculator actions with transient notifications of four kinds (success, error, warning, info) that disappear automatically after 3 seconds and can be dismissed earlier by the user; several notifications MAY be visible at once.

#### Scenario: Auto-dismiss
- **WHEN** "Wood panel saved successfully!" is shown
- **THEN** it disappears by itself after about 3 seconds unless dismissed earlier

#### Scenario: Notification kinds used by the calculator
- **WHEN** save, update, delete or PDF actions complete or fail
- **THEN** successes are shown as success notifications, failures as error notifications, the missing-name message as a warning and "Generating PDF report..." as an info notification

### Requirement: Localization
The system SHALL present all calculator text - labels, units, hints, validation messages, empty states, notifications, dialog text, the analysis window and the PDF report headings - in the user's selected interface language, English or French.

#### Scenario: French interface
- **GIVEN** the interface language is French
- **WHEN** the user opens the calculator
- **THEN** the input area is titled "Mesures d'entrée" and the save action reads "Enregistrer le panneau"
- **AND** validation errors and the PDF headings also appear in French
