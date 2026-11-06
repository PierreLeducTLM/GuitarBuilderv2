# Design

## Context

See proposal.md for why. This section lists what the plan relies on.

**The first version** (repository `PierreLeducTLM/GuitarBuilder`, commit `3dcaed9`) runs on its own hosted Supabase project:
- Accounts live in `auth.users` and `auth.identities`, with bcrypt password hashes in `auth.users.encrypted_password`.
- Roles live in `public.user_profiles(id, email, role)`. Some accounts have no profile row.
- Builds live in `public.guitar_builds(id, user_id, text_identifier, model_name, width, length, created_at, updated_at, share_token, share_enabled, sequence_diagram)`.
  - `sequence_diagram` was added by hand: its migration was deleted, so it may be missing or null.
  - Its shape is `{ nodes: [{ id, completed, notes, photos: [{ url, fileName }], fftAnalyses: [{ id, timestamp, description, peakFrequency, fftData }] }] }`.
  - `fftData` is already the Tap-Tone Spectrum Record, cut at 2000 Hz (`FrequencyDetectionModal.tsx:800-822`).
- Photo files are in its public `step-photos` bucket at `<build id>/<step key>/<Date.now()>_<Math.random().toString(36).substring(7)>.<extension>`. The suffix length varies, and the "extension" is whatever followed the last dot of the original name, or the whole name when it had none. So some legacy names don't match v2's stricter file-name rule.
- Wood panels live in `public.wood_panels(id, user_id, build_id, name, sample_length, sample_width, sample_thickness, sample_mass, freq_longitudinal, freq_cross_grain, freq_diagonal, target_plate_length, target_plate_width, vibrational_stiffness_param, young_modulus_longitudinal, young_modulus_cross, shear_modulus, target_thickness, estimated_panel_mass, fft_data, created_at, updated_at)`.
  - The inputs are `numeric`, with no positivity check.
  - `user_id` may be null.
  - `build_id` was never used by the app.
  - The results were computed in the browser with the wrong cross-grain formula.
  - `fft_data` is null or an object keyed by the calculator's field names (`freqLongitudinal`, `freqCrossGrain`, `freqDiagonal`). Each value is a record of the same six fields as a step measurement's `fftData` (`WoodPropertiesCalculator.tsx:295-317`).
- Default panels live in `public.default_wood_panels`, with the same inputs and results but no owner, build or spectra.
- Spectra come from `analyzeAudioBuffer` (`dsp.ts`), which starts at 20 Hz and runs at FFT sizes up to 32768, and they are cut at 2000 Hz. At 32768 points and 48 kHz that is up to about 1366 points, which is more than v2's limit of 1024.

**The v2 side** comes from `builds-and-sequence`:
- `public.builds`;
- `update_build_step` and its entry format `{ key, completed, notes, photos: [{ url, name }], measurements: [{ id, timestamp, description, frequency, spectrum }] }`;
- the `step-photos` bucket with paths `<build id>/<step key>/<name>` and names matching `^[0-9]{1,16}_[A-Za-z0-9]{1,32}\.[A-Za-z0-9]{1,16}$`;
- `public.profiles`, filled by the `handle_new_user` trigger (the first profile ever created becomes admin).

**And from `wood-panel-calculator`:**
- `public.wood_panels` and `public.default_wood_panels` store the name and the ten inputs. Density, E_L, E_C, G_LC, target thickness and estimated mass are generated columns computed by the `public.wood_*` SQL functions with the corrected formulas, so nobody writes them.
- `wood_panels.spectra` is an object keyed `longitudinal`, `crossGrain` and `diagonal`, each value checked by `spectrum_record_is_valid`.
- `default_wood_panels` has no `updated_at`.
- No migration seeds the default panels.

**Both sides:** `spectrum_record_is_valid` accepts 1 to 1024 points, strictly ascending frequencies in (0, 2000] Hz, non-negative magnitudes, a power-of-two FFT size and `binWidth = sampleRate / fftSize`.

