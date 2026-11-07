# app-shell Specification

## Purpose
The application shell is the frame every signed-in user works in. It provides the section navigation (Builds, Chat, Simulator, Wood Properties, and the admin-only References and Admin sections), shows who is signed in and offers sign-out, applies the user's theme and language preferences, and defines which URLs are public. It also provides shared interaction patterns (confirmation dialog, text-input dialog, toast notifications) that other capabilities rely on.

## Requirements

### Requirement: Authenticated Access Gate
The system SHALL require a signed-in session for every URL except the public build-story URL, and SHALL show the sign-in screen (see user-auth) instead of the shell to a visitor without a session. The requested URL is kept while the visitor signs in; once signed in, the shell renders that URL, subject to the redirect and admin-only rules of this capability. When a shared account is configured (see user-auth), the system SHALL instead sign such a visitor in to it on the server.

#### Scenario: Visitor without a session opens a section URL
- **GIVEN** no signed-in session exists in the browser
- **AND** no shared account is configured
- **WHEN** the visitor opens `/builds`
- **THEN** the sign-in screen is shown
- **AND** no navigation, header or section content of the shell is shown

#### Scenario: Signing in keeps the requested section
- **GIVEN** the visitor opened `/chat` and was shown the sign-in screen
- **WHEN** the visitor signs in successfully
- **THEN** the Chat section is displayed at `/chat`

#### Scenario: Shared account configured
- **GIVEN** a shared account is configured
- **AND** no signed-in session exists in the browser
- **WHEN** the visitor opens `/builds`
- **THEN** the visitor is signed in to the shared account
- **AND** the Builds section is shown with the shared account's builds

#### Scenario: Sign-in URL with a shared account
- **GIVEN** a shared account is configured
- **WHEN** the visitor opens `/sign-in`
- **THEN** the sign-in screen is never shown, and the visitor is sent on to the requested URL, or to the Builds section at `/builds` when none was kept

#### Scenario: Shared account sign-in fails
- **GIVEN** a shared account is configured
- **AND** signing in to it fails
- **WHEN** a visitor without a session opens `/builds`
- **THEN** the sign-in screen is shown

### Requirement: Session Restore Loading State
The system SHALL show a full-screen loading indicator ("Loading...") while it determines on page load whether a stored session exists, instead of showing either the sign-in screen or the shell.

#### Scenario: Session restore in progress
- **WHEN** a page is loaded and the system is still determining whether a stored session exists
- **THEN** a full-screen loading indicator is shown
- **AND** neither the sign-in form nor the shell is shown yet

### Requirement: Public Build Story Route
The system SHALL serve every URL of the form `/story/<share token>` without requiring sign-in and without the shell (no header, navigation, or user menu), whether or not the visitor has a session. The content and access rules of the story page are specified by the build-sharing capability.

#### Scenario: Anonymous visitor opens a story link
- **GIVEN** no signed-in session exists
- **WHEN** the visitor opens `/story/abc123`
- **THEN** the public story page for that token is shown
- **AND** the sign-in screen is not shown

#### Scenario: Signed-in user opens a story link
- **GIVEN** the user is signed in
- **WHEN** the user opens `/story/abc123`
- **THEN** the public story page is shown without the shell's header and navigation

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

### Requirement: Admin Deep Links Wait For Role
The system SHALL NOT redirect away from an admin-only URL until the signed-in user's role has been loaded from their profile (see user-auth), so that administrators can bookmark and reload `/admin` and `/references`. Until the role is known, admin-only navigation entries are hidden.

#### Scenario: Administrator reloads the admin console
- **GIVEN** a signed-in administrator is on `/admin`
- **WHEN** the administrator reloads the page
- **THEN** the admin console is displayed at `/admin` once the role has been loaded
- **AND** the administrator is not redirected to `/builds`

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
The system SHALL offer a "Sign Out" action on the You page and, on success, SHALL end the session and show the sign-in screen. If signing out fails, the system SHALL show the message "Failed to sign out" and the user remains signed in. While a shared account is configured, the system SHALL NOT offer sign-out.

