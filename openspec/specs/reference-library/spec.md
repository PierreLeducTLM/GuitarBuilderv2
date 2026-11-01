# reference-library Specification

## Purpose
The reference library is the admin-curated, shared knowledge base of luthiery reference documents written in Markdown with LaTeX math and figures. Administrators list, view, create, import, edit and delete documents; every saved document is split into passages and indexed for semantic search so that the `knowledge-assistant` (and features reusing it) can ground answers in it for all signed-in users.

## Requirements

### Requirement: Admin-Only Reference Library Screens
The system SHALL make the reference library screens (list, viewer, editor) reachable only by signed-in users with the admin role.
- The navigation entry for the library is shown only to admins and is visually distinguished as an admin section (see `app-shell`).
- Any reference library URL opened by a non-admin user SHALL redirect to the default page (the builds list) without showing document content.

#### Scenario: Admin opens the library
- **GIVEN** a signed-in user with the admin role
- **WHEN** the user opens `/references`
- **THEN** the reference list is shown

#### Scenario: Non-admin opens a deep link
- **GIVEN** a signed-in user without the admin role
- **WHEN** the user opens `/references?docId=<id>`
- **THEN** the user is redirected to the builds list
- **AND** no reference document content is displayed

### Requirement: Reference Management Restricted to Admins
The system SHALL enforce on the server that only admins can create, modify or delete reference documents and their search index. Any admin SHALL be able to edit, re-index or delete any document, regardless of which admin created it.

#### Scenario: Non-admin bypasses the UI
- **GIVEN** a signed-in user without the admin role
- **WHEN** the user sends a request to create, edit or delete a reference document directly to the server
- **THEN** the server rejects the request and nothing changes

#### Scenario: Admin edits a document created by another admin
- **GIVEN** a document created by admin A
- **WHEN** admin B saves changes to it with indexing enabled
- **THEN** the document and its passages are updated

### Requirement: Shared Read Access to References
The system SHALL let every signed-in user read all reference documents and all indexed passages, because the assistant retrieves passages on behalf of any user; the library is one shared collection and is not partitioned per user. Signed-out callers SHALL have no access to documents or passages.

#### Scenario: Non-admin benefits from the library
- **WHEN** a non-admin user asks the assistant a question
- **THEN** passages from admin-created documents can be retrieved for that user

#### Scenario: Signed-out access
- **WHEN** a caller without a valid session requests reference documents
- **THEN** no documents are returned

### Requirement: Reference Document Data
The system SHALL persist, for each reference document: a unique identifier, a title (required text, stored trimmed, non-empty), the content (Markdown text, may be empty, defaults to empty), the creating user, a creation timestamp and a last-updated timestamp.

#### Scenario: Document stored with timestamps
- **WHEN** an admin saves a new document titled "  Bracing notes "
- **THEN** a document titled "Bracing notes" is stored with the creator, a creation time and a last-updated time

### Requirement: Reference List
The system SHALL list all reference documents sorted by last-updated time, most recent first, showing for each its title and "Last updated:" followed by the date and time in the user's locale, with View, Edit and Delete actions.

#### Scenario: Most recently updated first
- **GIVEN** document A updated yesterday and document B updated today
- **WHEN** an admin opens the list
- **THEN** B is listed above A
- **AND** each row offers View, Edit and Delete

### Requirement: Reference List States
The system SHALL show distinct list states:
- while loading: "Loading reference documents...";
- no documents: "No reference documents yet." plus a hint to click "Add Reference" or drag and drop .txt or .md files;
- load failure: "Failed to load reference documents";
- documents present: a hint that .txt or .md files can be dragged anywhere in the section to add them.

#### Scenario: Empty library
- **GIVEN** no reference documents exist
- **WHEN** an admin opens the list
- **THEN** the empty-state message and the add/drag hint are shown

#### Scenario: Load failure
- **WHEN** the documents cannot be loaded
- **THEN** "Failed to load reference documents" is shown

### Requirement: Create Reference Document
The system SHALL let an admin create a document via an "Add Reference" action that opens an empty editor titled "New Reference" at the URL `/references?mode=edit`.

