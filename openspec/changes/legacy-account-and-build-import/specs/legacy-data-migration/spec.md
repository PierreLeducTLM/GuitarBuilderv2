# Spec Delta

## ADDED Requirements

### Requirement: Accounts Already in the New System
The system SHALL NOT import a legacy account whose email address already belongs to a different account in the new system, and SHALL NOT import the builds and other records that account owns. The migration report SHALL list each such account and the records skipped with it, so the owner can remove the new-system account and run the migration again. Accounts already imported earlier, with the same identifier, are updated instead.

#### Scenario: Owner signed up in the new system first
- **GIVEN** the owner created an account with email E in the new system, and a legacy account with email E and a different identifier owns 3 builds
- **WHEN** the migration runs
- **THEN** the legacy account and its 3 builds are not imported, the new-system account is unchanged
- **AND** the report lists the account and the 3 builds with the reason "email already used by another account"

#### Scenario: Same account imported again
- **GIVEN** a legacy account imported by an earlier run
- **WHEN** the migration runs again
- **THEN** the account is updated in place, not skipped and not duplicated

## MODIFIED Requirements

### Requirement: Step Measurement Migration
The system SHALL import step measurements (frequency, description, capture time and stored tap-tone spectrum) unchanged, because the tap-tone spectrum scale is the same in both apps (`tap-tone-capture`). A stored spectrum with more points than a Tap-Tone Spectrum Record allows (1024) SHALL be reduced to at most 1024 points by keeping, from each run of consecutive points, the point with the greatest magnitude, so that every peak keeps its frequency and level; the measurement's frequency is unchanged and the report lists each reduced spectrum. A stored spectrum that is not a valid record for any other reason SHALL NOT be imported, and the report lists it.

#### Scenario: Measurement graph unchanged
- **GIVEN** a step measurement at 182.5 Hz with its spectrum
- **WHEN** the owner opens its graph after migration
- **THEN** the graph and the peak frequency are the same as before

#### Scenario: Oversized spectrum reduced
- **GIVEN** a step measurement whose stored spectrum has 1366 points with its highest peak at 182.5 Hz
- **WHEN** it is migrated
- **THEN** its spectrum has at most 1024 points, still contains the point at 182.5 Hz with the same level, and the measurement's frequency is unchanged
- **AND** the report lists the measurement as reduced

### Requirement: Wood Panel Spectrum Migration
The system SHALL import each panel's stored tap-tone spectra unchanged and attach them to the matching measurement: the legacy key "freqLongitudinal" to the longitudinal frequency, "freqCrossGrain" to the cross-grain frequency and "freqDiagonal" to the diagonal frequency. Any other key SHALL be ignored and reported. A spectrum with more than 1024 points SHALL be reduced as for step measurements and reported; a spectrum that is not a valid record for any other reason SHALL NOT be imported, and the report lists it.

#### Scenario: Spectrum reopens after migration
- **GIVEN** a panel whose legacy spectra are keyed "freqLongitudinal" and "freqCrossGrain"
- **WHEN** the owner opens the frequency detector for the cross-grain field after migration
- **THEN** the saved cross-grain spectrum is shown with its peaks

#### Scenario: Invalid spectrum left out
- **GIVEN** a panel whose legacy cross-grain spectrum has fewer magnitudes than frequencies
- **WHEN** it is migrated
- **THEN** the panel is imported without a cross-grain spectrum, its other spectra are attached
- **AND** the report lists the panel and the spectrum that was left out
