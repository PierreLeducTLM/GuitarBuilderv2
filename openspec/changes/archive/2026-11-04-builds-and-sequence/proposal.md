# Proposal

## Why

`foundation` delivered the shell, sign-in and roles, but the Builds section is still a placeholder, and builds are what the app is for. `guitar-builds` and `build-sequence` come next in the recommended order (`docs/rewrite/README.md`). Every later build feature depends on them: tap-tone measurements on steps, saved acoustic results, the public story and the legacy import.

## What Changes

- **Builds data and access rules.** A `builds` table with the attributes of `guitar-builds` (Persisted Build Attributes), in a new migration.
  - Row-level security: only the owner writes a build; an administrator reads any build but changes none; anonymous visitors read nothing.
  - Column-level grants keep the share token unreadable and the share and sequence columns unwritable by clients.
  - The step state changes only through one owner-checked function that applies one step change at a time, so rapid edits from one or several devices are not lost.
  - A public `step-photos` bucket accepts only images. Its upload and delete rules allow only the owner of the build that the file's path names, and nobody can list it.
  - pgTAP tests cover every rule.
- **Builds list and creation (`guitar-builds`).** "Your Builds" with count, cards, loading, error and empty states, and the "Add New Build" dialog with name, guitar type and BOBO neck. Validation runs in the browser and again in the database.
- **Build detail page (`guitar-builds`).**
  - Header: Back to Builds, Delete Build, name, variant and creation date.
  - Summary strip: progress, latest measurement, "Next up".
  - Overview and Sequence Diagram tabs, and the "Construction" section with "Change" for the variant.
  - Deep links: inaccessible or deleted builds redirect to `/builds`; an administrator viewing another user's build gets a read-only page.
  - Delete Build with confirmation; the build's photo files are removed with it.
- **Sequence diagram (`build-sequence`).**
  - The 132-step template, kept in one typed source module, with English and French labels in the message catalogs.
  - Variant applicability and hidden-step bridging, giving the specified step and arrow counts for all six variants.
  - Automatic left-to-right layered layout, pan and zoom from 10% to 150%, and a viewport remembered per build and browser.
  - Step numbers, ready, completed and not-started states with a legend, and the two variant highlights.
- **Step details dialog (`build-sequence`).**
  - The completion toggle, and notes that save while the user types.
  - Photos: add from files or the camera, a gallery with a full-screen view, one-click deletion, and the partial-failure message.
  - The Sound Analysis list: edit a description, delete with confirmation, and the spectrum graph.
- **Deferred to the changes that own them, with their placeholders:**
  - the "Add Analysis" capture (`tap-tone-capture`), although the step function already accepts new measurements in the specified record format;
  - the Share action and dialog (`build-story-sharing`);
  - the acoustic analysis tools on the Overview tab (`build-acoustic-analysis`);
  - the cascades to acoustic results and wood panels, whose tables do not exist yet (`build-acoustic-analysis`, `wood-panel-properties`).
- **Spec clarifications (`build-sequence`):**
  - the CL BOBO-slat steps need a BOBO neck even when the guitar type is not set, which the spec's 124-step / 135-arrow count already requires;
  - a failed step save tells the user instead of failing silently (a legacy defect).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `build-sequence`:
  - "Step Applicability by Variant" gains a scenario for a build without a guitar type and without a BOBO neck; the behavior is unchanged.
  - New requirement "Step Save Failures": the message shown when a step change cannot be saved.

`guitar-builds` is implemented as written, apart from the parts deferred above.

## Impact

- **Database:**
  - a new migration with the `builds` table, its policies and grants, the `updated_at` trigger, the `update_build_step` and `build_photo_paths` functions, and the `step-photos` bucket with its storage policies;
  - new pgTAP files;
  - the local test shim gains a minimal `storage` schema.
- **Packages:**
  - `@gb/db` gains the `builds` types and the two functions;
  - `@gb/ui` gains tokens for the ready state and the two variant highlights, under the contrast test.
- **App:**
  - new routes and components under `apps/web/src/app/(shell)/builds/` and `apps/web/src/components/builds/`, `.../sequence/`;
  - pure modules under `apps/web/src/lib/sequence/`;
  - new message keys in both catalogs.
- **New dependencies, pinned exactly:**
  - `@xyflow/react`, for the diagram canvas;
  - `@dagrejs/dagre`, for the layered layout.
- **Tests:**
  - unit tests check the template against the spec text, the six variant counts, and the progress, ready and spectrum formulas;
  - the fake Supabase server learns the builds, RPC and storage endpoints the app calls, for the end-to-end tests.
- **Later changes:**
  - `admin-console` user deletion must remove the deleted user's photo files, which `build_photo_paths` makes possible;
  - `legacy-data-migration` writes the step-state format defined here.
