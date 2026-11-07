# build-story-sharing Specification

## Purpose
A builder can publish a read-only "build story" of a guitar build through a secret, unguessable link. Clients and followers can then watch the progress without an account. The story shows the documented, completed steps of the build sequence with their notes, photos and tap-tone measurements. Viewers can opt in to browser notifications when new progress is posted.

## Requirements

### Requirement: Share Dialog
The system SHALL open a "Share Build Story" dialog from the "Share" action on a build's detail page. The dialog shows the build name and a "Public Access" switch, with a status line that reads "Anyone with the link can view" when sharing is on and "Only you can see this build" when it is off. "Done" and a close (X) control dismiss the dialog. Opening the dialog never turns sharing on by itself.

#### Scenario: Dialog for an unshared build
- **WHEN** the owner opens the share dialog of a build that is not shared
- **THEN** the switch is off with "Only you can see this build"
- **AND** the dialog shows "Sharing is disabled" and "Enable public access to generate a shareable link"

#### Scenario: Opening does not share
- **WHEN** the owner opens and closes the share dialog without using the switch
- **THEN** the build remains unshared

### Requirement: Enable Sharing
The system SHALL create a new share token when the owner turns public access on, mark the build as shared and update the build's last-update time. The dialog then shows the share link `<application origin>/story/<token>`. While the request runs, the switch is disabled. If the request fails, the user is told "Failed to enable sharing" and sharing stays off.

#### Scenario: Turn sharing on
- **WHEN** the owner turns on "Public Access"
- **THEN** the dialog shows a "Share Link" field containing `<origin>/story/<new token>`
- **AND** opening that link without signing in shows the build's story

#### Scenario: Enabling fails
- **WHEN** the server rejects the enable request
- **THEN** "Failed to enable sharing" is shown and the switch stays off

### Requirement: Share Link Actions
The system SHALL offer the following while sharing is on:
- a read-only "Share Link" field;
- a "Copy" button that puts the full link on the clipboard and reads "Copied!" for 2 seconds;
- a "Preview Build Story" button that opens the story in a new browser tab;
- the tip "Share this link with your clients so they can follow along with your build progress. They'll see all completed steps, notes, and photos."

#### Scenario: Copy link
- **WHEN** the owner presses "Copy"
- **THEN** the clipboard contains the full story link
- **AND** the button shows "Copied!" and returns to "Copy" after 2 seconds

#### Scenario: Preview
- **WHEN** the owner presses "Preview Build Story"
- **THEN** the public story opens in a new tab

### Requirement: Disable Sharing
The system SHALL remove the share token and mark the build as not shared when the owner turns public access off. The previous link stops working immediately. If the request fails, the user is told "Failed to disable sharing" and sharing stays on.

#### Scenario: Turn sharing off
- **GIVEN** a shared build whose link is open in a viewer's browser
- **WHEN** the owner turns off "Public Access" and the viewer reloads the link
- **THEN** the viewer sees the "Story Not Found" page

#### Scenario: Disabling fails
- **WHEN** the server rejects the disable request
- **THEN** "Failed to disable sharing" is shown and the link keeps working

### Requirement: Share Link Regeneration
The system SHALL issue a different token every time sharing is turned on after having been off, and a previously issued token SHALL never become valid again. Turning sharing on while it is already on keeps the current token. Regenerating a link is therefore done by turning sharing off and on again.

#### Scenario: Regenerate the link
- **GIVEN** a shared build with link L1
- **WHEN** the owner turns sharing off and then on again, obtaining link L2
- **THEN** L2 differs from L1
- **AND** L1 shows the "Story Not Found" page while L2 shows the story

### Requirement: Share Token Properties
The system SHALL use a randomly generated UUID with 122 random bits as the share token, so that links cannot be guessed. A build has at most one valid token at a time.

#### Scenario: Unguessable token
- **WHEN** two builds are shared
- **THEN** their tokens are different random UUIDs that are unrelated to the build identifiers

### Requirement: Sharing Restricted to Owner
The system SHALL allow only a build's owner to turn sharing on or off. Administrators and other users SHALL be refused.

#### Scenario: Non-owner request refused
- **WHEN** a user who does not own the build sends a request to turn its sharing on
- **THEN** the request fails with an authorization error and the build's sharing state is unchanged

### Requirement: Share State Consistency
The system SHALL keep the share state shown on the detail page and in the share dialog in line with the stored state, including after the user leaves the build and comes back.

#### Scenario: Navigate away and back
- **GIVEN** the owner turned sharing on for build X and returned to the Builds list
- **WHEN** the owner opens build X again and opens the share dialog
- **THEN** the switch is on and the same link as before is shown

### Requirement: Public Story Route
The system SHALL serve a build's story at `/story/<token>` without requiring sign-in, whether or not the visitor is signed in. The story page has no application navigation. While the story loads, it shows "Loading build story...".