#### Scenario: Start a new document
- **WHEN** an admin clicks "Add Reference"
- **THEN** an editor with empty title and content opens
- **AND** the URL becomes `/references?mode=edit`

### Requirement: Reference Editor Fields
The system SHALL provide an editor (titled "New Reference" or "Edit Reference") with a Title field, a Markdown Content field shown in a monospace font, an Edit/Preview toggle, a "Generate embeddings" option enabled by default, and Save, Cancel and Close actions. When editing an existing document the fields are pre-filled with its title and content.

#### Scenario: Editing an existing document
- **WHEN** an admin clicks Edit on a document
- **THEN** the editor titled "Edit Reference" opens with the document's title and content
- **AND** "Generate embeddings" is checked

### Requirement: Editor Preview
The system SHALL let the admin switch the content field to a Preview that renders the current, unsaved content exactly as the viewer would, and back to Edit; with no content, Preview shows "No content to preview".

#### Scenario: Preview
- **WHEN** an admin types Markdown with a formula and switches to Preview
- **THEN** the content is shown rendered, with the formula typeset, instead of as raw text

### Requirement: Reference Title Validation
The system SHALL require a title: saving with an empty or whitespace-only title SHALL show "Title is required" and store nothing. The title is trimmed when saved; the content is saved verbatim and may be empty.

#### Scenario: Missing title
- **WHEN** an admin clicks Save with a blank title
- **THEN** "Title is required" is shown and nothing is saved

### Requirement: Saving a Reference Document
The system SHALL, on Save, create the document (new) or update its title and content and set its last-updated time to now (existing), then index it (see Indexing Triggers). While saving, Save and Cancel are disabled and Save shows "Saving..." then "Generating embeddings...". After full success the refreshed list is shown at `/references`. If the document cannot be stored, the editor stays open with "Failed to save document".

#### Scenario: Successful edit
- **GIVEN** an admin editing an existing document with "Generate embeddings" enabled
- **WHEN** the admin changes the content and clicks Save
- **THEN** the document is updated and re-indexed
- **AND** the list is shown with that document at the top

#### Scenario: Storage failure
- **WHEN** the document cannot be stored
- **THEN** the editor stays open showing "Failed to save document"

### Requirement: Cancel Editing
The system SHALL return to the list at `/references` without saving when the admin clicks Cancel or Close in the editor.

#### Scenario: Discard changes
- **WHEN** an admin edits the title and clicks Cancel
- **THEN** the list is shown and the stored title is unchanged

### Requirement: Indexing Failure After Save
The system SHALL keep a document that was stored successfully even if its indexing fails: the editor stays open showing "Document saved, but embeddings failed:" followed by the reason, and a subsequent Save from that editor SHALL update the same document rather than create a second one.

#### Scenario: Indexing fails for a new document
- **GIVEN** an admin creating a new document
- **WHEN** the document is stored but indexing fails
- **THEN** the editor shows "Document saved, but embeddings failed:" with the reason
- **AND** clicking Save again updates that same document instead of creating a duplicate

### Requirement: Image Copy Failure Warning
The system SHALL warn the admin with "Document saved successfully, but images failed to upload." when a save succeeded but one or more embedded images could not be copied into the application's image storage, and the warning SHALL remain visible after the editor closes.

#### Scenario: Some images could not be copied
- **WHEN** a save succeeds but one embedded image could not be downloaded
- **THEN** the admin sees "Document saved successfully, but images failed to upload." on the screen shown after saving

### Requirement: Import Documents by Drag and Drop
The system SHALL let an admin drop one or more `.txt` or `.md` files anywhere on the reference list to create one new document per file, titled with the file name minus its `.txt`/`.md` extension and containing the file's text, each indexed automatically. While dragging, a drop zone reads "Drop .txt or .md files here"; while importing, "Uploading files..." is shown; afterwards the list is refreshed.

