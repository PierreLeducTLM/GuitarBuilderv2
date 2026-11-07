# Spec Delta

## ADDED Requirements

### Requirement: Microphone Check on the You Page
The system SHALL show on the You page a "Microphone" group with a "Check microphone" button that opens the Microphone Check (see `microphone-check`). The group is available to every signed-in user on every viewport.

#### Scenario: Check from the You page on a phone
- **GIVEN** a signed-in user on a narrow viewport
- **WHEN** the user opens You and clicks "Check microphone"
- **THEN** the Microphone Check opens

#### Scenario: French user
- **GIVEN** the interface language is French
- **WHEN** the user opens You
- **THEN** the group reads "Micro" and the button reads "Vérifier le micro"
