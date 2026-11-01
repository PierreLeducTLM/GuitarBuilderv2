# guitar-builds Specification

## Purpose
A guitar build is a luthier's project: one named instrument under construction. The build holds the instrument's process tracking (`build-sequence`), its acoustic measurements (`build-acoustic-analysis`) and its public story (`build-story-sharing`). This capability lets signed-in builders list, create, open and delete their builds. It also defines who may see and change a build.

## Requirements

### Requirement: Builds List
The system SHALL show a signed-in user a "Your Builds" page that lists the user's own builds as cards, newest first by creation time, with the number of builds in parentheses after the heading.
- Each card shows the build name and its guitar type ("Classical" or "Steel-string"), or only the name when the guitar type is not set.
- Selecting a card opens that build's detail page at `/builds/<build id>`.

#### Scenario: Builds are listed newest first
- **GIVEN** a user created build "A" on 1 March and build "B" on 5 March
- **WHEN** the user opens the Builds page
- **THEN** the heading reads "Your Builds (2)"
- **AND** the card for "B" appears before the card for "A"

#### Scenario: Card shows the guitar type
- **GIVEN** build "A" is a classical guitar and build "B" is a migrated build whose guitar type is not set
- **WHEN** the user views the Builds page
- **THEN** the card for "A" shows "A" and "Classical"
- **AND** the card for "B" shows only "B"

#### Scenario: Opening a build from the list
- **WHEN** the user selects the card of a build
- **THEN** the browser navigates to `/builds/<that build's id>` and shows its detail page

### Requirement: Builds List Loading and Errors
The system SHALL show a loading message ("Loading builds...") while the builds list is being fetched, and SHALL tell the user "Failed to load guitar builds" if it cannot be fetched.

#### Scenario: List is loading
- **WHEN** the Builds page is opened and the list has not arrived yet
- **THEN** "Loading builds..." is shown in place of the cards

#### Scenario: List fails to load
- **WHEN** the server returns an error while the builds are being loaded
- **THEN** the user sees the message "Failed to load guitar builds"

### Requirement: Builds List Empty State
The system SHALL show an empty-state panel instead of cards when the user has no builds, reading "No guitar builds yet" with the hint "Click "Add New Build" to get started".

#### Scenario: New user sees the empty state
- **GIVEN** a signed-in user who owns no builds
- **WHEN** the user opens the Builds page
- **THEN** the heading reads "Your Builds (0)"
- **AND** the empty-state panel with "No guitar builds yet" is shown

### Requirement: Create Build Dialog
The system SHALL provide on the Builds page an "Add New Build" action that opens a dialog titled "Add New Guitar Build" with three fields: "Build Name" (required), "Guitar Type" (required) and "Bolt-on/bolt-off (BOBO) neck". Builds have no model name, width or length. "Cancel" or the close (X) control dismisses the dialog without creating anything.

#### Scenario: Dialog fields
- **WHEN** the user opens "Add New Build"
- **THEN** "Build Name" is empty with the placeholder "e.g., Build #1"
- **AND** "Guitar Type" offers "Classical" and "Steel-string" with nothing preselected
- **AND** the "Bolt-on/bolt-off (BOBO) neck" checkbox is checked

#### Scenario: Name rules
- **WHEN** the user enters a name
- **THEN** it must contain at least one non-whitespace character; it does not have to be unique and has no length limit

#### Scenario: Name is required
- **WHEN** the user presses "Add Build" with an empty or whitespace-only name
- **THEN** no build is created and the dialog stays open

#### Scenario: Guitar type is required
- **WHEN** the user enters a name but chooses no guitar type and presses "Add Build"
- **THEN** no build is created and the dialog stays open

#### Scenario: Cancel creation
- **WHEN** the user enters a name and presses "Cancel"
- **THEN** the dialog closes and no build is created

#### Scenario: Duplicate names allowed
- **GIVEN** the user already has a build named "Build #1"
- **WHEN** the user creates another build named "Build #1"
- **THEN** a second, separate build named "Build #1" is created

