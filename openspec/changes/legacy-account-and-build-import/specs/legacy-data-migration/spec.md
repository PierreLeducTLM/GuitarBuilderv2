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
