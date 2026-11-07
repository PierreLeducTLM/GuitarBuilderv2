# user-auth Specification

## Purpose
Lets people create an account and sign in with an email address and password, keeps them signed in across visits, and signs them out. It defines what the system creates for a new account (a profile carrying a role), how roles are assigned (the first account becomes administrator), and what the user and admin roles mean for data access across the application.

## Requirements

### Requirement: Sign-In Screen
The system SHALL present, to visitors without a session, a sign-in screen showing the application title, a subtitle ("Welcome back" in sign-in mode, "Create your account" in sign-up mode), Email and Password fields, a submit button ("Sign In" or "Sign Up"), a link to switch modes, and the note "By continuing, you agree to track your guitar builds securely". All of its text is available in English and French.

#### Scenario: Default mode
- **WHEN** a visitor without a session opens the application
- **THEN** the sign-in screen is shown in sign-in mode with the subtitle "Welcome back" and a "Sign In" button
- **AND** the link "Don't have an account? Sign up" is shown

### Requirement: Sign In With Email and Password
The system SHALL authenticate a user with their email address and password and, on success, show the application shell at the URL the user had requested (see app-shell).

#### Scenario: Successful sign-in
- **GIVEN** an account exists for "luthier@example.com" with password "spruce123"
- **WHEN** the visitor enters those credentials in sign-in mode and submits
- **THEN** the user is signed in
- **AND** the application shell is displayed

### Requirement: Sign-In Failure
The system SHALL keep the visitor on the sign-in screen and show the failure reason reported by the authentication service (for example "Invalid login credentials" or "Email not confirmed") when sign-in is rejected; the entered email and password remain in the form.

#### Scenario: Wrong password
- **GIVEN** an account exists for "luthier@example.com"
- **WHEN** the visitor submits that email with an incorrect password
- **THEN** an error message stating the credentials are invalid is shown
- **AND** the visitor remains on the sign-in screen

### Requirement: Sign Up With Email and Password
The system SHALL let a visitor in sign-up mode create an account from an email address, a password and a matching "Confirm Password" field. On success the system SHALL show "Account created! Please check your email to verify your account." and clear all three fields.

#### Scenario: Successful sign-up
- **GIVEN** no account exists for "new@example.com"
- **WHEN** the visitor switches to sign-up mode, enters "new@example.com", password "maple456" twice, and submits
- **THEN** the account is created
- **AND** the message "Account created! Please check your email to verify your account." is shown and the fields are emptied

#### Scenario: Sign-up rejected by the authentication service
- **GIVEN** the authentication service rejects the registration (for example an invalid email)
- **WHEN** the visitor submits the sign-up form
- **THEN** the reason reported by the authentication service is shown as an error

### Requirement: Email Verification
The system SHALL support an operator setting that requires new users to verify their email address before their first sign-in. When it is enabled, sign-in of an unverified account is refused until the user follows the link in the verification email, which returns them to the application signed in. When it is disabled, a successful sign-up signs the user in immediately.

#### Scenario: Verification required
- **GIVEN** email verification is enabled and a visitor has just signed up
- **WHEN** the visitor tries to sign in before following the verification link
- **THEN** sign-in is refused with a message that the email is not confirmed

#### Scenario: Verification disabled
- **GIVEN** email verification is disabled
- **WHEN** a visitor completes sign-up successfully
- **THEN** the visitor is signed in and the application shell is displayed

### Requirement: Required Fields Validation
The system SHALL refuse to submit the form, without contacting the authentication service, when the email or password field is empty, showing "Please fill in all fields"; the email field SHALL accept only a syntactically valid email address.

#### Scenario: Empty password
- **WHEN** the visitor submits with an email but an empty password
- **THEN** the form is not submitted
- **AND** the visitor is told that all fields must be filled in

#### Scenario: Malformed email
- **WHEN** the visitor enters "not-an-email" as the email and submits
- **THEN** the form is not submitted and the email field is flagged as invalid

### Requirement: Password Length Validation
The system SHALL require passwords of at least 6 characters, rejecting shorter ones before contacting the authentication service with the message "Password must be at least 6 characters", and SHALL show the hint "Minimum 6 characters" under the password field in sign-up mode.

#### Scenario: Short password
- **WHEN** the visitor submits the password "abc12"
- **THEN** the message "Password must be at least 6 characters" is shown
- **AND** no request is sent to the authentication service