### Requirement: Create Build Submission
The system SHALL create the build, owned by the submitting user, when "Add Build" is pressed with a valid name. While the request runs, the button SHALL read "Adding..." and be disabled.
- On success the dialog closes and its input is cleared, the new build is first in the list, and the user is taken to its detail page.
- On failure the dialog stays open with the name and shows "Failed to add guitar build. Please try again."

#### Scenario: Successful creation
- **WHEN** the user opens "Add New Build", enters "Test Guitar #1", chooses "Steel-string", leaves the BOBO neck checked and presses "Add Build"
- **THEN** a steel-string build with a BOBO neck named "Test Guitar #1" owned by the user is created
- **AND** the dialog closes and the browser shows the new build's detail page
- **AND** returning to the list shows the new build first

#### Scenario: No double submission
- **WHEN** the user presses "Add Build" twice quickly
- **THEN** only one build is created

#### Scenario: Creation fails
- **WHEN** the server rejects the new build
- **THEN** the message "Failed to add guitar build. Please try again." is shown
- **AND** the dialog remains open with the entered name

### Requirement: New Build Defaults
The system SHALL initialize every new build as follows:
- the guitar type and BOBO neck choice are those entered in the creation dialog;
- sharing is disabled and there is no share link;
- the creation and last-update timestamps are set to the current time;
- every step of the default step template (`build-sequence`) is not completed and has no notes, photos or measurements.

#### Scenario: Fresh build has an untouched sequence
- **WHEN** a user creates a classical build with a BOBO neck and opens its "Sequence Diagram" tab
- **THEN** the 120 steps that apply to that variant are shown and none is marked completed

#### Scenario: Fresh build is not shared
- **WHEN** a user creates a build and opens its share dialog
- **THEN** public access is shown as off and no share link exists

### Requirement: Build Detail Header
The system SHALL show a header on a build's detail page with the following elements:
- a "Back to Builds" control that returns to `/builds`;
- a "Share" action that opens the sharing dialog (`build-story-sharing`);
- a "Delete Build" action;
- the build name as the title;
- the guitar type and, when chosen, "BOBO neck", or "Guitar type not set" for a migrated build without one;
- "Created <date>", showing the creation date without a time, for example "Dec 6, 2025".

#### Scenario: Header content
- **GIVEN** a steel-string build with a BOBO neck named "Build #1", created on 6 December 2025
- **WHEN** the user opens its detail page
- **THEN** the header shows "Build #1", "Steel-string", "BOBO neck" and "Created Dec 6, 2025"
- **AND** it offers "Back to Builds", "Share" and "Delete Build"

#### Scenario: Back to list
- **WHEN** the user presses "Back to Builds"
- **THEN** the browser navigates to `/builds`

### Requirement: Build Summary Strip
The system SHALL show under the build detail header a summary strip with: the progress bar and "<C> of <T> steps · <P>%" (as the public story computes them, `build-story-sharing`); the latest step measurement's frequency, or "No measurement yet"; and "Next up": the first ready step in template order (`build-sequence`), which opens that step's details when activated, or "All steps done".

#### Scenario: Summary of a build in progress
- **GIVEN** a steel-string build with a BOBO neck, 30 completed steps, a latest measurement of 181.6 Hz and FitTopBack as its first ready step
- **WHEN** its owner opens the detail page
- **THEN** the strip shows "30 of 120 steps · 25%", "181.6 Hz" and "Next up: Fit top and back"

#### Scenario: Next up opens the step
- **WHEN** the owner activates "Next up: Fit top and back"
- **THEN** the Sequence tab is shown with the details of "Fit top and back" open

### Requirement: Build Detail Tabs
The system SHALL organize the detail page into two tabs: "Overview", which is selected when the page opens, and "Sequence Diagram", which shows the build's process diagram (`build-sequence`). The selected tab is not part of the URL, so opening or reloading the page always starts on Overview.

#### Scenario: Switching to the sequence tab
- **WHEN** the user selects "Sequence Diagram"
- **THEN** the build's process diagram is shown and the acoustic analysis tools are hidden

