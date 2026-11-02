# Tasks

## 1. Database

- [x] 1.1 Extend `scripts/test-db/supabase-shim.sql` with a minimal `storage` schema: `storage.buckets` (`id`, `name`, `public`, `file_size_limit`, `allowed_mime_types`), `storage.objects` (`bucket_id`, `name`, `owner_id`, `metadata`, timestamps) with RLS enabled, `storage.foldername()`, and Supabase's grants on both tables. Verify `pnpm test:db` still passes the existing files
- [x] 1.2 Write the migration for `public.builds`: columns and checks, the owner/list index, the `updated_at` trigger, RLS policies, `revoke all` then column-level grants that leave out `share_token` and keep `sequence_state` and the share columns unwritable. Write `supabase/tests/database/05_builds_schema.test.sql` and `06_builds_access.test.sql` covering:
  - owner CRUD;
  - other users and anonymous get nothing;
  - an administrator reads but cannot insert, update or delete others' builds, and cannot read `share_token`;
  - blank-name and missing-type rejection;
  - `updated_at` moving on update;
  - builds cascading with their user.

  Verify `pnpm test:db` passes
- [x] 1.3 Add `public.update_build_step(uuid, text, jsonb)` with the seven operations, the row lock, the shared "Build not found" error and the validation rules of design decision 3, and `public.build_photo_paths(uuid)`. Revoke execute from `public` and `anon`. Write `07_build_steps.test.sql` covering:
  - each operation;
  - each validation error;
  - non-owner and administrator refusal;
  - an append to one step keeping another step's earlier change;
  - the returned entry.

  Verify `pnpm test:db` passes
- [x] 1.4 Create the `step-photos` bucket (public, `image/*`, idempotent insert) and the owner-only insert, select and delete policies on `storage.objects`. Write `08_step_photos.test.sql`:
  - the owner can insert, read and delete under their own build's folder;
  - another user, an administrator and anonymous cannot;
  - anonymous cannot list;
  - there is no update policy;
  - `build_photo_paths` returns only the owner's files.

  Verify `pnpm test:db` passes
- [x] 1.5 Confirm that the CI database job's `supabase db start` (CLI 2.122.0) creates the complete storage schema, so the job needs no change. Verify by running `supabase db start` and `supabase test db` locally with that CLI version: the bucket is created and every test passes
- [x] 1.6 Hand-write the `builds` row/insert/update types and the two function signatures in `packages/db/src/database.types.ts`, plus exported `GuitarType` and step-entry JSON types. Verify `pnpm --filter @gb/db test` and `pnpm typecheck` pass

## 2. Step template and derived state (`apps/web/src/lib/sequence/`)

- [x] 2.1 Add `@xyflow/react` and `@dagrejs/dagre` to `apps/web`, pinned exactly to the newest releases at least two weeks old. Verify `pnpm install` succeeds and the lockfile records exact versions
- [x] 2.2 Write `template.ts` (132 steps with key, number, group, guitar type, needs-BOBO and highlight, plus the 144 arrows), and add the `steps.<key>` English and French labels to `messages/en.json` and `messages/fr.json`. Verify with a conformance test that parses `openspec/specs/build-sequence/spec.md` and matches:
  - keys, order and numbers;
  - English and French labels;
  - every connection and cross-group arrow;
  - the 10 starting steps, the single final step and the duplicated labels
- [x] 2.3 Implement applicability and `displayGraph` (hidden-step bridging with redundant bridges left out). Verify unit tests for:
  - the 12/10/2/6 applicability lists;
  - all six step and arrow counts (120/129, 112/120, 120/131, 114/124, 132/144, 124/135);
  - the four Hidden Step Bridging scenarios
- [x] 2.4 Implement `mergeStepState`, `stepStatus` (completed, ready, not started), `progress`, `nextUp` and `latestMeasurement`. Verify unit tests for:
  - Step State Loading (no state, missing fields, unknown keys);
  - the Ready Steps scenarios;
  - "30 of 120 steps · 25%";
  - progress ignoring a completed hidden step;
  - next up skipping completed steps
