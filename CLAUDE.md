# Guitar Builder v2

A rewrite of Guitar Builder, a web app for luthiers: build tracking along a 132-step process, tap-tone and FFT acoustic analysis, a tonewood properties calculator, a body-response simulator, and an AI assistant grounded in a reference library. The behavior is specified in OpenSpec; the specs are the source of truth.

## Workflow: OpenSpec first

- Specs: `openspec/specs/<capability>/spec.md` (14 capabilities). Project context, stack and design tokens: `openspec/config.yaml`. Read the relevant spec in full before changing behavior.
- Every piece of work is an OpenSpec change in `openspec/changes/<name>/` (proposal, design, tasks, delta specs when behavior changes): `/opsx:propose` → `/opsx:apply` → `/opsx:archive`. Keep `openspec validate --strict` green.
- Background, decisions and the legacy audit: `docs/rewrite/README.md`. The legacy code is reference material only; never port it line by line or copy its access rules.

## Stack

pnpm monorepo: `apps/web` (Next.js App Router, React, TypeScript strict), `packages/ui` (design tokens and components), `packages/dsp` (pure-TypeScript signal processing, no DOM), `packages/db` (generated database types). Supabase (Postgres + RLS, Auth, Storage, Realtime) with migrations in `supabase/migrations`. Google Gemini for AI, server-side only. next-intl for English and French.

## Rules that matter

- **Security on the server.** Every access rule in the specs is a database policy or a server check, with a test. The UI hiding something is never the protection.
- **English and French.** No user-visible string is hard-coded; every message exists in `en` and `fr`.
- **Design tokens only.** Colors, type, spacing and radii come from `packages/ui` tokens (Oscilloscope direction, see `openspec/config.yaml`); no raw hex values in app code. Text meets WCAG AA in both themes.
- **Numbers are exact.** Formulas and constants come from the specs; test them against the specs' worked examples and `docs/reference-data/`.
- **Secrets stay server-side.** Only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (legacy name: `NEXT_PUBLIC_SUPABASE_ANON_KEY`) reach the browser.

## Commands

Run from the repo root:

- `pnpm install`
- `pnpm dev`: run the web app
- `pnpm check`: typecheck, lint and unit tests for every package (run before every commit)
- `pnpm test:db`: database policy tests (pgTAP)
- `pnpm test:e2e`: Playwright end-to-end tests