#### Scenario: Reload resets the tab
- **GIVEN** the user is on the "Sequence Diagram" tab
- **WHEN** the user reloads the page
- **THEN** the "Overview" tab is selected

### Requirement: Build Overview Tab
The system SHALL show on the Overview tab a "Construction" section with the build's guitar type and BOBO neck choice, with a "Change" action for the owner. Below it the tab SHALL show the build's acoustic analysis tools and saved acoustic results (`build-acoustic-analysis`).

#### Scenario: Overview shows the construction variant
- **GIVEN** a classical build without a BOBO neck
- **WHEN** its owner opens the detail page
- **THEN** the Overview tab shows "Classical" and "BOBO neck: No" with a "Change" action
- **AND** the acoustic analysis tools are shown below the construction section

### Requirement: Change Construction Variant
The system SHALL let a build's owner change its guitar type and BOBO neck choice at any time. The sequence diagram, the progress figures and the public story then show only the steps that apply to the new variant (`build-sequence`). Steps that become hidden keep their completion, notes, photos and measurements, which reappear if the variant is changed back.

#### Scenario: Switching from steel-string to classical
- **GIVEN** a steel-string build whose "Fabricate SS bridge blank" step has notes
- **WHEN** the owner changes the guitar type to "Classical"
- **THEN** the steel-string bridge steps disappear from the diagram and the classical bridge steps appear
- **AND** changing back to "Steel-string" shows "Fabricate SS bridge blank" with its notes again

#### Scenario: Migrated build without a guitar type
- **GIVEN** a migrated build whose guitar type is not set
- **WHEN** its owner opens the Overview tab
- **THEN** the construction section reads "Guitar type not set" and invites the owner to choose one, so that steps that don't apply are hidden

### Requirement: Build Deep Links
The system SHALL expose bookmarkable URLs: `/builds` opens the builds list and `/builds/<build id>` opens that build's detail page. The root path `/` and any unknown path SHALL redirect to `/builds`.
- Opening `/builds/<build id>` directly shows "Loading build..." until the build is available.
- A visitor who is not signed in is asked to sign in first (`user-auth`). After signing in, the visitor sees the page at the requested URL.

#### Scenario: Direct link to an own build
- **GIVEN** a signed-in user who owns build X
- **WHEN** the user opens `/builds/X` in a new browser tab
- **THEN** the detail page of build X is shown

#### Scenario: Root path
- **WHEN** a signed-in user opens `/`
- **THEN** the browser is redirected to `/builds`

#### Scenario: Signed-out visitor follows a build link
- **WHEN** a visitor who is not signed in opens `/builds/X`
- **THEN** the sign-in screen is shown
- **AND** after signing in as the owner of X, the detail page of build X is shown

### Requirement: Inaccessible Build Links
The system SHALL redirect the user to `/builds` when a `/builds/<build id>` link points to a build that does not exist or that the user may not read.

#### Scenario: Link to another user's build
- **WHEN** a signed-in regular user opens `/builds/Y` and Y belongs to another user
- **THEN** the user is redirected to `/builds`

#### Scenario: Link to a deleted build
- **WHEN** a signed-in user opens a link to a build that has been deleted
- **THEN** the user is redirected to `/builds`

### Requirement: Delete Build Confirmation
The system SHALL delete a build only after the user confirms a dialog titled "Delete Build" with the message "Are you sure you want to delete this guitar build?" and the actions "Delete" and "Cancel".
- Confirming deletes the build permanently, removes it from the list and returns the user to `/builds`.
- Cancelling, or closing the dialog, changes nothing.
- If the deletion fails, the user is told "Failed to delete guitar build" and the build remains.

#### Scenario: Confirmed deletion
- **WHEN** the user presses "Delete Build" and then "Delete"
- **THEN** the build is removed
- **AND** the user is on `/builds` and the build no longer appears in the list

#### Scenario: Cancelled deletion
- **WHEN** the user presses "Delete Build" and then "Cancel"
- **THEN** the dialog closes and the build is unchanged

#### Scenario: Deletion fails
- **WHEN** the server rejects the deletion
- **THEN** the message "Failed to delete guitar build" is shown and the build still exists