- [x] 2.5 Implement the dagre layout function (left to right, 100 px layers, 50 px spacing, 200 × 60 boxes), the spectrum mapping (`x = (f − 20) / 1980`, `y = (−20 − clamp(dB, −100, −20)) / 80`, ascending points up to 2000 Hz) and the photo file-name generator. Verify unit tests for:
  - the predecessor-left and same-layer scenarios;
  - spacing;
  - mapping, clamping and dropping points above 2000 Hz;
  - the `<ms>_<suffix>.<ext>` form and its extension fallback

## 3. Design tokens

- [x] 3.1 Add the `variant` and `bridgeBlank` roles to both themes in `packages/ui/src/tokens/themes.ts`, regenerate `tokens.css`, map them in `theme.css`, and add their text/background pairs to the contrast test. Verify `pnpm --filter @gb/ui test` passes with every pair at least 4.5:1

## 4. End-to-end test double

- [x] 4.1 Extend `apps/web/e2e/fake-supabase.ts` with the calls the app makes:
  - `builds` select (list with owner filter and order, single by id), insert returning, update and delete;
  - `rpc/update_build_step` and `rpc/build_photo_paths`, applying the same operations;
  - storage upload, remove (empty result when refused) and public read;
  - seeding and failure switches under `/__test/*`.

  Verify the existing end-to-end suite still passes

## 5. Builds list and creation

- [ ] 5.1 Build `/builds`:
  - a Server Component reading the user's builds newest first;
  - "Your Builds (<n>)", cards with name and translated guitar type, linking to `/builds/<id>`;
  - the empty-state panel;
  - `loading.tsx` "Loading builds...";
  - "Failed to load guitar builds" on error;
  - every string in `en.json` and `fr.json`.

  Verify end-to-end tests for order, count, the card without a guitar type, the empty state and the error message
- [ ] 5.2 Build the "Add New Build" dialog:
  - name with its placeholder, guitar type with nothing preselected, BOBO checked;
  - blank-name and missing-type blocking;
  - "Adding..." while disabled;
  - the failure message keeping the name;
  - navigating to the new build on success.

  Verify unit tests of the form validation and end-to-end tests for success, cancel, duplicate names, double click (one build) and failure

## 6. Build detail page

- [ ] 6.1 Build `/builds/[id]`:
  - a Server Component that checks the id is a UUID and reads the build, redirecting to `/builds` when it is missing or unreadable;
  - `loading.tsx` "Loading build...";
  - the header: Back to Builds, Delete Build, name, translated variant or "Guitar type not set", "Created <short date>";
  - `canEdit` passed down.

  Verify end-to-end tests for the header in English and French, back navigation, a link to another user's build and a link to a deleted build
- [ ] 6.2 Build the summary strip ("<C> of <T> steps · <P>%" with `LedProgress`, the latest measurement or "No measurement yet", "Next up" or "All steps done") and the Overview and Sequence Diagram tabs held in page state. "Next up" switches to the Sequence tab and opens that step. Verify end-to-end tests for the strip on seeded state, the reload resetting to Overview, and Next up opening the step
- [ ] 6.3 Build the Overview "Construction" section with "Change" (a dialog reusing the guitar type and BOBO fields) and the "Guitar type not set" invitation. Saving refreshes the page. Verify end-to-end tests that switching steel-string to classical swaps the bridge steps, and switching back shows the earlier notes again
- [ ] 6.4 Implement Delete Build: the confirmation with the specified title, message and actions; photo paths, storage removal, then row deletion; "Failed to delete guitar build" on any failure; then `/builds`. Verify end-to-end tests for confirm (build and its photo files gone), cancel and failure
- [ ] 6.5 Implement the read-only view for an administrator on another user's build: no delete, variant change, step editing, photo or measurement controls. Verify an end-to-end test as administrator, and that the administrator's own list shows only their builds

## 7. Sequence diagram

