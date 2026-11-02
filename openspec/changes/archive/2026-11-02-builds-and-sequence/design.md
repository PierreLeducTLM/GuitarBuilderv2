# Design

## Context

`foundation` left these pieces this change builds on:
- the route gate and shell (`/builds` and `/builds/<id>` are placeholders);
- the browser and server Supabase clients typed by `@gb/db`;
- the confirm, prompt and toast hooks (`DialogProvider`, `useToast`);
- next-intl with the shared `short` date and `decimal1` number formats;
- the pgTAP runner with its Supabase shim, and the fake Supabase server used by the end-to-end tests.

Its design (archived in `openspec/changes/archive/2026-11-01-foundation/design.md`) fixed the conventions reused here: explicit grants plus RLS, `SECURITY DEFINER` functions with `search_path = ''`, every user-visible string in both catalogs, and design tokens only.

The legacy audit (`docs/rewrite/legacy-findings/builds-sequence-story.md`) lists the defects this design must not repeat:
- the list query had no owner filter;
- the share policy let anyone read every shared build;
- the step document was rewritten whole on every keystroke, last writer wins;
- storage policies let any user upload to or delete any path, and anyone list the bucket;
- photo files were orphaned when their build was deleted;
- partial upload failures were silent;
- the step template was duplicated in four places;
- much of the text was hard-coded in English.

The requirements are in `openspec/specs/guitar-builds/spec.md` and `openspec/specs/build-sequence/spec.md`, with this change's delta. Scope and deferrals are in proposal.md.

## Goals / Non-Goals

**Goals:**
- Every `guitar-builds` and `build-sequence` requirement, except the parts deferred in proposal.md, in English and French and in both themes.
- Every access rule enforced in Postgres or Storage policies, with a pgTAP test.
- One typed source for the step template. Unit tests check it against the spec text and reproduce all six specified step and arrow counts.

**Non-Goals:**
- No measurement capture UI. The step function accepts new measurements now, so `tap-tone-capture` only adds the dialog and the "Add Analysis" button.
- No share token handling: the column exists but is unreadable and unwritable by clients until `build-story-sharing`.
- No realtime subscriptions. The owner's views read fresh data on load; live updates belong to the story.
- No user deletion. `admin-console` will reuse `build_photo_paths` to remove the user's photo files before deleting the account.

## Decisions

### 1. The `builds` table

`public.builds` columns:

| Column | Definition |
|---|---|
| `id` | `uuid primary key default gen_random_uuid()` |
| `owner_id` | `uuid not null default auth.uid() references auth.users on delete cascade` |
| `name` | `text not null check (name ~ '\S')` |
| `guitar_type` | `text check (guitar_type in ('classical','steel_string'))`; null means "not set" |
| `bobo_neck` | `boolean not null` |
| `sequence_state` | `jsonb not null default '[]'` |
| `share_token` | `uuid unique` |
| `share_enabled` | `boolean not null default false` |
| `created_at`, `updated_at` | `timestamptz not null default now()` |

- An index on `(owner_id, created_at desc)` serves the list.
- A `before update` trigger sets `updated_at = now()`, so every step change moves it.
- **One step-state document per build, not a `build_steps` table.** The spec defines the step state as one structured attribute of the build. The story and the legacy import also read and write it as one document.
  - What a table would give, row-level atomic updates, comes from the step function instead (decision 3).
  - Alternative considered: a normalized table. Rejected because it contradicts the stated attribute and splits one build's state across 132 rows that every reader reassembles.
- **Entry shape:**
  - each entry is `{ key, completed, notes, photos: [{ url, name }], measurements: [...] }`;
  - a measurement is `{ id, timestamp, description, frequency, spectrum }`, where `spectrum` is the Tap-Tone Spectrum Record of `tap-tone-capture` (`frequencies`, `magnitudes`, `magnitudesDb`, `sampleRate`, `fftSize`, `binWidth`).
- **Entries are created on a step's first change.** A new build stores `[]`, so its state follows from the spec's loading rule: a template step without an entry is not completed and empty.
  - This is how the build meets "a sequence state with every template step not completed" without the database holding a copy of the template.
  - Entries whose key is not in the template are kept in storage and ignored on load (Step State Loading).

### 2. Access rules