#### Scenario: Import two Markdown files
- **WHEN** an admin drops `Bracing.md` and `Finishing.md` on the list
- **THEN** documents titled "Bracing" and "Finishing" are created with the files' text and indexed
- **AND** the list shows both

### Requirement: Import File Filtering
The system SHALL import only files ending in `.txt` or `.md`. If no dropped file qualifies, "Please drop only .txt or .md files" is shown and nothing is created; if only some qualify, the others are ignored and "Some files were ignored. Only .txt and .md files are supported." is shown.

#### Scenario: Mixed file types
- **WHEN** an admin drops `notes.md` and `photo.jpg`
- **THEN** only "notes" is created
- **AND** the message about ignored files is shown

#### Scenario: No accepted files
- **WHEN** an admin drops only `photo.jpg`
- **THEN** "Please drop only .txt or .md files" is shown and nothing is created

### Requirement: Import Error Reporting
The system SHALL continue importing the remaining files when one fails: a file that cannot be stored is reported as "Failed to upload <file name>: <reason>", and a stored file that cannot be indexed is reported as "Document uploaded but embeddings failed for <file name>", noting that the assistant may not find it.

#### Scenario: One file fails
- **WHEN** an admin drops three files and the second cannot be stored
- **THEN** the first and third are created
- **AND** the failure message names the second file

### Requirement: Delete Reference Document
The system SHALL let an admin delete a document after confirming "Are you sure you want to delete this reference document?"; on confirmation the document, all its indexed passages and its copied images are removed and the list refreshes. Declining changes nothing; a failure shows "Failed to delete document".

#### Scenario: Confirmed delete
- **WHEN** an admin deletes a document and confirms
- **THEN** the document disappears from the list
- **AND** its passages can no longer be retrieved by the assistant

#### Scenario: Cancelled delete
- **WHEN** an admin clicks Delete and then cancels the confirmation
- **THEN** the document remains

### Requirement: Reference Viewer
The system SHALL show a document in read mode with its title, "Last updated:" date and time, and its rendered content, or "No content yet." when the content is empty, together with Edit and Close actions. Edit opens the editor for the same document; Close returns to the list.

#### Scenario: View then edit
- **WHEN** an admin clicks View on a document and then Edit
- **THEN** the viewer shows the rendered document, then the editor opens pre-filled with its title and content

### Requirement: Reference Deep Link URLs
The system SHALL keep the reference library state in the URL:
- `/references` - the list;
- `/references?docId=<id>` - the viewer for that document;
- `/references?docId=<id>&mode=edit` - the editor for that document;
- `/references?mode=edit` - the editor for a new document.
Viewing, editing, adding, saving and closing SHALL update the URL accordingly.

#### Scenario: Viewing updates the URL
- **WHEN** an admin clicks View on document 42
- **THEN** the URL becomes `/references?docId=42`

### Requirement: Deep Link Restoration
The system SHALL show the screen corresponding to a reference URL when it is opened directly (bookmark, shared link, reload) or reached with browser back/forward; an unknown or inaccessible `docId` SHALL show the list.

#### Scenario: Reload in edit mode
- **GIVEN** an admin on `/references?docId=42&mode=edit`
- **WHEN** the admin reloads the page
- **THEN** the editor for document 42 is shown

#### Scenario: Back to the list
- **GIVEN** an admin who opened a document from the list
- **WHEN** the admin presses the browser Back button
- **THEN** the list is shown

#### Scenario: Unknown document
- **WHEN** an admin opens `/references?docId=<nonexistent>`
- **THEN** the list is shown

### Requirement: Math Notation in References
The system SHALL treat document content as Markdown with LaTeX math: inline math is delimited by single dollars (`$...$`, within one line); display math by double dollars, either on one line (`$$...$$`) or as a block whose opening and closing lines contain only `$$`. An escaped dollar (`\$`) is not a math delimiter.

#### Scenario: Display math block
- **WHEN** content contains a line `$$`, a formula line, and a closing line `$$`
- **THEN** the formula is treated as one display formula