### Requirement: Delete Build Cascade
The system SHALL remove the following together with a deleted build:
- its saved acoustic results (`build-acoustic-analysis`);
- its whole step state: completion, notes, photo references and step measurements;
- the photo files stored for its steps;
- its share link, which stops working.

Wood panels that reference the build SHALL be kept, with the reference removed.

#### Scenario: Shared build is deleted
- **GIVEN** a build with sharing enabled
- **WHEN** the owner deletes the build
- **THEN** its public story link shows the "Story Not Found" page

#### Scenario: Step photos are removed
- **GIVEN** a build with photos attached to its steps
- **WHEN** the build is deleted
- **THEN** the photo files are no longer stored or reachable

#### Scenario: Linked wood panel survives
- **GIVEN** a wood panel that references build X
- **WHEN** build X is deleted
- **THEN** the wood panel still exists and no longer references any build

### Requirement: Build Ownership
The system SHALL restrict each build to its owner: a regular signed-in user SHALL only be able to list, open, modify, share and delete builds that the user created.
- Other users and anonymous visitors cannot read a build. The only exception is the public story, which is reached through a valid share link (`build-story-sharing`).
- A shared build never appears in another user's Builds list.
- When a user account is deleted, all builds owned by that user are deleted with it.

#### Scenario: Users see only their own builds
- **GIVEN** user A owns builds A1 and A2, and user B owns build B1, which has sharing enabled
- **WHEN** user A opens the Builds page
- **THEN** only A1 and A2 are listed

#### Scenario: Non-owner cannot modify
- **WHEN** a regular user attempts to change or delete a build owned by another user
- **THEN** the server refuses the change and the build is unchanged

### Requirement: Administrator Access to Builds
The system SHALL let an administrator open any user's build read-only, through a direct link or the admin console, and SHALL NOT let an administrator change, share or delete a build that another user owns. The administrator's own Builds list SHALL show only builds that the administrator owns. Editing controls are not offered on another user's build.

#### Scenario: Administrator list shows own builds
- **GIVEN** an administrator who owns one build while other users own ten builds
- **WHEN** the administrator opens the Builds page
- **THEN** only the administrator's single build is listed

#### Scenario: Administrator opens another user's build
- **WHEN** an administrator opens `/builds/<id of another user's build>`
- **THEN** the build's detail page is shown read-only, without delete, share, variant-change, step-editing or analysis-saving controls

#### Scenario: Administrator cannot delete another user's build
- **WHEN** an administrator sends a request to delete or change another user's build
- **THEN** the server refuses it and the build is unchanged

#### Scenario: Administrator cannot share another user's build
- **WHEN** an administrator tries to enable sharing on another user's build
- **THEN** the request is refused and the build stays unshared

### Requirement: Persisted Build Attributes
The system SHALL store these attributes for each build:
- identifier: a system-generated UUID;
- owner: a reference to a user; required;
- name: text; required;
- guitar type: classical, steel-string or not set (only for migrated builds);
- BOBO neck: a boolean; required;
- sequence state: a structured document (`build-sequence`); absent means no step started;
- share token: a UUID; optional;
- share-enabled flag: a boolean; default false;
- created-at and updated-at: timestamps with time zone.

#### Scenario: Stored attributes after creation
- **WHEN** a build named "Build #7" is created
- **THEN** the stored record has a new identifier, the creator as owner, name "Build #7", the chosen guitar type and BOBO neck choice, share enabled false, no share token, a sequence state with every template step not completed, and equal created and updated timestamps

#### Scenario: Update timestamp moves on change
- **WHEN** a step of a build is marked completed
- **THEN** the build's updated-at timestamp changes to the time of that change

### Requirement: Builds Localization
The system SHALL present all text of the builds list, the creation dialog, the detail page and the deletion dialog in English and French according to the user's selected language. This includes the tab labels, the "Share" action, the guitar type names and the formatting of dates.

#### Scenario: French user
- **GIVEN** the user selected French
- **WHEN** the user opens a build's detail page
- **THEN** the back control, the tab labels, the Share and Delete actions and the creation date are shown in French
