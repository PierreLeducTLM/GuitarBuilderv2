# Guitar Builder

Build, measure and voice your instruments. Guitar Builder helps luthiers in five ways:
- follow a 132-step build process, with notes, photos and measurements for each step;
- capture tap tones and analyze them;
- compute tonewood properties and target plate thickness;
- simulate a guitar body's response;
- ask questions of an AI assistant grounded in a reference library.

This repository is a rewrite of [the original app](https://github.com/PierreLeducTLM/GuitarBuilder).

## Where things are

| Path | What it holds |
|---|---|
| `openspec/specs/` | The behavior of every capability, in [OpenSpec](https://github.com/Fission-AI/OpenSpec) format. This is the source of truth. |
| `apps/web/` | The Next.js app (App Router): shell, sign-in, builds and the build sequence; other sections are placeholders |
| `packages/ui/` | Oscilloscope design tokens (`src/tokens/themes.ts`), Tailwind theme and components |
| `packages/db/` | Database types for the Supabase schema |
| `packages/dsp/` | Signal processing shared by the acoustic features (pure TypeScript) |
| `supabase/` | Local Supabase config, migrations, pgTAP tests and email templates |
| `openspec/config.yaml` | Project context: stack, design direction and spec-writing rules |
| `openspec/changes/` | Work in progress, one folder per change |
| `docs/rewrite/` | Why the rewrite exists, the owner's decisions, and an audit of the legacy app |
| `docs/reference-data/` | Measured tonewood data used as test fixtures |

## Working on it

Changes follow the OpenSpec workflow: propose a change, implement it, then archive it into the specs. With Claude Code, use `/opsx:propose`, `/opsx:apply` and `/opsx:archive`. Engineering conventions are in [`CLAUDE.md`](CLAUDE.md).

## Getting started

Requirements: Node.js 22.18 or later and pnpm 10 (`corepack enable` picks the version pinned in `package.json`). A local Supabase stack additionally needs the [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started) and Docker.

```sh
pnpm install
supabase start                                  # local Postgres, Auth, API and Storage; prints the URL and keys
cp apps/web/.env.example apps/web/.env.local    # then paste the API URL and publishable key
pnpm dev                                        # http://localhost:3000
```

The app refuses to start without `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (the legacy name `NEXT_PUBLIC_SUPABASE_ANON_KEY` is also accepted for the key); they are the only configuration that reaches the browser. The first account to sign up on an empty database becomes the administrator.

## Commands

Run from the repository root.

| Command | What it does |
|---|---|
| `pnpm dev` | Runs the web app in development mode |
| `pnpm build` | Production build of the web app (needs the two public variables) |
| `pnpm check` | Typecheck, lint (Biome) and unit tests (Vitest) for every package; run before every commit |
| `pnpm format` | Applies Biome formatting and safe fixes |
| `pnpm test:db` | Database policy tests (pgTAP), see below |
| `pnpm test:e2e` | Playwright end-to-end tests, see below |
| `pnpm --filter @gb/ui tokens` | Regenerates `packages/ui/src/styles/tokens.css` after editing `themes.ts` |
| `pnpm --filter @gb/db gen-types` | Regenerates the database types from a running local stack |

### Database tests

The pgTAP files live in `supabase/tests/database`. In CI they run with `supabase db start` and `supabase test db`. Locally, `pnpm test:db` runs them without Docker: it starts a throwaway Postgres cluster, loads a small shim of the Supabase pieces the migrations use (`scripts/test-db/supabase-shim.sql`), applies the migrations, runs the files with `prove`, then two-session race tests for the first-admin rule and for "Load Default Panels" copying the reference panels once. The shim includes the Supabase `storage` tables, grants and delete protection that the step-photo rules apply to, copied from the Supabase image. It needs the Postgres 16 server binaries (`PG_BIN`, default `/usr/lib/postgresql/16/bin`), Perl's `prove`, and [pgTAP](https://pgtap.org) installed into that Postgres (`make && make install` from the [PGXN release](https://pgxn.org/dist/pgtap/)). With Docker and the Supabase CLI, `supabase db start` followed by `supabase test db` runs the same files against the real image, as CI does.

### End-to-end tests

`pnpm test:e2e` builds the app into `apps/web/.next-e2e` with test configuration, starts it with a small fake of the Supabase endpoints the app calls (`apps/web/e2e/fake-supabase.ts`: Auth, the builds, profiles and wood panel REST calls, the step-change, photo-path and default-panel functions, and Storage upload, remove and public read; it computes the wood panel results with `@gb/dsp`, as the database does), and runs the specs on a desktop and a phone viewport. `@playwright/test` is pinned to the version of the installed browsers; run `pnpm --filter @gb/web exec playwright install chromium` once on a new machine, or set `PW_CHROMIUM_EXECUTABLE` to a Chromium binary.

The tap-tone specs (`apps/web/e2e/tap-tone*.spec.ts`, and `wood-plate.spec.ts` for the wood calculator's plate measurement) use synthetic recordings in `apps/web/e2e/fixtures/`. Chromium plays `body.wav` or `silence.wav` as the microphone (`--use-file-for-fake-audio-capture`), and the other files are uploaded:
- `taps.wav`: three plate taps;
- `clipped.wav`: the same with tap 2 clipped;
- `mobile.wav`: the 134.8 Hz phone artifact.

The files are generated deterministically, so regenerating them gives identical bytes:

```bash
pnpm --filter @gb/web fixtures:tap-tone
```

## Mutation tests

`@gb/dsp` runs Stryker through its command runner (the Vitest plugin does not support Vitest 5 yet): `pnpm --filter @gb/dsp mutation`, or `pnpm --filter @gb/dsp exec stryker run --mutate "src/tapTone/peaks.ts"` for one file. The decay Q Monte Carlo check (T18) runs only with `DSP_NIGHTLY=1 pnpm --filter @gb/dsp test`.

## Step photos

Photos attached to build steps live in the public Storage bucket `step-photos`, created by the migration `supabase/migrations/20261102120000_builds_and_steps.sql`. Each file is stored as `<build id>/<step key>/<upload time>_<random>.<extension>`:
- anyone with a photo's URL can open it, so the public build story can show it;
- only the build's owner can upload, list or delete its files, and nobody can list the bucket anonymously;
- the bucket accepts images only.

The app sets no size limit of its own, but the project-wide upload limit in Supabase (Storage settings, 50 MB by default) still applies; a larger file fails like any other upload. Deleting a build removes its photo files first.

## Wood panels

"Wood Props" (`/wood-properties`) is the tonewood calculator: the ten sample and plate inputs, the results computed as you type (`woodProperties` in `@gb/dsp`), "Measure plate" with the tap-tone reader in Plate mode, the user's saved panels and a PDF report of the loaded panel. Panels live in `public.wood_panels` (migration `supabase/migrations/20261104130000_wood_panels.sql`). The database computes each panel's results snapshot itself, in generated columns, from the same formulas.

**Reference panels.** "Load Default Panels" copies the shared reference set (`public.default_wood_panels`) into an empty library, once. Until `admin-console` adds a curation screen, the set is filled in SQL, or by the legacy import (`legacy-data-migration`). In the Supabase SQL editor, which runs as the database owner, or with `psql` on the local stack:

```sql
insert into public.default_wood_panels
  (name, sample_length_mm, sample_width_mm, sample_thickness_mm, sample_mass_g,
   freq_longitudinal_hz, freq_cross_grain_hz, freq_diagonal_hz,
   plate_length_mm, plate_width_mm, stiffness_parameter)
values
  ('Sitka spruce', 605, 238, 4.0, 228, 61.6, 105.0, 38.2, 500, 380, 75);
```

An administrator's session may also insert, change and delete reference panels; other users can only read them. Users who already copied the set keep their copies.

**PDF fonts.** The report embeds subsets of static Space Grotesk Regular and Bold (words) and JetBrains Mono Regular and Bold (numbers and symbols, including "ρ", which Space Grotesk lacks). The TTF files are in `apps/web/public/fonts/pdf/`, fetched only when a report is generated. Both are under the SIL Open Font License 1.1 (`apps/web/public/fonts/pdf/OFL.txt`). Sources: [floriankarsten/space-grotesk](https://github.com/floriankarsten/space-grotesk) at `03507d0` (`fonts/ttf/static`) and [JetBrains/JetBrainsMono](https://github.com/JetBrains/JetBrainsMono) `v2.304` (`fonts/ttf`).

## Authentication settings

Sign-up, email verification and session lifetimes are Supabase Auth settings: `supabase/config.toml` for the local stack, and the dashboard (Authentication) for a hosted project. Production needs:

- **Site URL**: the app's public address, used in verification emails.
- **Redirect URLs**: `https://<your domain>/auth/confirm`.
- **Confirm email**: on to require verification before the first sign-in; off to sign new accounts in immediately.
- **Allow new users to sign up**: the operator switch for open sign-ups. Because the first account becomes administrator, consider keeping it off on a fresh deployment and creating the owner's account from the dashboard (Authentication → Add user); the database trigger makes that first account the administrator. Turn sign-ups on afterwards if wanted.
- **Minimum password length**: 6. **JWT expiry**: 3600 seconds. **Refresh token rotation**: on.
- **Confirm signup email template**: the content of `supabase/templates/confirmation.html`, whose link works on any device.

## Deployment

- **Web app:** a Vercel project imported from this repository with **Root Directory** `apps/web` and the environment variables `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` for Production and Preview (Supabase's Vercel integration creates both). Every pull request gets a preview deployment.
- **Database:** `.github/workflows/deploy-db.yml` applies new migrations to the hosted Supabase project when they reach `main`. It needs the repository secrets `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF` and `SUPABASE_DB_PASSWORD`, and skips itself until they are set. It can also be run by hand from the Actions tab.
- **Auth redirects:** in Supabase, Authentication → URL Configuration, set the Site URL to the production address and allow `http://localhost:3000/**` and the Vercel preview addresses.
