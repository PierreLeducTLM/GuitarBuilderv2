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
| `apps/web/` | The Next.js app (App Router): shell, sign-in, sections |
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
supabase start                                  # local Postgres, Auth and API; prints the URL and anon key
cp apps/web/.env.example apps/web/.env.local    # then paste the API URL and anon key
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

The pgTAP files live in `supabase/tests/database`. In CI they run with `supabase db start` and `supabase test db`. Locally, `pnpm test:db` runs them without Docker: it starts a throwaway Postgres cluster, loads a small shim of the Supabase pieces the migrations use (`scripts/test-db/supabase-shim.sql`), applies the migrations, runs the files with `prove`, then a two-session race test for the first-admin rule. It needs the Postgres 16 server binaries (`PG_BIN`, default `/usr/lib/postgresql/16/bin`), Perl's `prove`, and [pgTAP](https://pgtap.org) installed into that Postgres (`make && make install` from the [PGXN release](https://pgxn.org/dist/pgtap/)).

### End-to-end tests

`pnpm test:e2e` builds the app into `apps/web/.next-e2e` with test configuration, starts it with a small fake of the Supabase Auth and REST endpoints (`apps/web/e2e/fake-supabase.ts`), and runs the specs on a desktop and a phone viewport. `@playwright/test` is pinned to the version of the installed browsers; run `pnpm --filter @gb/web exec playwright install chromium` once on a new machine, or set `PW_CHROMIUM_EXECUTABLE` to a Chromium binary.

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