### Requirement: Embedded Images in References
The system SHALL accept images embedded in content with Markdown image syntax `![alt text](URL)`, where the URL is an absolute `http`/`https` address; the editor has no separate image upload, and images enter the library only through such URLs (they are copied into application storage during indexing).

#### Scenario: Image by URL
- **WHEN** an admin saves content containing `![Fig. 4.4-2 Bridge layout](https://example.org/bridge.png)`
- **THEN** the content is stored unchanged and the image is copied during indexing

### Requirement: Figure and Equation Numbering
The system SHALL recognize the reference numbering convention: figures are numbered "X.Y-Z" (section X.Y, item Z) and referred to as "Fig. X.Y-Z" or "Figure X.Y-Z", optionally captioned by a following line such as "Fig. X.Y-Z: caption text"; equations are referred to as "Eq. X.Y-Z" or "Equ. X.Y-Z".

#### Scenario: Equation reference recognized
- **WHEN** a passage says "using Eq. 2.3-1"
- **THEN** the passage records the equation reference "2.3-1"

### Requirement: Text Formatting Rendering
The system SHALL render, in the viewer and editor preview, at least: headings of levels 1 to 3 (`#`, `##`, `###`); paragraphs where every non-empty line is shown as its own line and blank lines add spacing; bold (`**text**`), italic (`*text*`) and inline code; fenced code blocks shown verbatim in a monospace, horizontally scrollable block; and single-level bullet lists with `- ` or `* ` items.

#### Scenario: Headings and lists
- **WHEN** content contains `## Bracing` followed by `- X brace` and `- Tone bars`
- **THEN** a second-level heading and a two-item bullet list are shown

### Requirement: Math Rendering
The system SHALL typeset inline and display LaTeX math as formulas; a formula that cannot be typeset SHALL be shown visibly marked as an error without breaking the rest of the document.

#### Scenario: Math rendering
- **WHEN** content contains `$f = \frac{1}{2L}\sqrt{T/\mu}$`
- **THEN** the viewer shows a typeset fraction and square root inline with the text

#### Scenario: Invalid formula
- **WHEN** content contains `$\frac{1}{$`
- **THEN** the formula is shown marked as an error and the rest of the document still renders

### Requirement: Image Rendering
The system SHALL display embedded images in the viewer and preview, scaled to fit the content width, with the alt text as alternative text.

#### Scenario: Figure shown
- **WHEN** an admin views a document containing `![Bridge layout](https://example.org/bridge.png)`
- **THEN** the image is displayed in place, not the raw Markdown syntax

### Requirement: Safe Rendering of Stored Content
The system SHALL render document content without executing any HTML or script contained in it; HTML-like text SHALL be displayed literally or removed.

#### Scenario: Script in content
- **WHEN** a document contains `<img src=x onerror=alert(1)>`
- **THEN** no script runs when the document is viewed or previewed

### Requirement: Paragraph-Based Passage Splitting
The system SHALL split content into passages for indexing by paragraphs: content is split at runs of two or more line breaks, each paragraph is trimmed and empty ones skipped, and paragraphs are appended to the current passage (separated by a blank line) while current length + next paragraph length does not exceed 1000 characters. Passages are numbered from 0 in document order; empty content yields no passages.

#### Scenario: Short document
- **WHEN** a 600-character document with three paragraphs is indexed
- **THEN** exactly one passage containing all three paragraphs is produced

#### Scenario: Empty content
- **WHEN** a document with only whitespace is indexed
- **THEN** no passages are produced

### Requirement: Passage Overlap
The system SHALL close the current non-empty passage when adding the next paragraph would exceed 1000 characters, and start the next passage with the last 200 characters of the closed passage, a blank line, then that paragraph. A single paragraph longer than 1000 characters is never split and forms an oversized passage.

#### Scenario: Overlap between passages
- **WHEN** a document whose paragraphs total about 1800 characters is indexed
- **THEN** at least two passages are produced
- **AND** the second passage begins with the last 200 characters of the first

#### Scenario: Very long paragraph
- **WHEN** a document consists of one 2500-character paragraph
- **THEN** a single 2500-character passage is produced

