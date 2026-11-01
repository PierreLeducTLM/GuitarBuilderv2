# admin-console Specification

## Purpose
The admin console at `/admin` is where administrators oversee the whole installation: system-wide statistics, user management (listing users, changing roles, deleting users together with all their data), the global wood-analysis prompt template, and the set of default wood panels offered to users. This capability also defines the server-side authorization that protects these operations regardless of what the client shows.

## Requirements

### Requirement: Admin Console Access
The system SHALL make the admin console available only to administrators at `/admin` (non-administrators are redirected per app-shell). If a non-administrator nevertheless reaches the console, it SHALL show "Access Denied" with "You do not have administrator privileges to view this page." and load no data.

#### Scenario: Administrator opens the console
- **GIVEN** a signed-in administrator
- **WHEN** they open `/admin`
- **THEN** the console titled "Administration Panel" with subtitle "Manage users and system data" is displayed

#### Scenario: Non-administrator reaches the console
- **GIVEN** a signed-in user whose role is user is shown the console view
- **WHEN** the view is displayed
- **THEN** "Access Denied" and "You do not have administrator privileges to view this page." are shown
- **AND** no user or system data is requested

### Requirement: Console Loading and Load Failure
The system SHALL show "Loading admin panel..." while console data loads, and if the data cannot be loaded SHALL show "Failed to load admin data. Make sure you have admin privileges." Console data is reloaded after every successful administrative action.

#### Scenario: Load failure
- **GIVEN** the server refuses to return the user list
- **WHEN** an administrator opens the console
- **THEN** the message "Failed to load admin data. Make sure you have admin privileges." is shown

### Requirement: Console Feedback Messages
The system SHALL report the outcome of each console action in a message area at the top of the console: success messages (green) disappear after 3 seconds; error messages (red) disappear after 3 seconds for refused self-actions and role-change errors, and after 5 seconds for other errors.

#### Scenario: Success message auto-hides
- **GIVEN** an administrator has just changed a user's role
- **WHEN** 3 seconds have elapsed
- **THEN** the success message is no longer shown

### Requirement: System Statistics
The system SHALL show four system-wide counts covering all users: Total Users (number of user profiles), Guitar Builds, References (reference documents), and Conversations (chat conversations).

#### Scenario: Counts across all users
- **GIVEN** 3 users who together own 5 builds, 2 reference documents and 4 conversations
- **WHEN** an administrator opens the console
- **THEN** the statistics show Total Users 3, Guitar Builds 5, References 2 and Conversations 4

### Requirement: User List
The system SHALL list every user, newest account first, showing: email address, a "(You)" marker on the administrator's own row, a role badge (admin rows marked with a distinct icon), the account creation date, and the actions change-role and delete. With no users, it shows "No users found".

#### Scenario: Administrator views the user list
- **GIVEN** users created on 2025-01-10 (admin, the viewer) and 2025-03-02 (user)
- **WHEN** the administrator views the User Management section
- **THEN** the 2025-03-02 user appears first with role badge "user"
- **AND** the administrator's own row shows "(You)" and the admin marker

### Requirement: Change User Role
The system SHALL let an administrator switch another user's role between user and admin with one click (no confirmation), then show "User role updated to {role}" and refresh the list. On failure it SHALL show the server's reason, or "Failed to update user role" if none is given.

#### Scenario: Promote a user
- **GIVEN** an administrator viewing a user whose role is user
- **WHEN** the administrator clicks that user's change-role action
- **THEN** the user's role becomes admin
- **AND** the message "User role updated to admin" is shown and the list shows the new role

#### Scenario: Demote an administrator
- **GIVEN** an administrator viewing another user whose role is admin
- **WHEN** the administrator clicks that user's change-role action
- **THEN** that user's role becomes user

### Requirement: Self-Action Protection
The system SHALL disable the change-role and delete actions on the administrator's own row, with tooltips "Cannot change your own role" and "Cannot delete your own account"; if such an action is attempted anyway, it SHALL show "You cannot change your own role" or "You cannot delete your own account" and change nothing.

#### Scenario: Own row actions disabled
- **WHEN** an administrator views their own row in the user list
- **THEN** both the change-role and delete actions are disabled

### Requirement: Delete User
The system SHALL ask for confirmation in a danger confirmation dialog titled "Delete" with the message "Are you sure you want to delete user {email}? This will permanently delete all their data." and confirm label "Delete", and only on confirmation delete the user, show "User deleted successfully" and refresh the list and statistics.

#### Scenario: Confirm deletion
- **GIVEN** an administrator clicks delete on the row of "old@example.com"
- **WHEN** the administrator confirms the dialog
- **THEN** the account "old@example.com" and all its data are deleted
- **AND** "User deleted successfully" is shown and the user no longer appears in the list

#### Scenario: Cancel deletion
- **GIVEN** the deletion confirmation dialog is open
- **WHEN** the administrator cancels it
- **THEN** nothing is deleted

