## MODIFIED Requirements

### Requirement: Build Detail Header
The system SHALL show a build's page bar (`app-shell`) with the elements listed in the scenarios: a "Builds" control, the build name, its variant and creation date, and a "More actions" menu. The menu holds "Share" (`build-story-sharing`), "Change construction" and "Delete Build", in that order. Delete Build is set apart as a destructive action. Build actions are not shown as separate buttons.

#### Scenario: Header content
- **GIVEN** a steel-string build with a BOBO neck named "Build #1", created on 6 December 2025
- **WHEN** its owner opens the build's page
- **THEN** the bar shows "Build #1", "Steel-string", "BOBO neck" and "Created Dec 6, 2025"
- **AND** it offers a "Builds" control and a "More actions" menu

#### Scenario: Variant not set
- **GIVEN** a migrated build whose guitar type is not set
- **WHEN** its owner opens the build's page
- **THEN** the bar shows "Guitar type not set" in place of the guitar type

#### Scenario: More actions
- **WHEN** the owner opens "More actions"
- **THEN** it lists "Share", "Change construction" and "Delete Build"
- **AND** "Change construction" opens the same dialog as the Construction section's "Change" action

#### Scenario: Back to list
- **WHEN** the user presses "Builds"
- **THEN** the browser navigates to `/builds`

#### Scenario: Read-only build has no actions menu
- **WHEN** an administrator opens another user's build
- **THEN** no "More actions" menu is shown

### Requirement: Build Summary Strip
The system SHALL show under the build's page bar a summary strip with: the progress bar and "<C> of <T> steps · <P>%" (as the public story computes them, `build-story-sharing`); the latest step measurement's frequency, or "No measurement yet"; and "Next up": the first ready step in template order (`build-sequence`), which opens that step's screen when activated, or "All steps done".

#### Scenario: Summary of a build in progress
- **GIVEN** a steel-string build with a BOBO neck, 30 completed steps, a latest measurement of 181.6 Hz and FitTopBack as its first ready step
- **WHEN** its owner opens the build's page
- **THEN** the strip shows "30 of 120 steps · 25%", "181.6 Hz" and "Next up: Fit top and back"

#### Scenario: Next up opens the step
- **WHEN** the owner activates "Next up: Fit top and back"
- **THEN** the URL becomes `/builds/<build id>/steps/FitTopBack`
- **AND** the step screen of "Fit top and back" is shown

#### Scenario: Strip on every view
- **WHEN** the user switches between the Steps, Map and Overview views
- **THEN** the summary strip stays shown above the view

### Requirement: Build Deep Links
The system SHALL expose bookmarkable URLs for the builds list, each build's views, its part flows and its step screens, as listed in the scenarios. The root path `/` and any unknown path SHALL redirect to `/builds`.
- Opening a build URL directly shows "Loading build..." until the build is available.
- A visitor who is not signed in is asked to sign in first (`user-auth`). After signing in, the visitor sees the page at the requested URL.

#### Scenario: Build URLs
- **WHEN** the URLs of a build X are listed
- **THEN** they are `/builds/X` (Steps view), `/builds/X/map` (Map view), `/builds/X/map/<group>` (a part flow, `build-sequence`), `/builds/X/overview` (Overview view) and `/builds/X/steps/<step key>` (a step screen)

#### Scenario: Direct link to an own build
- **GIVEN** a signed-in user who owns build X
- **WHEN** the user opens `/builds/X` in a new browser tab
- **THEN** the Steps view of build X is shown

#### Scenario: Direct link to a step
- **GIVEN** a signed-in user who owns steel-string build X
- **WHEN** the user opens `/builds/X/steps/FitTopBack`
- **THEN** the step screen of "Fit top and back" of build X is shown

#### Scenario: Root path
- **WHEN** a signed-in user opens `/`
- **THEN** the browser is redirected to `/builds`

#### Scenario: Signed-out visitor follows a build link
- **WHEN** a visitor who is not signed in opens `/builds/X/steps/FitTopBack`
- **THEN** the sign-in screen is shown
- **AND** after signing in as the owner of X, the step screen of "Fit top and back" is shown

### Requirement: Inaccessible Build Links
The system SHALL redirect the user to `/builds` when a build URL points to a build that does not exist or that the user may not read. When the build is readable but the URL names a step or group that does not exist, or a step that does not apply to the build's variant, the system SHALL redirect to the build's Steps view at `/builds/<build id>`. Both redirects replace the current history entry.

#### Scenario: Link to another user's build
- **WHEN** a signed-in regular user opens `/builds/Y` and Y belongs to another user
- **THEN** the user is redirected to `/builds`

#### Scenario: Link to a deleted build
- **WHEN** a signed-in user opens a link to a build that has been deleted
- **THEN** the user is redirected to `/builds`

#### Scenario: Unknown step key
- **WHEN** the owner of build X opens `/builds/X/steps/NoSuchStep`
- **THEN** the user is redirected to `/builds/X`

#### Scenario: Step hidden by the variant
- **GIVEN** a classical build X
- **WHEN** its owner opens `/builds/X/steps/FabricateBridge`
- **THEN** the user is redirected to `/builds/X`

#### Scenario: Unknown group
- **WHEN** the owner of build X opens `/builds/X/map/no-such-group`
- **THEN** the user is redirected to `/builds/X`

### Requirement: Builds Localization
The system SHALL present all text of the builds list, the creation dialog, the build's page and the deletion dialog in English and French according to the user's selected language. This includes the view labels, the "More actions" menu entries, the guitar type names and the formatting of dates.

#### Scenario: French user
- **GIVEN** the user selected French
- **WHEN** the user opens a build's page
- **THEN** the return control, the view labels, the "More actions" entries and the creation date are shown in French

## ADDED Requirements

### Requirement: Build Views
The system SHALL organize a build's page into three views, chosen with a control under the summary strip: "Steps" (the default, `build-sequence` Steps Checklist), "Map" (`build-sequence` Build Map and Part Flow) and "Overview" (Build Overview Tab). Each view has its own URL (Build Deep Links), so reloading or going back keeps the view. Other requirements' "Overview tab" means the Overview view.

#### Scenario: Default view
- **WHEN** the owner opens `/builds/X`
- **THEN** the Steps view is selected and shown

#### Scenario: Switching views
- **GIVEN** the owner is on the Steps view of build X
- **WHEN** the owner selects "Map"
- **THEN** the URL becomes `/builds/X/map` and the build map is shown

#### Scenario: Reload keeps the view
- **GIVEN** the owner is on `/builds/X/overview`
- **WHEN** the owner reloads the page
- **THEN** the Overview view is still selected

#### Scenario: Back returns to the previous view
- **GIVEN** the owner went from the Steps view to the Map view of build X
- **WHEN** the owner presses the browser Back button
- **THEN** the Steps view is shown

## REMOVED Requirements

### Requirement: Build Detail Tabs
**Reason**: The two in-page tabs, which reset to Overview on reload, are replaced by three views with their own URLs, Steps first.
**Migration**: See Build Views. The process diagram moves to the Map view (`build-sequence`), the Overview tab becomes the Overview view.