**Row-level security on `builds`, `to authenticated`:**
- select where `owner_id = auth.uid() or public.is_admin()`;
- insert with check `owner_id = auth.uid() and guitar_type is not null`;
- update using and with check `owner_id = auth.uid() and guitar_type is not null`;
- delete using `owner_id = auth.uid()`;
- `anon` gets no policy and no grant.

**The administrator rule (Administrator Access to Builds):**
- the select policy lets an administrator read any build;
- the write policies give administrators nothing extra;
- the list query filters on `owner_id = <the signed-in user>` explicitly, because RLS alone would show an administrator everyone's builds (the legacy leak).

**Grants are column-level** after `revoke all`:
- `select (id, owner_id, name, guitar_type, bobo_neck, sequence_state, share_enabled, created_at, updated_at)`. `share_token` is left out, so neither another user nor an administrator can read a token (No Enumeration of Shared Builds); `build-story-sharing` adds an owner-only way to read it.
- `insert (name, guitar_type, bobo_neck)` and `update (guitar_type, bobo_neck)`. Clients cannot rename a build, move it to another owner, or touch the share columns or `sequence_state`.
- `delete`.

**Guitar type:** "not set" exists only for migrated builds. Both write policies require a guitar type, so a migrated build leaves "not set" the first time its owner saves the variant, as the spec invites. The import runs as `service_role` and is not affected.

### 3. Step changes: `public.update_build_step(p_build_id uuid, p_step_key text, p_change jsonb) returns jsonb`

The function is `SECURITY DEFINER`, `set search_path = ''`, executable by `authenticated` only.

How it works:
- It locks the row (`select … for update`) and requires `owner_id = auth.uid()`. A missing build and someone else's build both raise the same "Build not found" error, so existence does not leak.
- It applies one operation to one entry, creating the entry if needed, rebuilds the list and returns the updated entry.
- The row lock serializes concurrent changes. Two devices editing different steps or fields never overwrite each other; the same field edited on two devices keeps the last write.

**Operations** (`p_change.op`):
- `set_completed { completed }`
- `set_notes { notes }`
- `add_photos { photos: [{url, name}] }`, appended in the given order
- `remove_photo { name }`
- `add_measurement { measurement }`
- `set_measurement_description { id, description }`
- `remove_measurement { id }`

**Validation** raises SQLSTATE 22023:
- the key must match `^[A-Za-z0-9]{1,64}$`;
- every field must have its JSON type;
- photo names must match `<digits>_<suffix>.<ext>`, and the URL must end with `/<build id>/<key>/<name>`;
- descriptions are trimmed and must not be blank;
- a measurement's three lists must have equal lengths and no frequency above 2000 Hz.

**The template's keys are not copied into SQL.** The spec says unknown keys are ignored on load, so accepting any well-formed key is safe. A second copy of the 132 keys would need its own sync test. Alternative considered: one function per operation, which gives nicer generated types but seven grants and seven tests for the same lock-and-merge logic.

**`public.build_photo_paths(p_build_id uuid) returns setof text`** (`SECURITY INVOKER`) lists the object names under `<build id>/` in `storage.objects`. The storage select policy limits it to the owner. Build deletion uses it now, and user deletion will later.

### 4. Photo storage

**The bucket:** `step-photos` is created by the migration (`insert … on conflict do nothing`):
- `public = true`;
- `allowed_mime_types = '{image/*}'`;
- no bucket size limit.

Public means the storage service serves `/storage/v1/object/public/step-photos/<path>` to anyone with the URL (Step Photo Storage), without any `anon` policy. With no `anon` select policy, nobody can list the bucket. The image-only rule closes the legacy hole where any file, HTML included, could be hosted.

**Paths:** `<build id>/<step key>/<file name>`. The file name is `<Date.now()>_<8 random base-36 characters>.<extension>`, where the extension comes from the original file name, or from the MIME subtype when the name has none. The step records `{ url, name }`, and the object path is rebuilt from the build, key and name.

**Policies on `storage.objects`, `to authenticated`, `bucket_id = 'step-photos'`:**
- insert, select and delete are allowed when the first path segment names a build whose `owner_id = auth.uid()`;
- there is no update policy, so files cannot be overwritten (uploads use `upsert: false`).

