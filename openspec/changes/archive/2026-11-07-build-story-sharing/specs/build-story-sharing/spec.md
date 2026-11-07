# Spec Delta

## MODIFIED Requirements

### Requirement: Anonymous Story Access
The system SHALL let anyone who presents the exact share token of a build with sharing on read that build's story data without signing in. The story data is the build name, guitar type, BOBO neck choice, creation date and the state of the steps that apply to the build's variant. The notes, photos and measurements of a step are part of it only when the step is completed. The same token-based access governs live updates. Step photos remain readable by anyone who has their URLs.

#### Scenario: Valid token
- **WHEN** an anonymous visitor requests the story data with a valid token
- **THEN** the build name, guitar type, BOBO neck choice, creation date and applicable step state are returned and nothing else

#### Scenario: Incomplete step content withheld
- **GIVEN** a shared build whose step "Carve neck" has notes and photos but is not completed
- **WHEN** an anonymous visitor requests the story data with its token
- **THEN** "Carve neck" is returned as not completed, without its notes, photos or measurements

#### Scenario: Hidden step withheld
- **GIVEN** a shared classical build with a completed steel-string-only step left over from before a variant change
- **WHEN** an anonymous visitor requests the story data with its token
- **THEN** that step is not returned

#### Scenario: Sharing turned off
- **WHEN** an anonymous visitor requests the story data of a build whose sharing is off
- **THEN** nothing is returned

#### Scenario: Live updates need a valid token
- **WHEN** a client asks to receive the live updates of a token that matches no build with sharing on
- **THEN** the request is refused