**Environment limits found while planning:**
- The cloud environment cannot open Postgres connections to `*.supabase.co` or the pooler (TCP 5432 is blocked).
- `https://api.supabase.com` is reachable.
- Secrets added to the environment reach only new sessions.

## Goals / Non-Goals

**Goals:**
- After an applied run, every imported user signs in to v2 with their first-version email and password, has their first-version role, and sees their builds with the same ids, step state, photos and share links, and their wood panels with corrected results and their spectra.
- A dry run produces the full report and writes nothing; repeated runs converge instead of duplicating.
- The import never writes to the first-version project.

**Non-Goals:**
- Saved build FFT results, the prompt template, references and conversations; they need v2 tables that don't exist yet.
- Sessions, refresh tokens and MFA factors. Users sign in again; the report counts MFA factors if any exist.
- Moving Auth settings such as email templates or the site URL; they are configured in v2 separately (README).

## Decisions

### 1. Transport: Management API SQL and Storage over HTTPS, with a direct mode for local runs

Each end (source v1, target v2) gives the import two operations: run SQL and get JSON rows back, and read or write Storage objects.

**Hosted mode** (`SUPABASE_ACCESS_TOKEN`, `LEGACY_SUPABASE_PROJECT_REF`, `SUPABASE_PROJECT_REF`):
- **SQL:** `POST https://api.supabase.com/v1/projects/<ref>/database/query` with `{ query }`.
- **Source photos:** downloaded from their public URLs, because the v1 bucket is public.
- **Target uploads:**
  - sent to `https://<ref>.supabase.co/storage/v1/object/step-photos/<path>` with `x-upsert: true`;
  - authorised by the v2 secret key, read at start-up from `GET /v1/projects/<ref>/api-keys?reveal=true` and kept in memory only.

**Local mode** (`LEGACY_DATABASE_URL`, `LEGACY_SUPABASE_URL`, `TARGET_DATABASE_URL`, `TARGET_SUPABASE_URL`, `TARGET_SERVICE_KEY`):
- SQL goes through `psql`;
- Storage goes through the local stacks.

This mode serves the rehearsal and tests (decision 10).

**Why:**
- One personal access token covers both projects.
- Nothing needs the blocked Postgres port.
- The deploy workflow already uses the same token name.

**Alternatives considered:**
- Direct Postgres connections: blocked here.
- Recreating users with the Auth Admin API and `password_hash`: loses `identities`, confirmation timestamps and metadata, and still needs SQL for the hashes.

**JSON embedding:** JSON payloads are embedded in SQL as dollar-quoted literals with a random tag, checked not to occur in the payload, and read with `jsonb_populate_record(set)`. No string concatenation of values.

**The source end is read-only:** its executor refuses any statement that is not a single `select`, so a bug cannot write to v1.

### 2. Accounts: copy the Auth rows, then set roles

1. The source query returns `to_jsonb()` of every `auth.users` and `auth.identities` row and the `user_profiles` roles.
2. The target column list is the v2 columns that are not generated (`auth.users.confirmed_at`, `auth.identities.email`), read from `information_schema`, intersected with the keys present.
3. Rows are upserted on `id`. The GoTrue token columns, which GoTrue reads as non-null strings, are coalesced to `''`.
4. Inserting a user fires `handle_new_user`, which creates the profile. The import then sets `profiles.role` from the legacy profile, or `user` when there is none, and lists those accounts as "given a profile".

**One transaction per account.**

**Email conflict:** a v2 account with the same email (case-insensitive) and a different id means the legacy account, and every build and wood panel it owns, is skipped and reported (delta requirement "Accounts Already in the New System"). The import never deletes or merges a v2 account.

Because the hash and the email confirmation state are copied, GoTrue in v2 accepts the same password. The rehearsal (decision 10) proves it against a real GoTrue.

### 3. Builds

**Pure conversion:** `convertBuild(legacyRow)` produces the v2 row, the photo copy list and the report notes.