#### Scenario: Deletion fails
- **GIVEN** the server rejects the deletion
- **WHEN** the administrator confirms the dialog
- **THEN** the server's reason, or "Failed to delete user" if none is given, is shown

### Requirement: User Deletion Cascade
The system SHALL, when a user is deleted, permanently remove their account and profile, their builds with everything attached to them (tap-tone analyses, scheduled and posted social-media steps), their wood panels, their chat conversations and messages, their connected social-media accounts, and the reference documents they own together with those documents' search index.

#### Scenario: Data of a deleted user is gone
- **GIVEN** a user who owns 2 builds with analyses, 3 wood panels, 1 conversation and 1 reference document
- **WHEN** an administrator deletes that user
- **THEN** none of those records exist afterwards
- **AND** the deleted reference document no longer appears in the shared reference library for anyone

### Requirement: Deletion Summary
The server SHALL return, for each user deletion, a summary of the deleted user's identifier and how many wood panels, builds, conversations and reference documents were removed, counted immediately before deletion.

#### Scenario: Summary returned
- **GIVEN** a user owning 3 wood panels, 2 builds, 1 conversation and 0 reference documents
- **WHEN** an administrator deletes that user
- **THEN** the deletion result reports wood panels 3, builds 2, conversations 1 and reference documents 0

### Requirement: Server-Side Administrator Check
The server SHALL perform the list-all-users, change-role and delete-user operations only after verifying that the caller's own profile has role admin, independently of any client-side hiding; this check SHALL work even though ordinary users cannot read other profiles.

#### Scenario: Direct call by a regular user
- **GIVEN** a signed-in user whose role is user
- **WHEN** they call the list-all-users operation directly, bypassing the interface
- **THEN** the server refuses with "Access denied. Admin privileges required."

### Requirement: List All Users Operation
The server SHALL provide an administrator-only operation returning every user profile (identifier, email, role, creation time, last-updated time) ordered newest first, and SHALL refuse non-administrators with "Access denied. Admin privileges required."

#### Scenario: Administrator lists users
- **WHEN** an administrator calls the list-all-users operation
- **THEN** all profiles are returned, newest first

### Requirement: Change Role Operation
The server SHALL provide a change-role operation taking a target user and a new role that rejects a role other than user or admin ('Invalid role. Must be "user" or "admin".'), rejects non-administrators ("Access denied. Admin privileges required."), rejects changing one's own role ("Cannot change your own role."), and otherwise sets the role and the profile's last-updated time.

#### Scenario: Invalid role value
- **WHEN** an administrator calls the change-role operation with the role "superuser"
- **THEN** the server refuses with 'Invalid role. Must be "user" or "admin".'

#### Scenario: Own role
- **WHEN** an administrator calls the change-role operation on their own account
- **THEN** the server refuses with "Cannot change your own role."

### Requirement: Delete User Operation
The server SHALL provide a delete-user operation that rejects non-administrators ("Only administrators can delete users") and attempts to delete one's own account ("You cannot delete your own account"), and otherwise deletes the target account with the cascade and summary defined in this capability.

#### Scenario: Regular user attempts deletion
- **GIVEN** a signed-in user whose role is user
- **WHEN** they call the delete-user operation directly
- **THEN** the server refuses with "Only administrators can delete users" and nothing is deleted

#### Scenario: Administrator deletes themselves
- **WHEN** an administrator calls the delete-user operation on their own account
- **THEN** the server refuses with "You cannot delete your own account"

### Requirement: Wood Analysis Prompt Template
The system SHALL show in a "System Configuration" section an editable multi-line "Wood Analysis Prompt Template" with the help text "Use {properties} as a placeholder for the wood properties data.", prefilled with the stored template or, if none is stored, with the default template.
The default template is "Do you think that a top with those properties is a good choice:" followed by a blank line and "{properties}".

#### Scenario: No stored template
- **GIVEN** no prompt template has been saved
- **WHEN** an administrator opens the console
- **THEN** the template field contains the default template ending with "{properties}"

### Requirement: Save Prompt Template
The system SHALL save the edited template when the administrator clicks "Save Prompt Template" (label "Saving..." and disabled while saving), creating or replacing the stored value, then show "Prompt template saved successfully"; on failure it SHALL show the server's reason or "Failed to save prompt template".

#### Scenario: Save a new template
- **GIVEN** an administrator edits the template to "Rate this soundboard:\n\n{properties}"
- **WHEN** they click "Save Prompt Template"
- **THEN** "Prompt template saved successfully" is shown
- **AND** reopening the console shows the edited template

### Requirement: Prompt Template Applies To All Users
The system SHALL use the saved prompt template for the AI wood-properties analysis of every signed-in user (not only administrators), replacing the "{properties}" placeholder with the formatted panel data (see wood-panel-properties), and SHALL fall back to the default template when none is saved.