**Upload:**
- The browser uploads the files directly to Storage, in parallel. Routing them through a Next.js function would hit Vercel's request-size limit.
- One `add_photos` call then appends the successful ones in selection order.
- If any file failed, the user sees "Failed to upload some or all photos".
- If the `add_photos` call itself fails, the files just uploaded are removed (best effort) and the same message is shown.

**Camera:** the button is an `<input type="file" accept="image/*" capture="environment">`, shown only when `navigator.mediaDevices.enumerateDevices()` reports a `videoinput`. Phones open their native rear camera. Alternative considered: an in-app `getUserMedia` viewfinder. Rejected because it needs extra screens and strings, and phones' own camera UI handles focus and flash better.

**Photo deletion:**
- `storage.remove([path])` first; then `remove_photo`.
- Supabase returns an empty list, not an error, when RLS refuses a delete (checked against the local Storage service). An empty result therefore counts as a failure ("Failed to delete photo"), unless a request to the public URL fails with a 4xx status (Storage answers 400 for a missing object). In that case the file is already gone and only the reference is removed, so a broken migrated photo can still be cleaned up.

### 5. Build deletion

Deletion runs in the browser client after confirmation:
1. `build_photo_paths`
2. `storage.remove` in batches of up to 1000
3. delete the row

Any failure stops the sequence and shows "Failed to delete guitar build".

**Files go first** because the reverse order can leave public files of a deleted build, which the spec forbids (Delete Build Cascade). The opposite risk, files removed but the row not deleted, needs the same user's delete to be refused right after their storage deletes succeeded. It is reported to the user and leaves only broken thumbnails.

The share link dies with the row. The cascades to acoustic results and wood panels come from those tables' foreign keys (`on delete cascade`, `on delete set null`) when their changes create them.

### 6. The step template: one typed module

`apps/web/src/lib/sequence/template.ts` exports the 132 steps in canonical order and the 144 arrows. Each step has:
- `key`;
- `number` (1–132);
- `group` (1–15);
- `guitarType`: `'classical' | 'steel_string' | null`;
- `needsBobo`;
- `highlight`: `'variant' | 'bridgeBlank' | null`.

Labels live in the message catalogs as `steps.<key>` in `en.json` and `fr.json`, so the existing key-parity test covers them.

**Applicability:** a step is hidden when either holds:
- `needsBobo && !build.boboNeck`;
- `step.guitarType && build.guitarType && step.guitarType !== build.guitarType`.

`CLGlueBOBO1` and `CLCutBOBO` are `classical` and `needsBobo`, which gives the delta's clarification. Before writing this design, a script applied this rule and the bridging rule of decision 7 to the template parsed from the spec. It reproduced all six counts in the spec: 120/129, 112/120, 120/131, 114/124, 132/144 and 124/135.

**Conformance test:** a unit test parses `openspec/specs/build-sequence/spec.md` and checks the module and catalogs against it:
- the Template Group lists: keys, order, English labels;
- the French label scenarios;
- the connection and cross-group scenarios;
- the applicability scenarios.

The template, the spec and both catalogs therefore cannot drift apart. The story and the import will use this module and its derivations instead of copying them (the legacy app had four copies). It moves to a workspace package if the import script needs it outside the app.

### 7. Derived state (pure functions in `apps/web/src/lib/sequence/`)

All of these are unit-tested against the spec's scenarios and shared by the summary strip, the diagram and, later, the story:
- **`mergeStepState(stored)`**: the template merged with the stored entries by key (Step State Loading).
- **`displayGraph(variant)`**: the visible steps and arrows.
  - Direct arrows between visible steps are kept.
  - For each hidden step in template order, every visible predecessor (found through hidden steps) is connected to every visible successor, without duplicates.
  - Each bridging arrow is then dropped, in order, if its target is still reachable from its source through the other displayed arrows.
- **`stepStatus(...)`**: completed, ready (not completed, with every displayed predecessor completed) or not started.
- **`progress(...)`**: `C`, `T` and `P = round(100 × C / T)` (Story Progress).
- **`nextUp(...)`**: the first ready step in template order.
- **`latestMeasurement(...)`**: the most recent `timestamp` among the measurements of displayed steps.
- **`spectrumPoint(f, dB)`**:
  - `x = (f − 20) / 1980` and `y = (−20 − clamp(dB, −100, −20)) / 80`, as fractions of the plot width and height;
  - `f` is the frequency in Hz and `dB` the magnitude in decibels.