**Columns:**
- `name`: `text_identifier` trimmed. A blank name becomes "Untitled build" and is reported, because v2 refuses blank names.
- `bobo_neck`: true.
- `guitar_type`: inferred (decision 4).
- `share_enabled`: copied. `share_token` is kept only when sharing is on, so a leftover token never makes an unshared build reachable.
- `created_at` and `updated_at`: copied.
- `model_name`, `width` and `length`: dropped, and listed in the report when any of them was non-empty.

**Skipped builds,** with a reason in the report: no owner (`user_id` null), or an owner that was not imported.

**Upsert:** builds are upserted on `id`, in one transaction per build, after their photos are copied.

**Keeping the first-version `updated_at`:**
- `set_updated_at()` is redefined in a new migration to leave `updated_at` alone when the session setting `gb.keep_updated_at` is `on`.
- The import runs `set local gb.keep_updated_at = 'on'` in its build transactions.
- Clients reach the database only through PostgREST and `update_build_step`, which cannot set arbitrary session settings, so every client change still moves `updated_at`.
- Alternative considered: "keep it when the writer changed it". Rejected because a re-run writing the same value would read as unchanged and get the current time.

### 4. Step state and guitar type

**Each legacy node** `{ id, completed, notes, photos, fftAnalyses }` becomes an entry `{ key: id, completed, notes, photos, measurements }`:
- Only nodes with data become entries: completed, non-blank notes, a photo, or a measurement. An absent entry reads as empty in v2.
- Unknown keys are kept, as `build-sequence` allows.
- Notes are copied exactly.

**Measurements:**
- `{ id, timestamp, description, peakFrequency, fftData }` becomes `{ id, timestamp, description, frequency: peakFrequency, spectrum }`, where `spectrum` keeps the six record fields of `fftData`.
- A blank description becomes "Untitled Analysis", the legacy app's own default.
- The spectrum goes through `prepareSpectrum` (decision 6).
- A measurement whose spectrum is missing or refused is skipped and reported, as v2 attaches none without a spectrum.
- The spec's "unchanged" holds for every spectrum of 1024 points or fewer: v1 already cut spectra at 2000 Hz.

**Guitar type:**
- A step has data under the same rule as above.
- "Classical-only" steps are the template's steps whose `guitarType` is classical, including the two CL BOBO-slat steps; "steel-string-only" steps are those whose `guitarType` is steel-string.
- Only classical data gives classical; only steel-string data gives steel-string; anything else is "not set" and is reported.
- The flags come from `apps/web/src/lib/sequence/template.ts`. That module has no runtime imports, so the import package uses it directly instead of copying the 132 keys.

### 5. Photos

**Source path:**
- the legacy `fileName` when it is `<build>/<step>/<file>`;
- otherwise the part of `url` after `/step-photos/`.

**Target name:**
- the legacy file name when it already matches v2's rule;
- otherwise `<timestamp>_<suffix>.<extension>`, where:
  - the timestamp comes from the legacy name's leading digits, or the build's creation time;
  - the suffix is the first 8 base-36 characters of a SHA-256 of the source path;
  - the extension is the legacy one when alphanumeric, otherwise one derived from the downloaded content type.
- The name is deterministic, so re-runs overwrite the same object instead of adding copies.

**Copy and reference:**
- Each file is downloaded and uploaded with its content type before the build row is written.
- The step entry then gets the v2 public URL and the name.
- A file that cannot be downloaded (4xx) is left out of the entry and reported. Any other failure stops that build, and the next run retries it.

**Orphans:** v1 `step-photos` objects referenced by no imported build are counted in the report and not copied.

**Dry run:** the dry run sends a `HEAD` request for every source photo, so missing files show up in its report.

### 6. Spectra too large for v2

**`prepareSpectrum(record)`** is pure, and serves both step measurements and panel spectra. It returns the record unchanged, a reduced record, or a refusal with a reason.
- **Checks:** the same rules as `spectrum_record_is_valid`, apart from the length limit, mirrored in TypeScript.
- **Reduction:** for a record over 1024 points:
  - it splits the points, in order, into runs of `k = ceil(n / 1024)`;
  - it keeps, from each run, the point with the greatest magnitude (the first one on a tie), with its frequency, magnitude and dB value.