### Requirement: LaTeX Preservation Across Passages
The system SHALL not cut a LaTeX formula when closing a passage: if a passage's end falls inside an inline (`$...$`) or display (`$$...$$`) formula that starts within the passage, the end SHALL be extended to the end of that formula. Each passage SHALL record whether it contains a formula and the distinct equation references ("Eq./Equ. X.Y-Z", stored as "X.Y-Z") it mentions.

#### Scenario: Formula at a boundary
- **WHEN** the 1000-character limit falls in the middle of `$$\omega = \sqrt{k/m}$$`
- **THEN** the whole formula stays in the closing passage

### Requirement: Passage Section Context
The system SHALL record for each passage its start and end character offsets in the document, the text of the nearest Markdown heading (levels 1 to 6) located at or before the passage start, the section number taken from the beginning of that heading (for example "1.2.4" from "1.2.4 Top Bracing") when present, and references to the previous and next passages.

#### Scenario: Section number
- **GIVEN** a passage that starts after the heading `## 4.4 Bridge Placement`
- **WHEN** the document is indexed
- **THEN** the passage records heading "4.4 Bridge Placement" and section number "4.4"

### Requirement: Figure ID Extraction
The system SHALL give every embedded image a figure ID, first match wins: (1) "Fig./Figure X.Y-Z" in the alt text; (2) "Fig" or "Figure" followed by optional punctuation and "X.Y-Z" within the 300 characters after the image; (3) "figure X.Y-Z" in the URL path, with optional `-` or `_`; (4) otherwise the file name without extension, characters other than letters, digits and `-` replaced by `-`. Cases 1-3 store the bare "X.Y-Z".

#### Scenario: ID from alt text
- **WHEN** an image has alt text "Fig. 4.4-2 Bridge layout"
- **THEN** its figure ID is "4.4-2"

#### Scenario: Fallback to file name
- **WHEN** an image `https://example.org/img/top_view.png` has alt text "Top"
- **AND** no figure number appears near it
- **THEN** its figure ID is "top-view"

### Requirement: Figure Caption Extraction
The system SHALL give every embedded image a caption, first match wins: the alt text with any figure reference removed, if longer than 5 characters; otherwise the caption text of a "Figure X.Y-Z: ..." or "Fig. X.Y-Z ..." line within the 300 characters after the image; otherwise the alt text.

#### Scenario: Caption from following line
- **GIVEN** an image with alt text "Fig. 4.4-2"
- **AND** the next line reads "Fig. 4.4-2: Set up a rule on the bridge"
- **WHEN** the document is indexed
- **THEN** the caption is "Set up a rule on the bridge"

### Requirement: Figure-to-Passage Association
The system SHALL attach an image to every passage whose character range contains the image, and to every passage whose text mentions its figure ID as "Fig X.Y-Z", "Fig. X.Y-Z" or "Figure X.Y-Z". Each attached image records figure ID, URL, caption, alt text and the placement "referenced_in_text".

#### Scenario: Figure referenced in another passage
- **GIVEN** an image with figure ID "4.4-2" located in passage 3
- **AND** passage 7 says "see Fig. 4.4-2"
- **WHEN** the document is indexed
- **THEN** the image is attached to passages 3 and 7

### Requirement: Image Copying to Application Storage
The system SHALL, during indexing, copy each distinct embedded image (by figure ID) into the application's publicly readable image storage at `<document id>/<figure id>.<extension>`, replacing any previous copy, and make the attached passages refer to the copy. Images already in that storage are reused; the document's Markdown is not rewritten; only admins can trigger copying.

#### Scenario: External image copied
- **WHEN** a document embedding `https://example.org/fig.png` is indexed
- **THEN** a copy is stored in the application's image storage
- **AND** the passages that include that figure refer to the stored copy

### Requirement: Image Copy Validation
The system SHALL copy an image only if its URL is absolute `http`/`https`, the download succeeds, the response is an image content type, and it is at most 10 MB; accepted formats are PNG, JPEG, GIF and WebP, with the stored extension following the content type. An image that fails keeps its original URL in the passages, is counted as failed, and text indexing continues.

