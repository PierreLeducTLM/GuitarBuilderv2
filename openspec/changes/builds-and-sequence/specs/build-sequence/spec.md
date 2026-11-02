# Spec Delta

## MODIFIED Requirements

### Requirement: Step Applicability by Variant
The system SHALL hide the template steps that do not apply to a build's construction variant (`guitar-builds`): steel-string-only steps on classical builds, classical-only steps on steel-string builds, and BOBO-only steps on builds without a BOBO neck. When the guitar type is not set, neither classical-only nor steel-string-only steps are hidden. Every other step applies to all builds.

#### Scenario: Steel-string-only steps
- **WHEN** the applicability of steps is determined
- **THEN** these 12 steps apply only to steel-string builds: SSCutBridge, SSShapeBridge, SSFitHeel, SSCutHeelTuners, FabricateBridge, CutSideProfile2, DrillBridgePin, ShapeBridgeWings, ShapeTopBridge, CounterBore, PolishBridge, RadiusBottom

#### Scenario: Classical-only steps
- **WHEN** the applicability of steps is determined
- **THEN** these 10 steps apply only to classical builds: CLFitHeadLaminate, CLDrillTuners, FabricateCLBridge, DrillStringHoles, RoutChannels, GlueTieBlock, ShapeBridgeWings2, ProfilePolish, MachineCompensated, ShapeMarkString
- **AND** CLGlueBOBO1 and CLCutBOBO apply only to builds with a BOBO neck that are classical or whose guitar type is not set

#### Scenario: BOBO-only steps
- **WHEN** the applicability of steps is determined
- **THEN** these 6 steps apply only to builds with a BOBO neck, of either guitar type: BOBOFitLoose, BOBONeckGroove, BOBOGlueLosen, MortiseHeelBolt, MakeBoltBar and RoutHeelMortise

#### Scenario: Guitar type not set and no BOBO neck
- **GIVEN** a migrated build whose guitar type is not set and that has no BOBO neck
- **WHEN** the applicability of its steps is determined
- **THEN** CLGlueBOBO1, CLCutBOBO and the 6 BOBO-only steps are hidden
- **AND** every classical-only and steel-string-only step is shown

#### Scenario: Step and arrow counts per variant
- **WHEN** the diagram is displayed
- **THEN** a classical build shows 120 steps and 129 arrows with a BOBO neck, or 112 steps and 120 arrows without
- **AND** a steel-string build shows 120 steps and 131 arrows with a BOBO neck, or 114 steps and 124 arrows without
- **AND** a build whose guitar type is not set shows 132 steps and 144 arrows with a BOBO neck, or 124 steps and 135 arrows without

## ADDED Requirements

### Requirement: Step Save Failures
The system SHALL show the message "Failed to save changes" when a change to a step's completion, notes or measurements cannot be saved, and SHALL NOT show that change as saved. Notes that could not be saved stay in the open Notes field and are sent again with the next edit, so typed text is never discarded by a failed save.

#### Scenario: Completion cannot be saved
- **GIVEN** the server refuses changes to the build
- **WHEN** the user opens "Thickness blank" and presses "Mark as Completed"
- **THEN** "Failed to save changes" is shown
- **AND** "Thickness blank" carries no completion badge

#### Scenario: Notes cannot be saved
- **GIVEN** the connection drops while the user types notes on "Cut brace blanks"
- **WHEN** the save fails
- **THEN** "Failed to save changes" is shown and the typed text stays in the Notes field
- **AND** after the connection returns and the user types again, reopening the step after a reload shows the full notes

#### Scenario: Description edit cannot be saved
- **GIVEN** the server refuses changes to the build
- **WHEN** the user saves a new description for a measurement
- **THEN** "Failed to save changes" is shown and the measurement keeps its previous description
