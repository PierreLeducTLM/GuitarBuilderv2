# Tasks

## 1. Database

- [ ] 1.1 Add a migration redefining `public.set_updated_at()` so that it leaves `updated_at` unchanged when the session setting `gb.keep_updated_at` is `on`. Write `supabase/tests/database/09_keep_updated_at.test.sql`: without the setting an update moves `updated_at`; with it, an explicitly written `updated_at` is kept; `update_build_step` still moves it. Verify with `supabase test db` and against the shim

## 2. Package

- [ ] 2.1 Create `packages/legacy-import` (`@gb/legacy-import`, private):
  - `tsconfig.json` with `allowImportingTsExtensions`;
  - Vitest;
  - `typecheck` and `test` scripts;
  - the root script `legacy:import`;
  - `reports/` added to `.gitignore`.

  Verify `pnpm install` and `pnpm check` pass with an empty test
- [ ] 2.2 Implement `config.ts`: hosted mode (`SUPABASE_ACCESS_TOKEN`, `LEGACY_SUPABASE_PROJECT_REF`, `SUPABASE_PROJECT_REF`) or local mode (`LEGACY_DATABASE_URL`, `LEGACY_SUPABASE_URL`, `TARGET_DATABASE_URL`, `TARGET_SUPABASE_URL`, `TARGET_SERVICE_KEY`); refusal with a message naming the missing variables; refusal when source and target are the same. Verify unit tests for both modes, the missing-variable message and the same-project refusal

## 3. Transport

- [ ] 3.1 Implement the SQL executors:
  - Management API (`POST /v1/projects/<ref>/database/query`, bearer token, JSON rows, errors with status and message);
  - `psql` for local mode;
  - a read-only wrapper for the source that refuses anything but a single `select`;
  - dollar-quoted JSON literals with a random tag checked against the payload.

  Verify unit tests with a mocked `fetch` for the request shape and error handling, the read-only refusal, and quoting of payloads that contain `$` and quotes
- [ ] 3.2 Implement the Storage clients:
  - source download and `HEAD` by public URL;
  - target upload with `x-upsert: true` and the content type;
  - target secret-key lookup through `GET /v1/projects/<ref>/api-keys?reveal=true` in hosted mode.

  Verify unit tests with a mocked `fetch`, including the 4xx "missing file" case

## 4. Conversion (pure)

- [ ] 4.1 Accounts: prepare `auth.users` and `auth.identities` rows from the legacy JSON (generated columns dropped, token columns coalesced to `''`, keys unknown to v2 dropped and listed), map roles (`admin` kept, missing profile becomes `user` and is flagged), and detect email conflicts against v2 accounts. Verify unit tests for the Account Migration and "Accounts Already in the New System" scenarios
- [ ] 4.2 Steps: convert legacy nodes to v2 entries (data-only entries, unknown keys kept, notes exact) and measurements to the v2 record ("Untitled Analysis" for blank descriptions, skip without a valid spectrum). Verify unit tests for each rule, including a measurement graph's data being unchanged
- [ ] 4.3 Photos and guitar type: source path from `fileName` or URL; deterministic v2 names (legacy name kept when valid, otherwise timestamp, SHA-256 suffix and extension); guitar-type inference from the template's flags. Verify unit tests for the Build Variant Inference scenarios and for names being stable across runs
- [ ] 4.4 Builds: assemble the v2 row (trimmed name or "Untitled build", BOBO neck, share token only when shared, times kept), the photo copy list and the report notes (dropped dimensions, untyped, renamed, skipped with reason). Verify unit tests for the Build Migration and Stable Identifiers scenarios

## 5. Import run and report

- [ ] 5.1 Implement the source reads (users, identities, profiles, builds as `to_jsonb`, storage object names, and row counts of the not-yet-imported and Instagram tables guarded by `to_regclass`) and the target reads (column lists, existing accounts by email, existing build ids). Verify unit tests of the generated SQL against fixture responses
- [ ] 5.2 Implement the writes:
  - per-account transaction: auth user, identities, role;
  - per-build: photo copies, then a transaction with `set local gb.keep_updated_at = 'on'` and the build upsert;
  - the post-apply verification counts.

  Verify unit tests with fake ends: order of operations, nothing written in a dry run, skipped owners' builds never written
- [ ] 5.3 Implement the report (Markdown and JSON under `reports/legacy-import/`, terminal summary with counts only) and the CLI (`--apply`, printed project refs, exit codes). Verify a snapshot test of the Markdown for a fixture run and a test that the terminal output contains no email address

## 6. Rehearsal

- [ ] 6.1 Write `scripts/legacy-import/rehearse.sh` (design decision 8): v1 stack from `LEGACY_REPO_DIR` on separate ports with the `sequence_diagram` column, seeded through its GoTrue and Storage (an admin, a user without a profile, builds with nodes, photos with legacy-style names, measurements, a shared build, a leftover token, dimensions), then dry run, apply and second apply against the v2 stack, plus an email-conflict account. Verify the script passes:
  - sign-in to v2 with each first-version password;
  - roles;
  - build rows, step entries and photo objects;
  - unchanged counts after the second apply;
  - the conflict account and its builds skipped;
  - the v1 database unchanged
- [ ] 6.2 Open an imported build in the v2 app built against the local v2 stack: the step dialog shows the migrated notes, photos and measurement graph. Verify with a Playwright check in the rehearsal

## 7. Documentation

- [ ] 7.1 Add a "Moving data from the first version" section to the root `README.md`: what is imported, the secret and settings to add to the environment, the two project hosts to allow in the network settings, dry run then `--apply`, where the report goes and that it holds emails, and how to roll back. Verify each documented command runs as written in local mode

## 8. Integration check

- [ ] 8.1 Run `pnpm check`, `pnpm build`, the database tests (`supabase test db`, and `pnpm test:db` where pgTAP is installed), `pnpm test:e2e` and `openspec validate --strict`. Verify all pass

## 9. Run against the real projects

These need `SUPABASE_ACCESS_TOKEN`, `LEGACY_SUPABASE_PROJECT_REF` and `SUPABASE_PROJECT_REF` in the environment, and network access to both `<ref>.supabase.co` hosts, so they run in a new session.

- [ ] 9.1 Run the dry run against the real projects and review the report with the owner (counts, admins, conflicts, untyped builds, missing photos). Verify the report is produced and the v2 data is unchanged
- [ ] 9.2 Run with `--apply` once the owner approves. Verify the report's post-apply counts match, and that the owner signs in to v2 with their first-version email and password and sees their builds and photos

## Workflow follow-up

- The import needs the v2 project to have the `builds-and-sequence` migrations, so merge or deploy that change first.
- Archive with `/opsx:archive` after the real run; the rest of `legacy-data-migration` (FFT results, wood panels, references, conversations) follows in its own change.