#### Scenario: Minimum length accepted
- **WHEN** the visitor submits a 6-character password with a valid email
- **THEN** the length rule does not block the submission

### Requirement: Password Confirmation Validation
The system SHALL, in sign-up mode, reject the submission with the message "Passwords do not match" when the Password and Confirm Password values differ, without contacting the authentication service.

#### Scenario: Mismatched confirmation
- **GIVEN** the form is in sign-up mode
- **WHEN** the visitor enters "maple456" as password and "maple457" as confirmation and submits
- **THEN** the message "Passwords do not match" is shown
- **AND** no account is created

### Requirement: Mode Switching
The system SHALL let the visitor toggle between sign-in and sign-up modes with the link "Don't have an account? Sign up" / "Already have an account? Sign in"; switching shows or hides the Confirm Password field, updates the subtitle and submit label, and clears any error or success message.

#### Scenario: Switch to sign-up
- **GIVEN** the form is in sign-in mode showing an error message
- **WHEN** the visitor clicks "Don't have an account? Sign up"
- **THEN** the Confirm Password field and a "Sign Up" button are shown
- **AND** the error message is cleared

### Requirement: Submission In Progress
The system SHALL, while a sign-in or sign-up request is pending, disable the fields, the submit button and the mode-switch link, and label the submit button "Please wait..."; each new submission first clears previous error and success messages. If the request fails unexpectedly (no reason available), the system SHALL show "An unexpected error occurred".

#### Scenario: Pending request
- **WHEN** the visitor submits valid credentials and the request has not completed
- **THEN** the submit button reads "Please wait..." and cannot be clicked again

#### Scenario: Unexpected failure
- **GIVEN** the authentication service cannot be reached
- **WHEN** the visitor submits the form
- **THEN** the message "An unexpected error occurred" is shown and the form is enabled again

### Requirement: Session Persistence and Restore
The system SHALL keep the user signed in across page reloads and browser restarts until they sign out or their session can no longer be renewed, restoring the stored session on page load without asking for credentials. Access is renewed automatically in the background (access credentials last about 1 hour; renewal tokens are rotated on use).

#### Scenario: Reload while signed in
- **GIVEN** the user signed in earlier in this browser and did not sign out
- **WHEN** the user opens the application again
- **THEN** the application shell is displayed without the sign-in screen

#### Scenario: Long session
- **GIVEN** the user has stayed signed in for more than one hour
- **WHEN** the user performs an action
- **THEN** the action succeeds without requiring the user to sign in again

### Requirement: Sign Out Ends Session
The system SHALL, when the user signs out (see app-shell for entry points), end the session in this browser, forget the user's profile and role, and show the sign-in screen.

#### Scenario: Sign out then reload
- **GIVEN** the user has signed out
- **WHEN** the page is reloaded
- **THEN** the sign-in screen is shown

### Requirement: Automatic Profile Creation
The server SHALL create a user profile automatically whenever a new account is created, without any action by the user or client. A failure to create the profile SHALL NOT prevent the account from being created; such an account is treated as a regular user until a profile exists.

#### Scenario: New account gets a profile
- **WHEN** a visitor completes sign-up
- **THEN** a profile exists for the new account with the account's email address and a role

#### Scenario: Profile creation fails
- **GIVEN** profile creation fails for a new account
- **WHEN** that user signs in
- **THEN** sign-in succeeds and the user has no administrator access

### Requirement: First Account Becomes Administrator
The server SHALL assign the role admin to a new account's profile when no other profile exists at the moment it is created, and the role user to every later account. Any further role change is made only by an administrator through the admin console.

#### Scenario: First sign-up on a fresh installation
- **GIVEN** no user profiles exist
- **WHEN** the first visitor signs up
- **THEN** their profile has the role admin
- **AND** they see the References and Admin sections after signing in

#### Scenario: Later sign-ups
- **GIVEN** at least one user profile exists
- **WHEN** another visitor signs up
- **THEN** their profile has the role user

### Requirement: User Account Data
The system SHALL store for each account: a unique identifier, the email address (unique, used to sign in), a password credential held only by the authentication service in non-reversible form, the time the email was verified (if it was), the creation time, and the last sign-in time.

#### Scenario: Duplicate email
- **GIVEN** an account exists for "luthier@example.com"
- **WHEN** a visitor tries to sign up again with "luthier@example.com"
- **THEN** no second account with that email is created