### 8. Diagram canvas: React Flow with a dagre layout

**Canvas:** `@xyflow/react` 12 (MIT) provides pan, wheel and pinch zoom, the zoom and fit controls and the dotted background. It is configured to match Diagram Interaction Restrictions:
- `nodesDraggable`, `nodesConnectable` and `elementsSelectable` off;
- `minZoom 0.1`, `maxZoom 1.5`;
- right-angled `step` edges, not animated.

**Step boxes:** each one is a custom node rendering a `<button>`. Steps are therefore reachable by keyboard and open their dialog with Enter or Space. The accessible name includes the number, label and state.

**Layout:** `@dagrejs/dagre`, the layout React Flow documents, with `rankdir LR`, `ranksep 100` and `nodesep 50` on 200 × 60 boxes. It is computed with `useMemo` from the display graph and never stored.
- Alternative considered: our own longest-path layering. It is simple, but it leaves edge crossings that dagre's ordering heuristics remove.
- Alternative considered: elkjs. Heavier, and asynchronous.

**Exact versions** are pinned at apply time: the newest release at least two weeks old, the same rule as for scripts.

**Loading:** the canvas loads with `next/dynamic` (`ssr: false`) and shows "Loading diagram..." until it is ready.

**Theme:** React Flow's `--xy-*` CSS variables are mapped to our tokens, and its stylesheet is imported once.

**Viewport:** saved on `onMoveEnd` to `localStorage` under `gb-viewport:<build id>` (try/catch). It is restored as `defaultViewport`, or `fitView` is used when nothing valid is stored.

### 9. Pages and data flow

**Server reads:**
- `/builds` (Server Component) reads `id, name, guitar_type, created_at` with the explicit owner filter, newest first.
- `/builds/[id]` checks the id is a UUID, then reads the build's columns, including `sequence_state`. A non-UUID, missing or unreadable build becomes `redirect('/builds')`.
- `loading.tsx` files show "Loading builds..." and "Loading build...".
- A failed list query renders "Failed to load guitar builds".

**Edit rights:** the detail page passes `canEdit = owner_id === session.userId`. An administrator viewing someone else's build gets no editing controls, and the database refuses their writes anyway (decision 2).

**Browser writes:**
- **Create:** an insert returning the new `id`, then `router.push`. The submit button is disabled, and guarded by a ref, while the request runs.
- **Change variant:** an update of `guitar_type` and `bobo_neck`, then `router.refresh()`. The dialog reuses the creation dialog's "Guitar Type" and "Bolt-on/bolt-off (BOBO) neck" fields under the title "Construction", so no new strings are needed beyond "Save" and "Cancel".
- **Delete:** decision 5, then `router.replace('/builds')`.

**Tabs:** the tab, and the step whose dialog is open, are React state of the detail page. A reload therefore starts on Overview. "Next up" sets both: it switches to the Sequence tab and opens that step's dialog.

### 10. Saving step changes

A per-build store holds the merged state and a serial queue of `update_build_step` calls.

- **Optimistic updates:** each change is applied locally at once and queued. Calls run one at a time, in order, so a completion sent after notes always lands after them (Rapid edits are not lost).
- **Server response:** the entry returned by the server replaces the local one, unless a newer change to that step is still queued.
- **Notes:** saved 500 ms after the last keystroke, and immediately on dialog close, when the page is hidden (`visibilitychange`), or before any other change to the same step.
- **On failure** the store reverts that change and shows "Failed to save changes" (delta: Step Save Failures).
  - Notes being typed are the exception: they stay in the field and are sent again with the next edit.
  - A completion toggle closes the dialog as specified; the badge it would have set is removed on failure.

### 11. Look and tokens

**New token roles in `packages/ui/src/tokens/themes.ts`,** with dark and light values chosen under the existing AA contrast test:
- `variant`: the CL/SS/BOBO steps;
- `bridgeBlank`: the two bridge-blank steps.

**Step states use existing roles:**
- completed: teal, with a check badge;
- ready: amber outline with a glow;
- not started: hairline and dim text.