#### Scenario: Regular user analysis uses the saved template
- **GIVEN** an administrator saved the template "Rate this soundboard:\n\n{properties}"
- **WHEN** a regular user requests an AI analysis of a wood panel
- **THEN** the question sent for analysis begins with "Rate this soundboard:" followed by that panel's data

### Requirement: Global Settings Data
The system SHALL store global settings as entries with a unique text key, a text value, an optional description and a last-updated time; the prompt template is stored under a fixed key with a description explaining the "{properties}" placeholder. Only administrators may create or change settings.

#### Scenario: Regular user cannot change settings
- **GIVEN** a signed-in user whose role is user
- **WHEN** they try to change the stored prompt template directly
- **THEN** the change is rejected and the template is unchanged

### Requirement: Default Wood Panels Overview
The system SHALL show a "Default Wood Panels" section explaining that these panels are the template set users can load into their own panel list, with the current count and, sorted by name, one card per default panel showing its name, target thickness (mm, 2 decimals), estimated mass (g, 1 decimal, when known) and longitudinal Young's modulus E_L (GPa, 2 decimals).

#### Scenario: Panels listed
- **GIVEN** default panels "Spruce A" and "Cedar B" exist
- **WHEN** an administrator opens the console
- **THEN** "Cedar B" is shown before "Spruce A", each with its target thickness, estimated mass and E_L

#### Scenario: No default panels
- **GIVEN** no default panels exist
- **WHEN** an administrator opens the console
- **THEN** "No default wood panels configured" is shown with a hint to use the sync action

### Requirement: Sync Default Wood Panels
The system SHALL let an administrator replace the whole default panel set with copies of all wood panels owned by an operator-designated source account, after confirming "This will replace all default wood panels with those from <source>'s account. Continue?". The replacement is all-or-nothing; on success it shows "Successfully synced {count} default wood panels".

#### Scenario: Successful sync
- **GIVEN** the source account owns 4 wood panels and 2 default panels exist
- **WHEN** an administrator clicks the sync action and confirms
- **THEN** the default set consists of exactly 4 panels copied from the source account
- **AND** "Successfully synced 4 default wood panels" is shown

#### Scenario: Sync cancelled
- **WHEN** the administrator declines the sync confirmation
- **THEN** the default set is unchanged

### Requirement: Sync Copies Panel Attributes
The system SHALL copy for each source panel its name, sample length, width, thickness and mass, the longitudinal, cross-grain and diagonal frequencies, target plate length and width, vibrational stiffness parameter, computed E_L, E_C and G_LC, target thickness and estimated panel mass; the copies are not linked to any build or user.

#### Scenario: Copied values match
- **GIVEN** a source panel named "Spruce A" with target thickness 2.85 mm
- **WHEN** the sync completes
- **THEN** a default panel named "Spruce A" with target thickness 2.85 mm exists

### Requirement: Sync Failure Handling
The system SHALL show "Syncing..." and disable the sync action while it runs, and SHALL leave the existing default set unchanged and show an error when the source account cannot be found ("Could not find <source> user"), owns no wood panels ("No wood panels found for <source>"), or copying fails ("Failed to sync default wood panels" if no reason is given).

#### Scenario: Source account has no panels
- **GIVEN** the source account owns no wood panels
- **WHEN** an administrator confirms the sync
- **THEN** the message "No wood panels found for <source>" is shown
- **AND** the existing default panels are unchanged

### Requirement: Delete Default Wood Panel
The system SHALL let an administrator delete a single default panel from its card after a danger confirmation dialog ("Are you sure you want to delete the default wood panel "{name}"?"), then show "Default wood panel deleted successfully"; on failure it SHALL show the reason or "Failed to delete default wood panel". Copies users already loaded are unaffected.

#### Scenario: Delete one default panel
- **GIVEN** default panels "Spruce A" and "Cedar B" exist
- **WHEN** the administrator deletes "Cedar B" and confirms
- **THEN** only "Spruce A" remains in the default set
- **AND** users who previously loaded "Cedar B" into their own list still have it

### Requirement: Default Wood Panel Access Rules
The server SHALL let every signed-in user read the default wood panels and SHALL allow only administrators to create, change or delete them.

#### Scenario: Regular user tries to delete a default panel
- **GIVEN** a signed-in user whose role is user
- **WHEN** they try to delete a default panel directly
- **THEN** the deletion is rejected and the panel remains

### Requirement: Administrator Notes
The system SHALL show an informational "Administrator Notes" box stating that administrators can view all users' data but cannot change it, cannot modify their own role or delete their own account, that deleting a user permanently removes all their data, that the first user to sign up becomes an administrator, and that default wood panels are offered to users to load.

#### Scenario: Notes visible
- **WHEN** an administrator scrolls to the bottom of the console
- **THEN** the "Administrator Notes" box with these five statements is shown