- `sampleRate`, `fftSize` and `binWidth` are kept, so the record stays valid. The frequencies stay strictly ascending, because the runs don't overlap.

**Why the loudest point of each run:**
- Every local maximum that is the loudest of its run keeps its exact frequency and level, so the graph's peaks and the peak readout don't move. Averaging or resampling would shift them.
- The spacing between points becomes uneven. v2's peak interpolation (`peaks.ts`) uses the distance to the next point, so it still works, slightly less precisely between peaks.

**Alternatives considered:** leaving out oversized spectra loses the graph; the owner chose to keep a reduced one.

**Report:** each reduced spectrum is listed with its point counts before and after. Each refused spectrum is listed with its reason.

### 7. Wood panels and default panels

**Pure conversion:** `convertPanel(legacyRow)` and `convertDefaultPanel(legacyRow)` produce the v2 row and the report notes.

**Columns:**
- `id`: kept, so a re-run updates the panel instead of adding a copy.
- `owner_id`: from `user_id`.
- `name`: trimmed. A blank name becomes "Untitled panel" and is reported, because v2 refuses blank names.
- **The ten inputs:** mapped by name (`sample_length` → `sample_length_mm`, …, `target_plate_length` → `plate_length_mm`, `vibrational_stiffness_param` → `stiffness_parameter`) and converted to numbers.
- `created_at` and `updated_at` are kept. Default panels keep only `created_at`.
- **Dropped:**
  - the stored results, which v2 regenerates;
  - `build_id`, counted in the report when set.

**Spectra:**
- `fft_data` keys map `freqLongitudinal` → `longitudinal`, `freqCrossGrain` → `crossGrain` and `freqDiagonal` → `diagonal`.
- Any other key is ignored and reported.
- Each value goes through `prepareSpectrum`. A refused value is left out, the panel is still imported, and the report lists it.
- A null `fft_data` becomes `{}`.

**Skipped panels,** with a reason in the report:
- no owner;
- an owner that was not imported;
- an input that is not a finite positive number, which v2's checks refuse.

A default panel with an invalid input is skipped the same way.

**Corrected values in the report:**
- The new values come from v2 itself: one read-only `select` on the target calls `public.wood_e_cross_gpa`, `public.wood_target_thickness_mm` and `public.wood_estimated_mass_g` with each panel's inputs. This works the same in a dry run, and the report matches what v2 stores.
- A panel (or default panel) is listed when E_C, target thickness or estimated mass differs from the legacy value by more than 0.1% (relative), or when the legacy estimated mass was null. It is listed with old and new values.

**Upsert:**
- Panels are upserted on `id` after all accounts, in a transaction per batch of up to 50 panels, with `set local gb.keep_updated_at = 'on'`. The `wood_panels_set_updated_at` trigger uses the same `set_updated_at()`.
- The import runs as the database owner through the Management API, so the column grants and `auth.uid()` default don't apply. `owner_id` is always written explicitly.
- Default panels are upserted on `id` in one transaction.

### 8. Running, dry run and report

**The command:** `pnpm legacy:import` runs `node packages/legacy-import/src/cli.ts` (Node's TypeScript type stripping, as the repository's other scripts do).

**Before anything else:**
- it refuses to start without a complete hosted or local configuration;
- it refuses when the source and target are the same project;
- it prints both project refs.

**The run:**
- **Without `--apply`:** reads, converts, checks conflicts and photos, and writes only the report.
- **With `--apply`:** imports accounts, then builds, then wood panels and default panels. It then counts the imported accounts, profiles by role, builds, photo objects, wood panels and default panels in v2, and records that check in the report.

