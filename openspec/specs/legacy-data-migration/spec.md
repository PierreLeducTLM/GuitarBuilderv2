# legacy-data-migration Specification

## Purpose
Defines the one-time import of all data from the legacy Guitar Builder app into the new system, so that existing users keep their accounts, builds, measurements, wood panels, references and conversations. It also corrects values that the legacy app computed or stored wrongly: build analyzer spectra on a double-log dB scale, and wood panel results computed with the wrong cross-grain formula. The migration report lets the owner review every correction.

## Requirements

### Requirement: Migration Scope
The system SHALL import from the legacy app: user accounts and roles, builds with their step state and share links, step photo files, saved build FFT results, wood panels with their spectra, default wood panels, the analysis prompt template, reference documents with their figures, and chat conversations with their messages. Records that the legacy app could not reach or never used SHALL NOT be imported (see Records Not Migrated).

#### Scenario: Complete import
- **GIVEN** a legacy database with 8 accounts, 20 builds, 35 saved FFT results, 60 wood panels, 12 reference documents and 40 conversations
- **WHEN** the migration runs
- **THEN** all of them exist in the new system with their owners, and the migration report shows those counts

### Requirement: Stable Identifiers and Links
The system SHALL keep the legacy identifiers of accounts, builds, reference documents and conversations, and the legacy share tokens, so that bookmarked `/builds/<id>` and `/references?docId=<id>` links and public `/story/<token>` links keep working after migration.

#### Scenario: Shared story link survives
- **GIVEN** a build shared before migration with token T
- **WHEN** a client opens `/story/T` after migration
- **THEN** the same build's story is shown

#### Scenario: Unshared build stays unshared
- **GIVEN** a build whose sharing was off, with or without a leftover token
- **WHEN** it is migrated
- **THEN** its sharing is off and no story link works for it

### Requirement: Account Migration
The system SHALL import every legacy account with its identifier, email address, role and creation date, and existing users SHALL be able to sign in with their existing email and password. An account that has no legacy profile SHALL be imported with role user. Every legacy admin SHALL remain admin.

#### Scenario: Existing user signs in
- **GIVEN** a user who signed in to the legacy app with email E and password P
- **WHEN** they sign in to the new system with E and P after migration
- **THEN** they are signed in and see their own data

#### Scenario: Account without a profile
- **GIVEN** a legacy account whose profile row is missing
- **WHEN** the migration runs
- **THEN** the account is imported with role user and is listed in the migration report

### Requirement: Build Migration
The system SHALL import each build's identifier, owner, name, creation and last-update times, sharing state and step state (completion, notes, photos and measurements). Legacy model name, width and length SHALL NOT be imported, because builds no longer have them; the report lists every build that had a non-empty value, with those values.

#### Scenario: Legacy dimensions are reported
- **GIVEN** a legacy build "OM #1" with model name "OM", width 380 and length 495
- **WHEN** it is migrated
- **THEN** the new build has no model name, width or length
- **AND** the report lists "OM #1" with "OM", 380 and 495

### Requirement: Build Variant Inference
The system SHALL infer each migrated build's guitar type from its step data. A step has data when it is completed or has non-blank notes, a photo or a measurement. If only classical-only steps have data, the type is classical; if only steel-string-only steps do, it is steel-string; otherwise it is not set. Every migrated build gets a BOBO neck, which shows every step it had before.

#### Scenario: Classical steps used
- **GIVEN** a legacy build where "Fabricate CL bridge blank" is completed and no steel-string-only step has data
- **WHEN** it is migrated
- **THEN** its guitar type is classical and it has a BOBO neck

#### Scenario: Nothing to infer from
- **GIVEN** a legacy build where no variant-specific step has data, or where both classical-only and steel-string-only steps do
- **WHEN** it is migrated
- **THEN** its guitar type is not set, all 132 steps are shown, and the report lists the build so the owner can choose its type

### Requirement: Step Photo Migration
The system SHALL copy every photo file referenced by a migrated build's step state into the new photo storage and update the step references, so that every photo shows in the step gallery and on the public story exactly as before. Photo files that no existing build references SHALL NOT be copied.

#### Scenario: Photos still show
- **GIVEN** a step with three photos before migration
- **WHEN** the owner opens the step after migration
- **THEN** the same three photos are shown in the same order

#### Scenario: Orphaned photos are dropped
- **GIVEN** photo files left in legacy storage by builds deleted earlier
- **WHEN** the migration runs
- **THEN** those files are not copied, and the report counts them

### Requirement: Step Measurement Migration
The system SHALL import step measurements (frequency, description, capture time and stored tap-tone spectrum) unchanged, because the tap-tone spectrum scale is the same in both apps (`tap-tone-capture`).

#### Scenario: Measurement graph unchanged
- **GIVEN** a step measurement at 182.5 Hz with its spectrum
- **WHEN** the owner opens its graph after migration
- **THEN** the graph and the peak frequency are the same as before

### Requirement: Saved FFT Result Conversion
The system SHALL convert every legacy saved FFT result to the dBFS scale of `acoustic-signal-analysis` and keep its frequencies, name, order and creation time. Each legacy level A_old (dB) SHALL become A_new = -100 + 70 * 10^(A_old/20) + 13.56 dB. The legacy air and body resonance fields were always empty, so migrated results have no identified resonances.

