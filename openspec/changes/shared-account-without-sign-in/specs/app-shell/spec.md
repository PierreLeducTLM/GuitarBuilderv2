## MODIFIED Requirements

### Requirement: Authenticated Access Gate
The system SHALL require a signed-in session for every URL except the public build-story URL, and SHALL show the sign-in screen (see user-auth) instead of the shell to a visitor without a session. The requested URL is kept while the visitor signs in; once signed in, the shell renders that URL, subject to the redirect and admin-only rules of this capability. When the operator has configured a shared account (see user-auth), the system SHALL instead sign a visitor without a session in to that account on the server, never show the sign-in screen, and send a visitor who opens `/sign-in` on to the requested URL or `/builds`. If signing in to the shared account fails, the sign-in screen is shown.

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
- **THEN** the Builds section is shown at `/builds`

### Requirement: Sign Out From the Shell
The system SHALL offer a sign-out action in the desktop user dropdown and in the mobile slide-out menu, and on success SHALL end the session and show the sign-in screen. If signing out fails, the system SHALL show the message "Failed to sign out" and the user remains signed in. While a shared account is configured, the system SHALL NOT offer sign-out.

#### Scenario: Successful sign-out
- **WHEN** the user selects "Sign Out"
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