#### Scenario: Anonymous visitor
- **WHEN** a visitor who is not signed in opens a valid story link
- **THEN** the story is shown without a sign-in prompt and without the application's navigation

#### Scenario: Signed-in visitor
- **WHEN** a signed-in user opens a valid story link
- **THEN** the same public story page is shown

### Requirement: Story Not Found
The system SHALL show a "Story Not Found" page with "Build not found or sharing has been disabled." and "The build story you're looking for might have been removed or the link may be incorrect." when the token is malformed or unknown, or when sharing of the build is disabled. Other loading errors show the same page with "Unable to load this build story.".

#### Scenario: Unknown token
- **WHEN** a visitor opens `/story/<random UUID that matches no build>`
- **THEN** the "Story Not Found" page says "Build not found or sharing has been disabled."

#### Scenario: Malformed token
- **WHEN** a visitor opens `/story/abc`
- **THEN** the "Story Not Found" page is shown

### Requirement: Story Header
The system SHALL show at the top of the story:
- the label "Build Story";
- the build name as the title;
- "Started <Month D, YYYY>", using the build's creation date;
- the notification switch (see Story Notification Switch).

#### Scenario: Header content
- **GIVEN** a shared build "OM #3" created on 6 December 2025
- **WHEN** a visitor opens its story
- **THEN** the header shows "Build Story", "OM #3" and "Started December 6, 2025"

### Requirement: Story Progress
The system SHALL show a "Build Progress" bar with "<C> of <T> steps" and "<P>% Complete". The values are defined as follows:
- T is the number of template steps that apply to the build's construction variant (`build-sequence`);
- C is the number of completed steps among those, whether or not they are documented;
- P = round(100 × C / T).

#### Scenario: Progress values
- **GIVEN** a shared steel-string build with a BOBO neck (120 applicable steps) and 30 completed applicable steps
- **WHEN** its story is opened
- **THEN** it shows "30 of 120 steps" and "25% Complete" with the bar filled to 25%

#### Scenario: Completed step hidden by the variant
- **GIVEN** a classical build with 12 completed applicable steps and one completed steel-string-only step left over from before a variant change
- **WHEN** its story is opened
- **THEN** it shows "12 of 120 steps"

#### Scenario: Nothing completed
- **GIVEN** a classical build without a BOBO neck (112 applicable steps)
- **WHEN** its story is opened with no completed step
- **THEN** it shows "0 of 112 steps" and "0% Complete"

### Requirement: Story Timeline Filtering
The system SHALL show in the story timeline only the steps that apply to the build's variant and are completed and documented. A step is documented when it has non-blank notes, at least one photo, or at least one measurement. The steps are listed in canonical template order and are numbered "Step 1" to "Step n" by their position in the timeline.

#### Scenario: Undocumented completed step is hidden
- **GIVEN** "Bend sides" is completed with no notes, photos or measurements, and "Join panels" is completed with a photo
- **WHEN** the story is opened
- **THEN** "Join panels" appears in the timeline and "Bend sides" does not

#### Scenario: Incomplete step with content is hidden
- **GIVEN** "Carve neck" has notes and photos but is not completed
- **WHEN** the story is opened
- **THEN** "Carve neck" does not appear

#### Scenario: Whitespace-only notes
- **GIVEN** a completed step whose only content is notes made of spaces
- **WHEN** the story is opened
- **THEN** the step does not appear

### Requirement: Story Step Card
The system SHALL show each timeline step as a card with the following content:
- a completed check icon, the step label and its "Step N" number;
- the notes under "Notes", with line breaks preserved, when they are not blank;
- the photos as thumbnails under "<n> Photo" or "<n> Photos";
- the measurements under "Sound Analysis (<n>)". Each shows its description, "Peak: <f> Hz" with one decimal, its date and its spectrum graph, drawn as defined in `build-sequence`.

#### Scenario: Card with all content
- **GIVEN** a completed step with notes, 2 photos and 1 measurement at 187.4 Hz
- **WHEN** the story is opened
- **THEN** its card shows the notes, "2 Photos" with 2 thumbnails, and "Sound Analysis (1)" with "Peak: 187.4 Hz" and a graph

### Requirement: Story Empty States
The system SHALL replace the timeline with an empty state when no step is documented and completed:
- "Build Just Started" with "No steps have been completed yet. Check back soon to see the progress!" when no step is completed;
- "No Details Shared Yet" with "Work is in progress, but no specific steps have been documented with photos or notes yet." when some steps are completed but none is documented.

#### Scenario: Fresh shared build
- **WHEN** the story of a build with no completed step is opened
- **THEN** "Build Just Started" is shown

#### Scenario: Completed but undocumented
- **GIVEN** a build with completed steps that have no notes, photos or measurements
- **WHEN** its story is opened
- **THEN** "No Details Shared Yet" is shown