#### Scenario: Successful sign-out
- **WHEN** the user selects "Sign Out" on the You page
- **THEN** the session ends
- **AND** the sign-in screen is shown

#### Scenario: Sign-out failure
- **GIVEN** the authentication service rejects the sign-out request
- **WHEN** the user selects "Sign Out"
- **THEN** the message "Failed to sign out" is shown
- **AND** the user stays in the shell

#### Scenario: No sign-out with a shared account
- **GIVEN** a shared account is configured
- **WHEN** the user opens the You page
- **THEN** no "Sign Out" action is shown

### Requirement: Theme Selection and Persistence
The system SHALL let the user choose among Light, System and Dark themes with a three-option control (tooltips "Light Mode", "System Theme", "Dark Mode") that highlights the active option, apply the choice immediately, and persist it in the browser (per browser, not per account). When nothing is stored the theme is System.

#### Scenario: Choose dark theme
- **WHEN** the user selects Dark
- **THEN** the interface switches to the dark appearance immediately
- **AND** after reloading the page the dark appearance is still applied and Dark is shown as active

#### Scenario: Nothing stored
- **GIVEN** no theme preference is stored in the browser
- **WHEN** the user opens the application
- **THEN** System is shown as the active theme option

### Requirement: System Theme Follows Device Preference
The system SHALL, while System is selected, use the dark appearance when the operating system or browser prefers a dark colour scheme and the light appearance otherwise, and SHALL follow changes to that preference while the application is open.

#### Scenario: First visit with a dark device
- **GIVEN** no theme preference is stored and the operating system prefers dark
- **WHEN** the user opens the application
- **THEN** the dark appearance is applied

#### Scenario: System preference changes
- **GIVEN** the user has selected System and the operating system prefers light
- **WHEN** the operating system preference switches to dark
- **THEN** the interface switches to the dark appearance

### Requirement: Theme Applies To All Screens
The system SHALL apply the stored theme to every screen it renders, including the loading screen, the sign-in screen and the public story page, not only to the signed-in shell.

#### Scenario: Sign-in screen honours the theme
- **GIVEN** the browser has Dark stored as the theme preference and no session exists
- **WHEN** the visitor opens the application
- **THEN** the sign-in screen is shown with the dark appearance

### Requirement: Language Switching
The system SHALL display all interface text in English or French, let the user switch with an EN/FR control that highlights the active language, apply the switch immediately without reloading, and persist the choice in the browser.

#### Scenario: Switch to French
- **GIVEN** the interface is in English
- **WHEN** the user clicks "FR"
- **THEN** interface text switches to French immediately (for example "Builds" becomes "Constructions" and "Sign Out" becomes "Déconnexion")
- **AND** "FR" is highlighted

#### Scenario: Language persists across visits
- **GIVEN** the user previously selected French in this browser
- **WHEN** the user opens the application again
- **THEN** the interface is displayed in French

### Requirement: Initial Language and Fallback
The system SHALL start in the language previously chosen in this browser, or in English if none was chosen, and SHALL show the English text for any text that has no French translation. Translations are loaded per language at runtime, so a language can be added without changing feature behavior.

#### Scenario: First visit defaults to English
- **GIVEN** no language choice is stored in the browser
- **WHEN** the user opens the application
- **THEN** the interface is displayed in English

#### Scenario: Missing French translation
- **GIVEN** the interface is in French and a piece of text has no French translation
- **WHEN** that text is displayed
- **THEN** its English text is shown

### Requirement: Confirmation Dialog
The system SHALL provide a reusable modal confirmation dialog that any feature uses before a destructive or significant action, showing a title, a message, a cancel button and a confirm button, and performing the action only when the user confirms. The cancel button, a close (×) button and clicking the dimmed backdrop all dismiss it without performing the action; while open it blocks the page behind.

