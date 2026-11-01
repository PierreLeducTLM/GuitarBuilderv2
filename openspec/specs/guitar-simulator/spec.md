# guitar-simulator Specification

## Purpose
The guitar simulator lets a signed-in luthier model the low-frequency acoustic response of a guitar body as four coupled oscillators (top plate, back plate, sides and sound-hole air) and see how masses, stiffnesses, areas and air volume move the main body resonances. It plots the radiated sound pressure level from 60 to 500 Hz, marks and names the coupled resonances, shows the uncoupled natural frequencies, and offers reference presets and parameter import/export.

## Requirements

### Requirement: Simulator Access
The system SHALL provide the simulator as a page of the signed-in application, reachable from the main navigation entry "Simulator" and at the bookmarkable path `/simulator`, titled "4-DOF Guitar Simulator" with the subtitle "Model acoustic guitar frequency response using coupled oscillator physics". Visitors who are not signed in SHALL see the sign-in screen instead.

#### Scenario: Opening the simulator
- **GIVEN** a signed-in user
- **WHEN** the user selects "Simulator" in the navigation or opens `/simulator`
- **THEN** the simulator page shows the parameter panel and the frequency response plot computed from the default parameters

### Requirement: Mass Parameters
The system SHALL let the user set four masses, in grams, within these ranges (slider step in brackets) and with these defaults: Mass of top m_t 10-1000 g [5], default 75; Mass of back m_b 10-1000 g [5], default 40; Mass of sides m_s 20-1000 g [10], default 700; Mass of sound hole air m_a 0.1-10 g [0.1], default 0.9. The model uses the masses in kg (g / 1000).

#### Scenario: Mass defaults
- **WHEN** the simulator opens
- **THEN** the masses show 75, 40, 700 and 0.9 grams

### Requirement: Stiffness Parameters
The system SHALL let the user set three spring stiffnesses, in N/mm, each within 10-1000 N/mm with slider step 10, and with defaults: Stiffness of top K_t 70 N/mm; Stiffness of back K_b 120 N/mm; Stiffness of sides K_s 120 N/mm. The model uses stiffnesses in N/m (N/mm x 1000).

#### Scenario: Stiffness defaults
- **WHEN** the simulator opens
- **THEN** the stiffnesses show 70, 120 and 120 N/mm

### Requirement: Area and Volume Parameters
The system SHALL let the user set, in cm² unless stated: Area of top A_t 200-2000 [100], default 380; Area of back A_b 200-2000 [100], default 320; Area of sides A_s 200-2000 [100], default 580; Area of sound hole A_h 20-200 [5], default 70; and Volume of box V 5-50 L [1], default 15. The model uses areas in m² (cm² / 10000) and the volume in m³ (L / 1000).

#### Scenario: Area and volume defaults
- **WHEN** the simulator opens
- **THEN** the areas show 380, 320, 580 and 70 cm² and the volume shows 15 L

### Requirement: Parameter Entry
The system SHALL present each parameter with both a slider and a numeric field showing the same value in display units, and SHALL keep each parameter within its range: a typed value outside the range is clamped to the nearest bound, and an empty or non-numeric entry is not applied.

#### Scenario: Slider and field stay in sync
- **WHEN** the user drags the "Volume of box (L)" slider to 20
- **THEN** the numeric field shows 20 and the plot is recomputed for 20 L

#### Scenario: Out-of-range typed value
- **WHEN** the user types 0 in "Mass of top (gr)"
- **THEN** the top mass is set to 10 g

### Requirement: Real-Time Recalculation
The system SHALL recompute the frequency response, component curves, resonance peaks and uncoupled frequencies whenever any parameter changes, without a separate "run" action and without blocking interaction.

#### Scenario: Changing top stiffness
- **WHEN** the user raises the top stiffness from 70 to 100 N/mm
- **THEN** the plot and the mode readouts update immediately and the top resonance moves up in frequency

