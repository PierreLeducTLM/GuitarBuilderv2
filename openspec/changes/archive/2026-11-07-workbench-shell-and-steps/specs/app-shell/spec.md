## MODIFIED Requirements

### Requirement: Application Sections and URLs
The system SHALL organize the signed-in application into four destinations, in this order: Builds, Tools, Assistant and You. Each destination and each section under it has a bookmarkable URL. Administrators additionally have the References and Admin sections. The URLs and labels (English / French) are listed in the scenarios.

#### Scenario: Destinations and their URLs
- **WHEN** a signed-in user uses the navigation
- **THEN** it offers Builds / Constructions at `/builds`, Tools / Outils at `/tools`, Assistant / Assistant at `/chat` and You / Vous at `/you`

#### Scenario: Sections under Builds and Tools
- **WHEN** the URLs of the application are listed
- **THEN** Builds holds `/builds` and the build URLs of `guitar-builds`
- **AND** Tools holds Wood panels / Panneaux de bois at `/wood-properties` and Simulator / Simulateur at `/simulator`

#### Scenario: Administrator sections
- **WHEN** the URLs available to an administrator are listed
- **THEN** they also include References / Références at `/references` and Admin / Admin at `/admin`

#### Scenario: Navigating between sections
- **GIVEN** the user is on `/builds`
- **WHEN** the user selects "Tools" in the navigation
- **THEN** the URL becomes `/tools`
- **AND** the Tools page is displayed

#### Scenario: Opening a build detail URL directly
- **WHEN** a signed-in user opens `/builds/<id of one of their builds>`
- **THEN** the Builds destination shows that build's page

### Requirement: Navigation Entry Presentation
The system SHALL show each navigation entry with an icon and its label, and SHALL highlight as active the most specific entry that contains the current URL. A destination's tab is active for every URL it holds, so the Tools tab is active on `/tools`, `/wood-properties` and `/simulator`; in the sidebar, the section's own entry is active instead. The browser tab title is "Guitar Build Tracking App".

#### Scenario: Active section for a nested URL
- **WHEN** the user is viewing `/builds/7f3c-example/steps/TopPanel`
- **THEN** the Builds entry is highlighted as active
- **AND** no other destination entry is highlighted

#### Scenario: Active entry for a tool
- **WHEN** the user is viewing `/wood-properties`
- **THEN** the Tools tab is highlighted as active on a narrow viewport
- **AND** the Wood panels entry is highlighted as active in the sidebar on a wide viewport

### Requirement: Default and Unknown Route Redirects
The system SHALL redirect `/`, and any URL that does not match a section or page available to the current user, to `/builds`, replacing the current browser-history entry. Selecting the application title or logo in the desktop sidebar SHALL also navigate to `/builds`.

#### Scenario: Root URL
- **WHEN** a signed-in user opens `/`
- **THEN** the user is redirected to `/builds`

#### Scenario: Unknown URL
- **WHEN** a signed-in user opens `/does-not-exist`
- **THEN** the user is redirected to `/builds`
- **AND** pressing the browser Back button does not return to `/does-not-exist`

#### Scenario: Title click
- **WHEN** the user clicks the application title in the desktop sidebar
- **THEN** the Builds list at `/builds` is displayed

### Requirement: Admin-Only Sections
The system SHALL show the References and Admin entries only to users whose role is admin, and SHALL treat `/references` and `/admin` as unknown routes (redirect to `/builds`) for users who are not administrators. Hiding entries is a convenience only; the server independently enforces administrator-only operations (see admin-console).

#### Scenario: Regular user navigation
- **GIVEN** a signed-in user whose role is user
- **WHEN** the desktop sidebar or the You page is displayed
- **THEN** no References or Admin entry is shown

#### Scenario: Regular user opens an admin URL
- **GIVEN** a signed-in user whose role is user
- **WHEN** the user opens `/admin` or `/references`
- **THEN** the user is redirected to `/builds`

#### Scenario: Administrator navigation
- **GIVEN** a signed-in user whose role is admin
- **WHEN** the desktop sidebar or the You page is displayed
- **THEN** it shows References and Admin entries, in that order

#### Scenario: Bottom tab bar has no admin entries
- **GIVEN** a signed-in administrator on a narrow viewport
- **WHEN** the bottom tab bar is displayed
- **THEN** it shows Builds, Tools, Assistant and You only

### Requirement: Admin Entries Visually Distinguished
The system SHALL visually distinguish the References and Admin entries from regular entries (a distinct accent colour, in both active and inactive states) wherever they appear: the desktop sidebar and the You page.

#### Scenario: Administrator sees distinguished entries
- **GIVEN** a signed-in administrator
- **WHEN** the desktop sidebar or the You page is displayed
- **THEN** References and Admin use an accent colour different from the other entries

### Requirement: Mobile Bottom Tab Bar
The system SHALL, on viewports narrower than 1024 px, show a tab bar fixed to the bottom of the screen with one entry (icon and label) per destination: Builds, Tools, Assistant and You, highlighting the active one. It is the only navigation on these viewports. It is hidden on step screens (`build-sequence`); elsewhere page content leaves room so the bar never hides it.

#### Scenario: Bottom tab bar navigation
- **GIVEN** a signed-in user on a narrow viewport
- **WHEN** the user taps "Tools" in the bottom tab bar
- **THEN** the URL becomes `/tools`
- **AND** the "Tools" tab is highlighted as active

#### Scenario: No duplicate menu
- **GIVEN** a signed-in user on a narrow viewport
- **WHEN** any shell page is displayed
- **THEN** no menu button or slide-out menu is offered