#### Scenario: User confirms
- **GIVEN** a feature has opened the confirmation dialog for an action
- **WHEN** the user clicks the confirm button
- **THEN** the action is performed
- **AND** the dialog closes

#### Scenario: User dismisses via backdrop
- **GIVEN** the confirmation dialog is open
- **WHEN** the user clicks the dimmed backdrop outside the dialog
- **THEN** the dialog closes
- **AND** the action is not performed

### Requirement: Confirmation Dialog Labels and Severity
The system SHALL label the confirmation dialog buttons "Confirm" and "Cancel" (localized) unless the calling feature supplies its own labels (for example "Delete"), and SHALL support a severity variant (danger, warning, or info; warning by default) that changes the emphasis of the confirm button. Danger is used for irreversible deletions.

#### Scenario: Deletion confirmation
- **GIVEN** a feature opens the dialog with variant danger and confirm label "Delete"
- **WHEN** the dialog is displayed
- **THEN** the confirm button reads "Delete" and is emphasised as a dangerous action
- **AND** the cancel button reads "Cancel" (or "Annuler" in French)

### Requirement: Text Input Dialog
The system SHALL provide a reusable modal dialog that asks for one line of text, showing a title, an optional message, an optional placeholder and an initial value, and returning the entered text only when the user confirms. Default button labels are "Save" and "Cancel" (localized) unless the calling feature supplies its own. It appears above any other open dialog.

#### Scenario: Cancel the input dialog
- **GIVEN** the text input dialog is open
- **WHEN** the user clicks the close (×) button, the cancel button, or the backdrop
- **THEN** the dialog closes and no value is returned

### Requirement: Text Input Dialog Value Handling
The system SHALL, when the text input dialog opens, pre-fill the input with the initial value, focus it and select its text; confirming (button or Enter key) SHALL return the value with leading and trailing whitespace removed, and the confirm button SHALL be disabled while the trimmed value is empty.

#### Scenario: Enter and confirm text
- **GIVEN** the text input dialog is open with initial value "Resonance Analysis"
- **WHEN** the user replaces the text with "  Top tap test  " and presses Enter
- **THEN** the dialog returns "Top tap test"

#### Scenario: Blank input cannot be confirmed
- **GIVEN** the text input dialog is open
- **WHEN** the input contains only spaces
- **THEN** the confirm button is disabled

### Requirement: Toast Notifications
The system SHALL provide transient toast notifications that any feature can raise with a type (success, error, warning, or info) and a message, displayed prominently over the page with a type-specific icon and accent. Several toasts may be visible at once and stack without overlapping; toasts do not block interaction with the rest of the page.

#### Scenario: Feature raises an error toast
- **WHEN** a feature raises an error toast with the message "Save failed"
- **THEN** a toast with an error icon and the text "Save failed" appears over the page

### Requirement: Toast Dismissal
The system SHALL remove a toast automatically after its duration (default 3 seconds) with a brief fade-out of about 300 ms, and SHALL give each toast a close (×) button that dismisses it immediately.

#### Scenario: Toast auto-dismisses
- **GIVEN** a feature raises a success toast without a custom duration
- **WHEN** 3 seconds have elapsed
- **THEN** the toast fades out and is removed

#### Scenario: Toast dismissed manually
- **GIVEN** an error toast is visible
- **WHEN** the user clicks its close (×) button
- **THEN** the toast is removed immediately

### Requirement: Direct Links and Reloads
The system SHALL load correctly when any section URL or public story URL is opened directly, bookmarked, shared, or reloaded, rather than only when reached by in-app navigation.

#### Scenario: Reload a section
- **GIVEN** a signed-in user is on `/simulator`
- **WHEN** the user reloads the browser page
- **THEN** the Simulator section is displayed at `/simulator`

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