**Display formats:**
- step numbers: `font-mono`, zero-padded to three digits;
- measurement dates: a new shared `dateTimeShort` format;
- peaks: `decimal1`;
- the spectrum graph: an SVG with amber trace, graticule grid lines, and a dashed peak marker labelled in mono.

### 12. Tests

**Unit (Vitest):**
- template conformance against the spec text;
- applicability and the six counts;
- the four bridging scenarios, ready steps, progress, next up and state merging;
- spectrum mapping and clamping;
- photo file naming;
- the save queue: ordering, coalescing notes, reverting on failure;
- form validation;
- the "Peak: 98.3 Hz" formatting.

**pgTAP:**
- `05_builds_schema`: columns, constraints, grants, function settings and execute grants;
- `06_builds_access`: owner CRUD; other users and anonymous see nothing; an administrator reads but cannot insert, update, delete or call the step function on another user's build; `share_token` is unreadable; the blank-name and missing-type checks; `updated_at` moves;
- `07_build_steps`: every operation, the validation errors, and that appending to one step keeps another step's concurrent edit;
- `08_step_photos`: the owner uploads, reads and deletes in their own build's folder; another user and anonymous cannot; nobody lists; deleting the user cascades their builds.

**Shim:** `scripts/test-db/supabase-shim.sql` gains a minimal `storage` schema (`buckets`, `objects` with RLS, `storage.foldername()`, Supabase's grants).

**CI:** the database job stays as it is. With the Supabase CLI version CI pins (2.122.0), `supabase db start` already creates the complete storage schema: the bucket columns, row-level security and the delete protection. The new suite passes that way locally.

**End-to-end:** the fake Supabase server learns the builds REST calls the app makes, the two RPCs and the storage upload, remove and public-read endpoints. Each has failure switches for the specified error messages.

**Scenarios covered:**
- list, empty and error states;
- creation validation and success;
- deletion: confirm, cancel and failure;
- deep links and redirects;
- the administrator's read-only view;
- tab reset on reload;
- the diagram: step and arrow counts for a variant, completion persisting across a reload, notes autosave, a partial photo-upload failure, photo deletion, measurement edit and delete on seeded data, the viewport restored per build;
- French labels;
- the phone layout.

## Risks / Trade-offs

- **[The step document grows with spectra]** A 331-point record is about 18 KB, so even heavy use stays in the low megabytes and loads with the detail page. If it becomes heavy, spectra can move to a side table behind the same function without changing the stored step format the spec defines.
- **[Supabase's project-wide upload size limit (50 MB by default) still applies]** The app sets no limit of its own, so a larger file fails as a normal upload failure with the specified message. The operator can raise the project limit.
- **[`allowed_mime_types` wildcards]** Confirmed against the local Storage service: `image/*` accepts PNG and refuses `text/html`.
- **[Two database test paths]** The pgTAP files run both against the shim (`pnpm test:db`) and against the Supabase image (`supabase test db`, as in CI). The shim copies the storage tables, grants and delete protection of the image, so both paths give the same results.
- **[The fake Supabase server can drift from PostgREST and Storage]**
  - It implements only the calls the app makes, with the same request shapes; the rules themselves are tested by pgTAP.
  - Recommended next step, outside this change: an end-to-end CI job against `supabase start`.
- **[Files deleted but the build kept]** Explained in decision 5: the window is the same user's delete being refused right after their storage deletes succeeded. The user is told, and only thumbnails break.
- **[Same-field edits from two devices]** The last write wins for that one field; different steps and fields never collide (decision 3).
- **[dagre layout quality]** The spec fixes layering and spacing, not crossings. If the diagram reads poorly, the layout is one function to swap.

## Migration Plan

**Deploy:**
- One new additive migration. The deploy workflow applies it to the hosted project when it reaches `main`.
- The bucket insert is idempotent.
- No environment variables are added.

**Rollback:**
- Redeploy the previous app build.
- The tables can stay, because nothing else reads them yet.

**Legacy import:** `legacy-data-migration` will write builds as `service_role`, in the step format of decision 1, keeping ids, share tokens and photo references.

## Open Questions

These change only template data, labels or limits, not the approach or tasks:
- Is the reversed body-assembly order right? (`docs/rewrite/README.md`, "Still open" 2)
- Do the French step labels need terminology changes? ("Still open" 3)
- Should photos get count or size limits? (legacy findings, question 7)