### Requirement: Fixed Model Constants
The system SHALL use these fixed constants: speed of sound c = 343 m/s; air density rho_air = 1.205 kg/m³; reference pressure p_ref = 2e-5 Pa; listening distance r = 1.0 m; driving force F = 0.4 N applied to the top; quality factors Q_t = 35 (top), Q_b = 15 (back), Q_s = 20 (sides), Q_a = 40 (air).

#### Scenario: Constants are not user-editable
- **WHEN** the user views the parameter panel
- **THEN** no control is offered for c, rho_air, p_ref, r, F or the quality factors

### Requirement: Air Spring and Natural Frequencies
The system SHALL compute the cavity air stiffness `kappa = rho_air * c^2 / V` and the natural angular frequencies `w_t = sqrt((K_t + kappa*A_t^2) / m_t)`, `w_b = sqrt((K_b + kappa*A_b^2) / m_b)`, `w_s = sqrt(K_s / m_s)`, `w_a = sqrt(kappa*A_h^2 / m_a)`, and damping `R_x = m_x * w_x / Q_x` for x in {t, b, s, a}, all in SI units.

#### Scenario: Default air spring
- **WHEN** the parameters are at their defaults (V = 0.015 m³)
- **THEN** kappa is 343^2 x 1.205 / 0.015, about 9.45e6 Pa/m³

### Requirement: Coupling and Dynamic Stiffness Terms
The system SHALL, at each angular frequency w = 2*pi*f, form the coupling terms `alpha_t = kappa*A_h*A_t`, `alpha_b = kappa*A_h*A_b`, `alpha_bt = kappa*A_b*A_t` and the complex dynamic stiffnesses `D_x = m_x*(w_x^2 - w^2) + j*R_x*w` for x in {t, s, b, a}, where j is the imaginary unit.

#### Scenario: Dynamic stiffness at resonance
- **WHEN** w equals w_t
- **THEN** D_t is purely imaginary with value j*R_t*w_t

### Requirement: System Determinant
The system SHALL compute the complex determinant
`Dbar = D_t*D_s*D_b*D_a - 2*alpha_bt*K_t*K_b*D_a + 2*alpha_bt*alpha_b*alpha_t*D_s + 2*alpha_t*alpha_b*K_t*K_b - alpha_b^2*(D_t*D_s - K_t^2) - alpha_t^2*(D_s*D_b - K_b^2) - alpha_bt^2*D_s*D_a - K_b^2*D_t*D_a - K_t^2*D_b*D_a`,
with K_t and K_b in N/m; if Dbar is exactly zero, the responses at that frequency SHALL be taken as zero.

#### Scenario: Zero determinant guard
- **WHEN** Dbar evaluates to exactly 0 at some frequency
- **THEN** the displacements at that frequency are 0 and the SPL there is reported as -200 dB instead of an error

### Requirement: Top and Sides Displacements
The system SHALL compute the complex displacement amplitudes of the top and sides as `y_t = (F/Dbar) * (D_s*D_b*D_a - alpha_b^2*D_s - K_b^2*D_a)` and `y_s = (F/Dbar) * (K_t*D_b*D_a - K_t*alpha_b^2 + alpha_bt*K_b*D_a - alpha_t*alpha_b*K_b)`.

#### Scenario: Top displacement uses the full model
- **WHEN** the response is computed at any frequency
- **THEN** y_t and y_s are obtained from the formulas above using the same Dbar

### Requirement: Back and Air Displacements
The system SHALL compute the complex displacement amplitudes of the back and of the sound-hole air as `y_b = (F/Dbar) * (-K_t*K_b*D_a - alpha_bt*D_a*D_s + alpha_b*alpha_t*D_s)` and `y_a = (F/Dbar) * (K_t*K_b*alpha_b + alpha_bt*alpha_b*D_s - alpha_t*D_s*D_b + alpha_t*K_b^2)`.

#### Scenario: Back and air displacement
- **WHEN** the response is computed at any frequency
- **THEN** y_b and y_a are obtained from the formulas above using the same Dbar

### Requirement: Radiated Sound Pressure Level
The system SHALL compute each element's radiated pressure as `p_x = (w^2 * rho_air / (4*pi*r)) * A_x * y_x` (A_s for the sides, A_h for the air), the total pressure `p = p_t + p_s + p_b + p_a` (complex sum), and levels `SPL = 20*log10(|p| / p_ref)` in dB; a pressure magnitude of zero or a non-finite value SHALL be reported as -200 dB.

