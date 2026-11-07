## MODIFIED Requirements

### Requirement: Authentication Configuration
The system SHALL let the operator configure: the authentication service endpoint and its public client key, whether new sign-ups are allowed, whether email verification is required, the site address used in verification-email links, and optionally a shared account (email address and password) that every visitor is signed in to (see app-shell: Authenticated Access Gate). Missing endpoint or key configuration SHALL stop the application from starting. The shared account is configured only when both its email address and password are set; its password SHALL never reach the browser.

#### Scenario: Sign-ups disabled
- **GIVEN** the operator has disabled new sign-ups
- **WHEN** a visitor submits the sign-up form
- **THEN** the authentication service rejects the registration and its reason is shown

#### Scenario: Partial shared account
- **GIVEN** the operator has set the shared account's email address but not its password
- **WHEN** a visitor without a session opens `/builds`
- **THEN** the sign-in screen is shown