#### Scenario: Oversized image
- **WHEN** an embedded image is 12 MB
- **THEN** it is not copied, the passages keep the original URL, and the admin is told images failed to upload

### Requirement: Indexing Triggers
The system SHALL compute on the server a semantic embedding for every passage and store it with the passage whenever a document is saved from the editor with "Generate embeddings" enabled and non-empty content, and whenever a document is imported by drag and drop. Re-indexing replaces all previous passages of the document.

#### Scenario: Edit triggers re-index
- **GIVEN** a document with 5 indexed passages
- **WHEN** an admin shortens it to 2 passages' worth of text and saves with indexing enabled
- **THEN** the document has exactly 2 passages afterwards

### Requirement: Atomic Re-Indexing
The system SHALL keep a document's previous passages until its new passages have been generated and stored successfully, so a failed re-index never leaves the document unsearchable or half-indexed.

#### Scenario: Embedding service unavailable
- **GIVEN** a document with existing passages
- **WHEN** an admin saves it and the embedding service fails
- **THEN** the error message is shown and the previous passages remain searchable

### Requirement: Embedding Model Consistency
The system SHALL embed passages and questions with Google `gemini-embedding-2` at 768 dimensions and compare them by cosine similarity. Changing the model or dimension SHALL require re-indexing every document, because vectors from different models are not comparable. The legacy index used `text-embedding-004`, which Google has shut down.

#### Scenario: Retrieval prefixes
- **WHEN** a passage or a question is embedded
- **THEN** a passage is sent as "title: <document title> | text: <passage>" and a question as "task: question answering | query: <question>", as the model expects for asymmetric retrieval

#### Scenario: Model change
- **WHEN** the operator switches to a different embedding model
- **THEN** all documents are re-indexed before the assistant uses the new model for questions

### Requirement: Indexing Status Visibility
The system SHALL show indexing progress only during a save ("Generating embeddings...") and report indexing outcomes through the save and import messages; there is no persistent per-document index status in the list.

#### Scenario: Progress during save
- **WHEN** an admin saves a long document with indexing enabled
- **THEN** the Save button reads "Generating embeddings..." until indexing finishes

### Requirement: Saving Without Re-Indexing
The system SHALL leave a document's existing passages unchanged when it is saved with "Generate embeddings" disabled, and SHALL remove all of a document's passages when it is saved with empty content.

#### Scenario: Indexing option disabled
- **WHEN** an admin edits a document and saves with "Generate embeddings" unchecked
- **THEN** the document text is updated and its previous passages remain as they were

#### Scenario: Content cleared
- **WHEN** an admin clears a document's content and saves
- **THEN** the assistant no longer retrieves passages from that document

### Requirement: Indexed Passage Data
The system SHALL persist, for each indexed passage: a unique identifier, the owning document (passages are deleted with their document), the passage number, the passage text, its embedding vector (768 numbers), a creation timestamp, and metadata holding start/end character offsets, heading, section number, contains-formula flag, equation references, attached images (figure ID, URL, caption, alt text, placement) and previous/next passage references.

#### Scenario: Passages removed with their document
- **WHEN** a document is deleted
- **THEN** none of its passages remain stored

### Requirement: Indexing Configuration
The system SHALL read the embedding service credential from operator-supplied server-side configuration and never expose it to the browser; if it is missing, indexing SHALL fail with an error saying the key is not set. The operator SHALL also provide a publicly readable image storage area for copied figures.

#### Scenario: Missing embedding key
- **GIVEN** the operator has not configured the embedding service key
- **WHEN** an admin saves a document with indexing enabled
- **THEN** the document is saved and the editor reports that embeddings failed because the key is not set

### Requirement: Reference Library Localization
The system SHALL present all reference library text (labels, hints, confirmations, errors) in English and French according to the user's selected language.

#### Scenario: French interface
- **GIVEN** the interface language is French
- **WHEN** an admin opens the library
- **THEN** the title reads "Références" and the add button reads "Ajouter une référence"
