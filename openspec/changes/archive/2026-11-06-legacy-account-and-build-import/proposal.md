# Proposal

## Why

The rewrite runs on a new Supabase project, so nobody can sign in to it with the email and password they use in the first version, and none of their builds or wood panels are there. `legacy-data-migration` already specifies the import: accounts keep their identifiers, roles and passwords, builds keep their step state, photos and share links, and wood panels are recomputed with the corrected formulas. It was planned last. Builds (`builds-and-sequence`) and wood panels (`wood-panel-calculator`) now exist in v2, so the owner asked to bring accounts, builds and wood panels across now, ahead of the rest.

## What Changes

- **An import command (`pnpm legacy:import`)** that reads the first-version project and writes into the v2 project. It runs a dry run (report only) by default and writes only with `--apply`. Running it again updates what it imported instead of duplicating it.
- **Accounts:**
  - Copies each first-version account's Auth records with the same identifier, email, password hash, confirmation state and creation date, so the same email and password sign in to v2.
  - Sets each account's role from its first-version profile; an account without a profile becomes a user.
  - A first-version account whose email already belongs to a different v2 account is not imported. Its builds and wood panels are skipped too, and all of them appear in the report.
- **Builds:**
  - Copies each build's identifier, owner, name, creation and update times, and sharing state. A share token is kept only when sharing was on.
  - Converts the first-version step document into v2 step entries: completion, notes, photos and measurements.
  - Infers the guitar type from the steps that have data, and gives every imported build a BOBO neck.
  - Drops model name, width and length, and lists the values that were dropped in the report.
- **Step photos:** copies every photo file that an imported build references into the v2 `step-photos` bucket, under the v2 naming rules, and points the step entries at the copies. A file that can't be fetched is skipped and reported, and files no build references are counted and left behind.
- **Wood panels and default panels:**
  - Copies each panel's identifier, owner, name, ten inputs and timestamps, and each default panel's identifier, name, inputs and creation time.
  - v2 recomputes density, E_L, E_C, G_LC, target thickness and estimated mass from the inputs. This corrects the legacy cross-grain formula.
  - Attaches each panel's stored spectra to the matching frequency.
  - Panels without an owner are skipped, as are panels whose owner was skipped and panels with an input that isn't positive. The unused build link on panels is dropped.
- **Spectra too large for v2:** a stored spectrum with more than 1024 points, on a step measurement or a panel, is reduced to at most 1024 points by keeping the loudest point of each run, so every peak keeps its frequency and level. Any other invalid spectrum is left out. Both are reported.
- **A migration report** in Markdown and JSON with:
  - imported and skipped counts per kind;
  - every skipped record with its reason;
  - accounts given a profile;
  - builds whose guitar type could not be inferred, and dropped dimensions;
  - wood panels whose E_C, target thickness or estimated mass changed, with old and new values;
  - spectra reduced or left out, and unknown panel spectrum keys;
  - counts of orphaned files and of Instagram rows not imported.
- **One migration change:** `set_updated_at()` leaves `updated_at` alone when the import's session setting asks it to, so imported builds and panels keep their first-version update time. Clients cannot set that setting, so for them it still moves on every change.
- **Not in this change:** saved build FFT results, the analysis prompt template, reference documents and conversations. Their v2 tables don't exist yet, and they come with the rest of `legacy-data-migration`. Because account and build identifiers are kept, those records will attach to the same owners and builds later.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `legacy-data-migration`:
  - adds "Accounts Already in the New System", which says what happens to a first-version account whose email belongs to a different v2 account (the spec does not say);
  - modifies "Step Measurement Migration" and "Wood Panel Spectrum Migration" for spectra that v2's record check refuses: those over 1024 points are reduced, and other invalid ones are left out.

  The other requirements this change implements are unchanged.

## Impact

- **New workspace package:** `packages/legacy-import`, with the command, pure conversion modules and their unit tests. It reads the step template from `apps/web/src/lib/sequence/template.ts` to infer guitar types.
- **Database:** a new migration redefining `public.set_updated_at()`, plus a pgTAP test.
- **Access:**
  - The command talks to both projects only over HTTPS: the Supabase Management API's SQL endpoint for database reads and writes, and each project's Storage API for photo files. Direct Postgres connections are blocked in the cloud environment.
  - One secret is needed, `SUPABASE_ACCESS_TOKEN`, a personal access token with access to both projects.
  - Two settings are needed, `LEGACY_SUPABASE_PROJECT_REF` and `SUPABASE_PROJECT_REF`.
  - The environment's network policy must allow both `<ref>.supabase.co` hosts.
- **Local runs** (tests, rehearsal) use direct Postgres URLs and local Storage instead, against two local Supabase stacks: a v1 stack started from the first-version repository's migrations, and the v2 stack.
- **Data:** writes to v2's `auth.users`, `auth.identities`, `public.profiles`, `public.builds`, `public.wood_panels`, `public.default_wood_panels` and the `step-photos` bucket. It never writes to the first-version project.
- **The report contains email addresses.** It is written to a git-ignored directory and never committed.