- [ ] 7.1 Build the diagram canvas, loaded with `next/dynamic` and "Loading diagram...":
  - React Flow with dragging, connecting and selection off, zoom 10–150%, controls, dotted background;
  - right-angled, non-animated arrows from the display graph;
  - the dagre layout;
  - React Flow variables mapped to tokens.

  Verify end-to-end tests that a new steel-string BOBO build shows 120 boxes and 131 arrows, a classical build without BOBO 112 and 120, and that dragging a box does not move it
- [ ] 7.2 Build the step node as a button: zero-padded number, translated label, completed badge, ready and not-started looks, the two variant highlights, the accessible name; plus the three-state legend. Verify a component test of the node's accessible name and states, and an end-to-end test that a new build shows exactly the 10 starting steps as ready
- [ ] 7.3 Persist the viewport per build in `localStorage` (try/catch) on move end, restore it, and fit the view when nothing is stored. Verify end-to-end tests that a zoomed viewport is restored after a reload and that another build opens fitted

## 8. Step dialog: completion, notes and saving

- [ ] 8.1 Build the step store and serial save queue:
  - optimistic changes;
  - reconciliation with the returned entry;
  - notes saved 500 ms after typing stops, flushed on close, page hide and before other changes to the step;
  - revert plus "Failed to save changes" on failure, with notes kept in the field.

  Verify unit tests for ordering, notes coalescing, flush-before-complete and failure handling
- [ ] 8.2 Build the step details dialog:
  - "Step <n>", the label with its check icon, the info hint;
  - the Notes, Photos and Sound Analysis sections;
  - "Mark as Completed" / "Mark as Incomplete", which saves and closes;
  - Close and ×.

  Verify end-to-end tests for completing and reopening a step, completion persisting after a reload, out-of-order completion, notes autosave with line breaks after a reload, notes followed at once by completion, and the save-failure message

## 9. Step photos

- [ ] 9.1 Implement photo upload:
  - "Add Photo" with multiple images, uploaded in parallel, appended in selection order;
  - "Uploading..." with both buttons disabled;
  - "Failed to upload some or all photos" on any failure, with uploaded files removed if the reference save fails;
  - "Camera" shown only when a video input exists.

  Verify end-to-end tests for three files after an existing photo, a partial failure keeping the successful files, a total failure, and Camera hidden without a camera
- [ ] 9.2 Build the gallery (square thumbnails, the empty text, a full-screen view closed by × or a backdrop click) and one-click deletion (storage first, empty result treated as refused, a missing file still removable, "Failed to delete photo"). Verify end-to-end tests for deleting the second of three photos, its URL no longer serving, a deletion failure, and the full-screen view

## 10. Step measurements

- [ ] 10.1 Build the spectrum graph SVG: 20–2000 Hz and −100 to −20 dB axes, the labelled grid lines, the clamped trace, and the dashed peak marker with its "<f> Hz" label. Verify a component test of grid labels, the peak marker and a clamped point
- [ ] 10.2 Build the Sound Analysis list:
  - measurements in added order, or "No sound analysis recorded.";
  - description, local date and time, "Peak: <f> Hz" with one decimal, graph;
  - "Edit Description" (pre-filled, trimmed, Save disabled while blank);
  - deletion behind the "Delete Analysis" confirmation.

  Verify end-to-end tests on seeded measurements for "Peak: 98.3 Hz", editing a description, confirmed and cancelled deletion, and French text

## 11. Documentation and integration

- [ ] 11.1 Update the root `README.md` with the photo bucket, the storage tables in the local test shim, and the project-wide upload size limit. Verify each documented command runs as written
- [ ] 11.2 Run `pnpm check`, `pnpm build`, `pnpm test:db`, `pnpm test:e2e` and `openspec validate --strict` from a clean install. Verify all pass

## Workflow follow-up

- Review with the owner: the template's body-assembly order and the French step labels (`docs/rewrite/README.md`, "Still open" 2 and 3).
- Archive the change with `/opsx:archive` once reviewed.