### Requirement: User Profile Data
The system SHALL store one profile per account with: the account identifier, the account's email address (copied at creation for display), the role (exactly one of user or admin; default user), the creation time and the last-updated time. A profile is deleted together with its account.

#### Scenario: Profile follows the account lifecycle
- **GIVEN** a user with a profile
- **WHEN** an administrator deletes that user's account
- **THEN** the user's profile no longer exists

### Requirement: User Roles
The system SHALL recognise exactly two roles, user and admin, read from the signed-in user's profile when the session starts or is restored. A user whose profile is missing or cannot be loaded SHALL be treated as role user.

#### Scenario: Role determines admin features
- **GIVEN** a signed-in user whose profile role is admin
- **WHEN** the profile has been loaded
- **THEN** the application treats the user as an administrator

#### Scenario: Missing profile
- **GIVEN** a signed-in user whose profile cannot be found
- **WHEN** the shell is displayed
- **THEN** the user has no administrator features

### Requirement: Role Changes Restricted
The system SHALL NOT let any user change their own role, and SHALL allow role changes only through the administrator role-change operation of the admin console. A role change takes effect for the affected user the next time their profile is loaded (sign-in or page reload).

#### Scenario: User tries to promote themselves
- **GIVEN** a signed-in user whose role is user
- **WHEN** they attempt to change their own profile's role to admin through any interface
- **THEN** the change is rejected and the role stays user

### Requirement: Profile Visibility
The system SHALL let each user read only their own profile, let administrators read every profile, and SHALL NOT let anyone delete a profile directly; profiles are removed only by deleting the account.

#### Scenario: Regular user cannot list other profiles
- **GIVEN** a signed-in user whose role is user
- **WHEN** they request other users' profiles
- **THEN** only their own profile is returned

### Requirement: Regular User Data Isolation
The system SHALL let a regular user see and change only their own private data (builds and their analyses, wood panels, chat conversations and messages), enforced on the server. The reference library is shared: every signed-in user can read all reference documents. Per-entity rules are specified by each owning capability.

#### Scenario: Another user's build is invisible
- **GIVEN** user A owns a build and user B has role user
- **WHEN** user B lists builds or requests A's build by its identifier
- **THEN** A's build is not returned to B

### Requirement: Administrator Cross-User Access
The server SHALL let administrators read every user's profiles, builds, build analyses, wood panels, chat conversations and messages, and SHALL NOT let them create, modify or delete any of those records. The only admin actions that affect another user are the role change and account deletion of `admin-console`. In the regular sections an administrator SHALL see only their own data.

#### Scenario: Admin console sees everything
- **GIVEN** three users each own two builds and one of them is an administrator
- **WHEN** the administrator opens the admin console
- **THEN** the build count shown is 6

#### Scenario: Admin's own Builds list
- **GIVEN** the same three users
- **WHEN** the administrator opens the Builds section
- **THEN** only the administrator's own two builds are listed

#### Scenario: Admin cannot change another user's data
- **WHEN** an administrator tries to update, delete or add a record in another user's builds, step data, saved analyses, wood panels or conversations, through any interface
- **THEN** the server refuses the request and the data is unchanged

### Requirement: New Accounts Start Empty
The system SHALL create new accounts with no builds, wood panels or conversations; default wood panels are not copied automatically at sign-up, and the user can load them on demand (see wood-panel-properties).

#### Scenario: First visit to Wood Props
- **GIVEN** a user who has just signed up
- **WHEN** they open the Wood Props section
- **THEN** their saved panel list is empty and they are offered the option to load the default panels

### Requirement: Authentication Configuration
The system SHALL let the operator configure: the authentication service endpoint and its public client key, whether new sign-ups are allowed, whether email verification is required, the site address used in verification-email links, and optionally a shared account that every visitor is signed in to (see app-shell: Authenticated Access Gate). Missing endpoint or key configuration SHALL stop the application from starting.

#### Scenario: Sign-ups disabled
- **GIVEN** the operator has disabled new sign-ups
- **WHEN** a visitor submits the sign-up form
- **THEN** the authentication service rejects the registration and its reason is shown

#### Scenario: Partial shared account
- **GIVEN** the shared account is configured only when both its email address and password are set
- **AND** the operator has set the email address but not the password
- **WHEN** a visitor without a session opens `/builds`
- **THEN** the sign-in screen is shown

#### Scenario: Shared account password stays on the server
- **GIVEN** a shared account is configured
- **WHEN** any page is sent to the browser
- **THEN** the shared account's password is not part of anything the browser receives