### Requirement: Story Photo Lightbox
The system SHALL open a full-size view of the selected photo when a story thumbnail is clicked. If the step has more than one photo, previous and next controls cycle through that step's photos with wrap-around, and a counter "<i> / <n>" is shown. The close (X) control or a click outside the photo closes the view.

#### Scenario: Wrap-around navigation
- **GIVEN** a step with 3 photos
- **WHEN** the visitor opens the third photo and presses next
- **THEN** the first photo is shown with the counter "1 / 3"

#### Scenario: Single photo
- **WHEN** the visitor opens the only photo of a step
- **THEN** no previous or next controls and no counter are shown

### Requirement: Story Hidden Information
The system SHALL show nothing on the story beyond the header, the progress and the timeline. The story SHALL NOT show any of the following:
- editing controls;
- steps that are incomplete or undocumented;
- the owner's identity;
- steps hidden by the build's construction variant;
- the build's saved acoustic results;
- wood data;
- the diagram itself.

#### Scenario: No owner information
- **WHEN** a visitor views a story
- **THEN** no owner name, email or account information appears
- **AND** no control to change the build is offered

### Requirement: Story Update Prompt
The system SHALL ask "Get Build Updates?" about 2 seconds after a story opens, with the message "Would you like to be notified when new photos or notes are added to this build?". It asks only when the browser supports notifications, the visitor has not yet decided on browser notifications, and no preference is remembered for this link in this browser. "Yes, notify me" requests browser permission. "No thanks" remembers the preference as off.

#### Scenario: Accept updates
- **WHEN** a first-time visitor answers "Yes, notify me" and grants browser permission
- **THEN** updates are turned on and remembered for this story link in this browser

#### Scenario: Decline updates
- **WHEN** the visitor answers "No thanks"
- **THEN** updates stay off and the prompt is not shown again for this link in this browser

#### Scenario: Browser permission denied
- **WHEN** the visitor answers "Yes, notify me" but denies the browser permission
- **THEN** updates stay off and that preference is remembered

### Requirement: Story Notification Switch
The system SHALL show a header switch reading "Get Updates" when updates are off and "Updates On" when they are on. Turning updates on requests browser permission. If the browser does not support notifications, the visitor is told "This browser does not support notifications.". Turning updates off is remembered for this link in this browser. A remembered "on" is restored on later visits if permission is still granted.

#### Scenario: Turn updates off
- **GIVEN** updates are on
- **WHEN** the visitor presses "Updates On"
- **THEN** the switch reads "Get Updates" and stays off on the next visit

#### Scenario: Unsupported browser
- **WHEN** the visitor presses "Get Updates" in a browser without notification support
- **THEN** the message "This browser does not support notifications." is shown

### Requirement: Live Story Updates
The system SHALL refresh the story in place from the server whenever the build changes, while updates are on and the story page is open. No reload is needed.

#### Scenario: Owner documents a step
- **GIVEN** a visitor has the story open with updates on
- **WHEN** the owner completes a step and adds a photo to it
- **THEN** the visitor's story shows the new step and the updated progress without reloading

### Requirement: Story Update Notifications
The system SHALL show a browser notification titled "Update: <build name>" with the body "New progress has been posted! Click to see." when a refresh increases the number of documented, completed steps. A newer notification for the same build replaces an older one. Clicking the notification focuses the story and scrolls to the last step card. Notifications appear only while the story page is open.

#### Scenario: New documented step
- **GIVEN** updates are on and the timeline has 4 steps
- **WHEN** a refresh brings the timeline to 5 steps
- **THEN** a notification "Update: <build name>" is shown

#### Scenario: Edit without new step
- **GIVEN** updates are on and the timeline has 5 steps
- **WHEN** the owner edits the notes of an existing timeline step
- **THEN** the story refreshes but no notification is shown

#### Scenario: Page closed
- **WHEN** the visitor has closed the story page and the owner documents a new step
- **THEN** no notification is delivered

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

### Requirement: No Enumeration of Shared Builds
The system SHALL NOT let anonymous visitors or other signed-in users list shared builds, read their tokens or other attributes, or list the stored step photo files. Shared data is reachable only through a known token or a known photo URL.

#### Scenario: Listing attempt
- **WHEN** an anonymous client asks the server for all builds, or for a list of stored step photos
- **THEN** no builds, tokens or file names are returned

#### Scenario: Shared build not in another user's list
- **GIVEN** user B's build is shared
- **WHEN** user A opens the Builds page
- **THEN** user B's build is not listed

### Requirement: Sharing Localization
The system SHALL present the share dialog and the public story, including prompts, notifications and dates, in English and French. The share dialog follows the user's selected language. The story page follows the language preference already stored in the visitor's browser and falls back to English.

#### Scenario: French owner shares
- **GIVEN** the owner selected French
- **WHEN** the owner opens the share dialog
- **THEN** all of its labels and messages are in French

#### Scenario: Visitor without a preference
- **WHEN** a visitor with no stored language preference opens a story
- **THEN** the story is shown in English