#### Scenario: Step screen hides the bar
- **GIVEN** a signed-in user on a narrow viewport
- **WHEN** the user opens a step screen
- **THEN** the bottom tab bar is not shown

#### Scenario: Content is not hidden by the bar
- **GIVEN** a signed-in user on a narrow viewport
- **WHEN** the user scrolls to the end of a long page
- **THEN** the last content of the page is fully visible above the bar

### Requirement: Preferences Reachable On All Viewports
The system SHALL make the language switcher and the theme selector reachable on every viewport, on the You page.

#### Scenario: Change language on a phone
- **GIVEN** a signed-in user on a narrow viewport
- **WHEN** the user opens You
- **THEN** the EN/FR switcher and the theme selector are available

#### Scenario: Change theme on a desktop
- **GIVEN** a signed-in user on a wide viewport
- **WHEN** the user selects the account entry in the sidebar
- **THEN** the You page shows the EN/FR switcher and the theme selector

### Requirement: Sign Out From the Shell
The system SHALL offer a "Sign Out" action on the You page and, on success, SHALL end the session and show the sign-in screen. If signing out fails, the system SHALL show the message "Failed to sign out" and the user remains signed in.

#### Scenario: Successful sign-out
- **WHEN** the user selects "Sign Out" on the You page
- **THEN** the session ends
- **AND** the sign-in screen is shown

#### Scenario: Sign-out failure
- **GIVEN** the authentication service rejects the sign-out request
- **WHEN** the user selects "Sign Out"
- **THEN** the message "Failed to sign out" is shown
- **AND** the user stays in the shell

## ADDED Requirements

### Requirement: Desktop Sidebar
The system SHALL, on viewports at least 1024 px wide, show a sidebar along the left edge that stays in place while the page scrolls. It holds the application title and logo, the destinations and their sections, the user's recent builds, the admin entries for administrators, and an account entry. The scenarios give the order. No bottom tab bar is shown on these viewports.

#### Scenario: Sidebar content
- **GIVEN** a signed-in administrator on a viewport 1280 px wide
- **WHEN** the shell is displayed
- **THEN** the sidebar shows, from top to bottom: "Guitar Builder" with the logo; Builds with the recent builds under it; Tools with Wood panels and Simulator; Assistant; References and Admin; and the account entry showing the user's email address
- **AND** no bottom tab bar is shown

#### Scenario: Recent builds
- **GIVEN** a user who owns 7 builds
- **WHEN** the sidebar is displayed
- **THEN** it lists the 5 builds the user changed most recently, most recent first, each linking to that build's page
- **AND** the build being viewed is highlighted

#### Scenario: Administrator's recent builds
- **GIVEN** an administrator viewing another user's build
- **WHEN** the sidebar is displayed
- **THEN** the recent builds list only the administrator's own builds

#### Scenario: Account entry
- **WHEN** the user selects the account entry
- **THEN** the URL becomes `/you`

### Requirement: Page Bar
The system SHALL show at the top of every shell page a bar with the page's title, and on pages below a destination a control that returns to the parent page (for example "Builds" on a build page). Actions that belong to the page appear in this bar. There is no separate global header.

#### Scenario: Build page bar
- **WHEN** the user opens one of their builds
- **THEN** the bar shows the build name, a "Builds" control that returns to `/builds`, and the build's actions (`guitar-builds`)

#### Scenario: Top-level page bar
- **WHEN** the user opens `/tools`
- **THEN** the bar shows "Tools" and no return control

### Requirement: Tools Page
The system SHALL provide at `/tools` a page that lists the tools, each with its icon, name and a one-line description, in this order: Wood panels, Simulator. Selecting a tool opens its section.

#### Scenario: Open a tool
- **GIVEN** a signed-in user on `/tools`
- **WHEN** the user selects "Wood panels"
- **THEN** the URL becomes `/wood-properties`
- **AND** the wood panel calculator is displayed

#### Scenario: Return from a tool on a phone
- **GIVEN** a signed-in user on a narrow viewport viewing `/wood-properties`
- **WHEN** the user selects the page bar's return control
- **THEN** the Tools page at `/tools` is displayed

### Requirement: You Page
The system SHALL provide at `/you` a page with: "Signed in as" and the user's email address; the language switcher; the theme selector; for administrators only, an "Administration" group with References and Admin; and the "Sign Out" action.

#### Scenario: Regular user's You page
- **GIVEN** a signed-in user whose role is user
- **WHEN** the user opens `/you`
- **THEN** the page shows the email address, the EN/FR switcher, the theme selector and "Sign Out"
- **AND** no "Administration" group is shown

#### Scenario: Administrator's You page
- **GIVEN** a signed-in administrator
- **WHEN** the administrator opens `/you`
- **THEN** an "Administration" group with References and Admin is shown above "Sign Out"

## REMOVED Requirements

### Requirement: Desktop Header
**Reason**: The two-row sticky header is replaced by a left sidebar and a per-page bar, which free vertical space and show recent builds.
**Migration**: See Desktop Sidebar and Page Bar. Language and theme move to the You Page.

### Requirement: Desktop User Menu
**Reason**: The account is reached from the sidebar's account entry instead of a dropdown with a single action.
**Migration**: See Desktop Sidebar (Account entry), You Page and Sign Out From the Shell.

### Requirement: Mobile Slide-Out Menu
**Reason**: It repeated the bottom tab bar's sections; narrow viewports now have one navigation.
**Migration**: Sections are reached from the Mobile Bottom Tab Bar and the Tools Page; account, preferences, admin entries and sign-out are on the You Page.