**The report:**
- **Format:** `reports/legacy-import/<UTC timestamp>-<dry-run|apply>.md` and `.json`, under a git-ignored directory.
- **Counts:** imported and skipped per kind; orphaned files; panels with a build link dropped; the first-version tables not imported yet, with row counts (FFT results, settings, references, conversations); Instagram tables.
- **Lists:**
  - every skipped record with its reason;
  - accounts given a profile;
  - accounts skipped for an email conflict, with their builds;
  - builds whose guitar type is not set, and dropped dimensions;
  - renamed blank names, photos and measurements skipped;
  - wood panels and default panels whose values changed, with old and new E_C, target thickness and estimated mass;
  - spectra reduced (with point counts) or left out (with reason), and unknown panel spectrum keys.
- The Markdown is for the owner; the JSON is for tests and later runs.

### 9. Package layout

`packages/legacy-import` (`@gb/legacy-import`, private) holds:
- `src/cli.ts`;
- `src/config.ts`;
- `src/transport/`: Management API, `psql` and Storage clients;
- `src/convert/`: accounts, builds, steps, photos, inference, spectra and panels, all pure;
- `src/report.ts`.

It joins `pnpm check` through its own `typecheck` and `test` scripts. Its `tsconfig.json` sets `allowImportingTsExtensions` so it can import the template module by path.

### 10. Rehearsal against a real first-version stack

`scripts/legacy-import/rehearse.sh`:
1. starts a v1 stack from the first-version repository's migrations, on other ports with its own project id, adding the hand-made `sequence_diagram` column;
2. creates accounts through its GoTrue sign-up (real bcrypt hashes), builds with nodes, photos and measurements uploaded through its Storage, and wood panels and default panels through SQL:
   - a panel with legacy-formula results;
   - an ownerless panel;
   - spectra under the three known keys and one unknown key;
   - an oversized and an invalid spectrum;
3. runs the import in local mode against the v2 stack: dry run, apply, then apply again;
4. checks four things:
   - sign-in to v2's GoTrue with the first-version passwords;
   - roles;
   - builds, step entries and photo objects;
   - wood panels with the corrected E_C and their spectra, and default panels;
   - no duplicates after the second apply, and an email-conflict account skipped.

It needs Docker and the first-version checkout (path in `LEGACY_REPO_DIR`). It is documented, not run in CI.

## Risks / Trade-offs

- **[GoTrue column drift between the two hosted projects]** The column list is computed from v2 at run time, and keys v2 does not have are dropped and listed in the report. The rehearsal uses the same GoTrue image family as hosted projects.
- **[The Management API query endpoint could change or limit request size]** Builds are sent one per request, panels in batches of up to 50. Spectra are about 18 KB per measurement, so a build stays well under typical limits. A failed request stops that build and is reported; a re-run continues.
- **[The network policy may deny `<ref>.supabase.co`]** The dry run reaches Storage for its `HEAD` checks, so a denial shows up before anything is written. The owner then adds both hosts in the environment's network settings.
- **[An imported admin could be unexpected]** Roles follow the spec ("every legacy admin remains admin"). The report lists every admin, so the dry run shows them before anything is written.
- **[A reduced spectrum looks slightly different]** Between peaks the graph has fewer points, but peaks keep their frequency and level. The report lists every reduced spectrum, so the owner can re-measure if one matters.
- **[Legacy inputs that v2 refuses]** A panel with a zero or negative input is skipped rather than guessed at. The dry run lists them before anything is written.
- **[The report contains emails]** It is written to a git-ignored directory and printed only as counts in the terminal.

## Migration Plan

1. Merge the migration (`set_updated_at` flag); the deploy workflow applies it.
2. In a session with `SUPABASE_ACCESS_TOKEN`, `LEGACY_SUPABASE_PROJECT_REF` and `SUPABASE_PROJECT_REF`, and with network access to both project hosts: run the dry run and review the report with the owner.
3. Run with `--apply`, then sign in to v2 with a first-version account.
4. Rolling back: the import only adds or updates rows keyed by legacy ids. Removing the imported accounts (their builds and panels cascade), the imported default panels and the photo folders undoes it; the report lists every id.

## Open Questions

- Should sign-ups stay disabled in v2 now that existing users are imported? This is an Auth setting, independent of the import (README, "Authentication settings").