#### Scenario: Default resonances
- **WHEN** the parameters are at their defaults
- **THEN** the total SPL curve has local maxima at 96.5 Hz, 182.0 Hz and 300.5 Hz
- **AND** its highest level is about 92.9 dB at 182.0 Hz

### Requirement: Frequency Grid
The system SHALL evaluate the model on a linear grid from 60 Hz to 500 Hz inclusive in 0.5 Hz steps (881 points); no values are computed below 60 Hz.

#### Scenario: Grid extent
- **WHEN** the response is computed
- **THEN** it contains points at 60.0, 60.5, ..., 499.5 and 500.0 Hz

### Requirement: Frequency Response Plot
The system SHALL plot the total SPL curve under the heading "Frequency Response (0-500 Hz)" on a linear frequency axis from 0 to 500 Hz with labelled gridlines every 50 Hz, and a level axis with labelled gridlines every 10 dB from `floor(minSPL/10)*10 - 10` to `ceil(maxSPL/10)*10 + 10`, where minSPL and maxSPL are the extremes of the current curve; curve values outside the axis range are drawn at its edge.

#### Scenario: Automatic level range
- **WHEN** the current curve spans 44.5 dB to 92.9 dB
- **THEN** the level axis runs from 30 dB to 110 dB

### Requirement: Component Contribution Overlays
The system SHALL offer toggles "Air", "Top", "Back" and "Sides", all off by default, each overlaying as a distinct dashed curve the SPL of that element's own radiated pressure p_a, p_t, p_b or p_s computed as in "Radiated Sound Pressure Level".

#### Scenario: Showing the air contribution
- **WHEN** the user enables "Air"
- **THEN** a dashed curve of the sound-hole air's SPL is drawn over the total response

### Requirement: Resonance Peak Detection
The system SHALL detect peaks on the total SPL curve as points strictly higher than both neighbours whose prominence exceeds 1 dB, where prominence = SPL_i - max(leftMin, rightMin) and leftMin (rightMin) is the lowest SPL from the neighbour towards lower (higher) frequency up to the first point higher than SPL_i or the end of the curve.

#### Scenario: Default peaks
- **WHEN** the parameters are at their defaults
- **THEN** exactly three peaks are detected, at 96.5 Hz, 182.0 Hz and 300.5 Hz

### Requirement: Peak Classification and Markers
The system SHALL classify each detected peak by frequency - below 120 Hz as air, from 120 Hz to below 240 Hz as top, 240 Hz and above as back - and SHALL mark each peak on the plot with a dot coloured by its class and a label "<frequency> Hz" with 1 decimal.

#### Scenario: Default peak markers
- **WHEN** the parameters are at their defaults
- **THEN** the plot shows an air marker labelled "96.5 Hz", a top marker "182.0 Hz" and a back marker "300.5 Hz"

### Requirement: Coupled Modes Readout
The system SHALL show, under "Coupled modes", three readouts - "Air mode T(1,1)₁", "Top Monopole T(1,1)₂" and "Back Monopole T(1,1)₃" - each giving the frequency (1 decimal, Hz) of the lowest-frequency detected peak of that class, or "—" when no peak of that class exists.

#### Scenario: Default coupled modes
- **WHEN** the parameters are at their defaults
- **THEN** the readouts show 96.5 Hz, 182.0 Hz and 300.5 Hz

#### Scenario: Missing class
- **WHEN** no detected peak lies between 120 Hz and 240 Hz
- **THEN** the "Top Monopole T(1,1)₂" readout shows "—"

### Requirement: Uncoupled Modes Readout
The system SHALL show, under "Uncoupled modes", the uncoupled natural frequencies (1 decimal, Hz): Air mode `f_air = sqrt(kappa*A_h^2 / m_a) / (2*pi)`, Top Monopole `f_top = sqrt(K_t / m_t) / (2*pi)` and Back Monopole `f_back = sqrt(K_b / m_b) / (2*pi)`, with K in N/m and m in kg.