#### Scenario: Conversion of typical points
- **WHEN** legacy levels of 0 dB, -6.02 dB and -200 dB are converted
- **THEN** they become -16.44 dB, -51.44 dB and -86.44 dB respectively

#### Scenario: Meaning of the conversion
- **WHEN** the conversion is applied
- **THEN** -100 + 70 * 10^(A_old/20) recovers the browser analyser's dBFS level from the legacy 8-bit value, to within 0.27 dB
- **AND** +13.56 dB = 20 * log10(2 / 0.42) moves it from the analyser's 1/N scaling with a Blackman window to the coherent-gain-normalized single-sided scale

#### Scenario: Saturated legacy values
- **WHEN** a legacy level is exactly 0 dB or -200 dB, the limits of the legacy scale
- **THEN** the converted value is the corresponding limit (-16.44 or -86.44 dB) and the true level was at or beyond it

### Requirement: Wood Panel Recalculation
The system SHALL import each wood panel's name, owner, the ten inputs and the timestamps, and SHALL recompute density, E_L, E_C, G_LC, target thickness and estimated panel mass from the inputs with the formulas of `wood-panel-properties`, rather than copying the legacy results. The same applies to default wood panels. The report lists each panel whose E_C, target thickness or estimated mass changed, with old and new values.

#### Scenario: Cross-grain modulus corrected
- **GIVEN** a legacy panel 602 x 283 x 3.8 mm, 270 g, f_C = 57.0 Hz, whose stored E_C (legacy formula) is about 0.28 GPa
- **WHEN** it is migrated
- **THEN** its E_C is 0.57 GPa (width formula) and its target thickness and estimated mass are recomputed from the corrected values
- **AND** the report lists the panel with its old and new E_C, target thickness and mass

#### Scenario: Ownerless panel
- **GIVEN** a legacy panel that has no owner
- **WHEN** the migration runs
- **THEN** it is not imported and the report lists it

### Requirement: Wood Panel Spectrum Migration
The system SHALL import each panel's stored tap-tone spectra unchanged and attach them to the matching measurement: the legacy key "freqLongitudinal" to the longitudinal frequency, "freqCrossGrain" to the cross-grain frequency and "freqDiagonal" to the diagonal frequency. Any other key SHALL be ignored and reported.

#### Scenario: Spectrum reopens after migration
- **GIVEN** a panel whose legacy spectra are keyed "freqLongitudinal" and "freqCrossGrain"
- **WHEN** the owner opens the frequency detector for the cross-grain field after migration
- **THEN** the saved cross-grain spectrum is shown with its peaks

### Requirement: Settings Migration
The system SHALL import the analysis prompt template as configured in the legacy app. If none was configured, the default template applies (`wood-panel-properties`).

#### Scenario: Custom template kept
- **GIVEN** an administrator had customised the analysis prompt template
- **WHEN** a user runs a wood analysis after migration
- **THEN** the customised template is used

### Requirement: Reference Library Migration
The system SHALL import each reference document's identifier, title, content, author and timestamps, copy its stored figures into the new image storage, and re-index every document with the indexing rules of `reference-library` instead of copying legacy passages and embeddings.

#### Scenario: Library is searchable after migration
- **WHEN** a user asks the assistant a question right after migration
- **THEN** answers are grounded in passages produced by the new indexing of all migrated documents

### Requirement: Conversation Migration
The system SHALL import every conversation with its identifier, owner, title and timestamps, and every message with its role, content, creation time and order. Conversations deleted in the legacy app, and history lost when the legacy chat tables were re-created, cannot be recovered.

#### Scenario: History continues
- **GIVEN** a conversation with six messages before migration
- **WHEN** its owner opens it after migration and asks a follow-up question
- **THEN** the six messages are shown in order and the follow-up uses them as history

### Requirement: Records Not Migrated
The system SHALL NOT import: Instagram accounts, scheduled posts and posted-step records; photo and figure files that no migrated record references; wood panels without an owner; the unused build reference on wood panels; or legacy search passages and embeddings. The report counts each category.

#### Scenario: Instagram data skipped
- **GIVEN** the legacy Instagram tables
- **WHEN** the migration runs
- **THEN** nothing from them is imported and the report shows their row counts

### Requirement: Migration Report
The system SHALL produce a migration report for the owner with: imported and skipped counts per kind of record; builds whose legacy model name, width or length were dropped, with values; builds whose guitar type could not be inferred; wood panels whose values changed, with old and new values; accounts given a profile; and every skipped record with its reason.

#### Scenario: Report after a run
- **WHEN** the migration finishes
- **THEN** the report is available to the owner and every count in it matches the data in the new system

### Requirement: Repeatable Dry Run
The system SHALL support a dry run that produces the full migration report without writing anything, and a real run that can be repeated without creating duplicates: a repeated run updates the records imported earlier instead of adding new ones.

#### Scenario: Dry run
- **WHEN** the owner runs the migration in dry-run mode
- **THEN** the report is produced and the new system's data is unchanged

#### Scenario: Re-run
- **GIVEN** the migration has already run once
- **WHEN** it runs again on the same legacy data
- **THEN** no record is duplicated and the counts in the new system are unchanged
