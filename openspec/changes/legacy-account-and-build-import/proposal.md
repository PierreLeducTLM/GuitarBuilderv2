# Proposal

## Why

The rewrite runs on a new Supabase project, so nobody can sign in to it with the email and password they use in the first version, and none of their builds are there. `legacy-data-migration` already specifies the import: accounts keep their identifiers, roles and passwords, and builds keep their step state, photos and share links. It was planned last. Builds now exist in v2 (`builds-and-sequence`), so the owner asked to bring accounts and builds across now, ahead of the rest.

## What Changes

- **An import command (`pnpm legacy:import`)** that reads the first-version project and writes into the v2 project. It runs a dry run (report only) by default and writes only with `--apply`. Running it again updates what it imported instead of duplicating it.
- **Accounts:**
  - Copies each first-version account's Auth records with the same identifier, email, password hash, confirmation state and creation date, so the same email and password sign in to v2.
  - Sets each account's role from its first-version profile; an account without a profile becomes a user.
  - A first-version account whose email already belongs to a different v2 account is not imported. Its builds are skipped too, and both appear in the report.
- **Builds:**
  - Copies each build's identifier, owner, name, creation and update times, and sharing state. A share token is kept only when sharing was on.
  - Converts the first-version step document into v2 step entries: completion, notes, photos and measurements.
  - Infers the guitar type from the steps that have data, and gives every imported build a BOBO neck.
  - Drops model name, width and length, and lists the values that were dropped in the report.
- **Step photos:** copies every photo file that an imported build references into the v2 `step-photos` bucket, under the v2 naming rules, and points the step entries at the copies. A file that can't be fetched is skipped and reported, and files no build references are counted and left behind.
- **A migration report** in Markdown and JSON with:
  - imported and skipped counts per kind;
  - every skipped record with its reason;
  - accounts given a profile;
  - builds whose guitar type could not be inferred, and dropped dimensions;
  - counts of orphaned files and of Instagram rows not imported.
- **One migration change:** `set_updated_at()` leaves `updated_at` alone when the import's session setting asks it to, so imported builds keep their first-version update time. Clients cannot set that setting, so for them it still moves on every change.
- **Not in this change:** saved build FFT results, wood panels, default panels, the analysis prompt template, reference documents and conversations. Their v2 tables don't exist yet, and they come with the rest of `legacy-data-migration`. Because account and build identifiers are kept, those records will attach to the same owners and builds later.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `legacy-data-migration`: adds "Accounts Already in the New System", which says what happens to a first-version account whose email belongs to a different v2 account (the spec does not say). The other requirements this change implements are unchanged.

## Impact

- **New workspace package:** `packages/legacy-import`, with the command, pure conversion modules and their unit tests. It reads the step template from `apps/web/src/lib/sequence/template.ts` to infer guitar types.
- **Database:** a new migration redefining `public.set_updated_at()`, plus a pgTAP test.
- **Access:**
  - The command talks to both projects only over HTTPS: the Supabase Management API's SQL endpoint for database reads and writes, and each project's Storage API for photo files. Direct Postgres connections are blocked in the cloud environment.
  - One secret is needed, `SUPABASE_ACCESS_TOKEN`, a personal access token with access to both projects.
  - Two settings are needed, `LEGACY_SUPABASE_PROJECT_REF` and `SUPABASE_PROJECT_REF`.
  - The environment's network policy must allow both `<ref>.supabase.co` hosts.
- **Local runs** (tests, rehearsal) use direct Postgres URLs and local Storage instead, against two local Supabase stacks: a v1 stack started from the first-version repository's migrations, and the v2 stack.
- **Data:** writes to v2's `auth.users`, `auth.identities`, `public.profiles`, `public.builds` and the `step-photos` bucket. It never writes to the first-version project.
- **The report contains email addresses.** It is written to a git-ignored directory and never committed.