#### Scenario: Default uncoupled modes
- **WHEN** the parameters are at their defaults
- **THEN** the readouts show 114.2 Hz (air), 153.8 Hz (top) and 275.7 Hz (back)

### Requirement: Cursor Frequency Readout
The system SHALL, while the pointer is over the plot, draw a vertical line at the pointer and display the corresponding frequency (`x / plotWidth * 500`, 1 decimal, Hz), and SHALL remove them when the pointer leaves the plot.

#### Scenario: Hovering the plot
- **WHEN** the user moves the pointer to the middle of the plot
- **THEN** a vertical cursor line and the label "250.0 Hz" are shown

### Requirement: Reference Presets
The system SHALL offer, under "Reference Presets", the presets "Default" (all defaults), "Gibson J45" and "Fleta 297"; selecting one replaces all parameters. Gibson J45 is the default set with m_t = 180 g, K_t = 600 N/mm, V = 18 L, a 95 mm diameter sound hole (A_h = 70.88 cm²) and m_a = 1.2 g. Fleta 297 is the default set with m_t = 120 g, K_t = 450 N/mm, V = 12 L, an 85 mm sound hole (A_h = 56.75 cm²) and m_a = 0.9 g.

#### Scenario: Loading the Gibson J45 preset
- **WHEN** the user selects "Gibson J45"
- **THEN** the top mass shows 180 g, top stiffness 600 N/mm, volume 18 L, sound hole area 70.88 cm² and air mass 1.2 g
- **AND** all other parameters show their defaults and the plot is recomputed

### Requirement: Reset to Defaults
The system SHALL restore every parameter to its default value when the user activates "Reset" (page header) or "Reset to Default Values" (parameter panel).

#### Scenario: Reset after experimenting
- **GIVEN** the user changed several parameters
- **WHEN** the user activates "Reset to Default Values"
- **THEN** all parameters show their defaults and the plot matches the default response

### Requirement: Export Parameters
The system SHALL let the user download the current parameters with "Export" as a JSON file named `guitar-simulator-params-<milliseconds since epoch>.json`, using SI units under the keys topMass, backMass, sidesMass, airMass (kg), topStiffness, backStiffness, sidesStiffness (N/m), topArea, backArea, sidesArea, soundHoleArea (m²), soundHoleDiameter (m) and airVolume (m³).

#### Scenario: Exporting defaults
- **WHEN** the user activates "Export" with default parameters
- **THEN** a JSON file is downloaded in which topMass is 0.075, topStiffness is 70000 and airVolume is 0.015

### Requirement: Import Parameters
The system SHALL let the user load parameters with "Import" from a `.json` file in the export format; keys present in the file replace the corresponding parameters, missing keys take their default values, unknown keys are ignored and imported values are clamped to their ranges. If the file cannot be parsed, the system SHALL show "Failed to parse parameter file" and keep the current parameters.

#### Scenario: Round trip
- **GIVEN** the user exported parameters after setting the volume to 20 L
- **WHEN** the user later imports that file
- **THEN** the volume shows 20 L and the plot matches the exported state

#### Scenario: Invalid file
- **WHEN** the user imports a file that is not valid JSON
- **THEN** "Failed to parse parameter file" is shown and the parameters are unchanged

### Requirement: Session-Only State
The system SHALL NOT store simulator parameters on the server; each visit to the simulator SHALL start from the default parameters, and export/import is the way to keep a configuration.

#### Scenario: Returning to the simulator
- **GIVEN** the user changed parameters and navigated to another page
- **WHEN** the user returns to the simulator
- **THEN** the parameters show their defaults

### Requirement: Localization
The system SHALL present all simulator text - title, subtitle, parameter labels with units, buttons, preset names, overlay toggles, mode readout labels and the import error - in the user's selected interface language, English or French.

#### Scenario: French interface
- **GIVEN** the interface language is French
- **WHEN** the user opens the simulator
- **THEN** the title reads "Simulateur de Guitare 4-DOF" and the top mass label reads "Masse de la table (gr)"
