# Proposal

## Why

The rewrite has specs but no code. Every later capability (builds, tap-tone capture, wood panels, the assistant) needs the same frame first: a repository layout and toolchain, the Oscilloscope design system, a signed-in application shell, English/French text, and accounts whose roles are enforced by the database. `user-auth` and `app-shell` are first in the recommended order (`docs/rewrite/README.md`), so this change builds them, together with the scaffolding every other change will reuse.

## What Changes

- Create the pnpm monorepo: `apps/web` (Next.js 16 App Router, React 19, TypeScript strict), `packages/ui` (design tokens and components), `packages/db` (database types), `packages/dsp` (empty placeholder). Biome for lint and format, Vitest for unit tests, Playwright for end-to-end tests, root scripts `dev`, `build`, `check`, `test:db`, `test:e2e`, and a GitHub Actions workflow running them.
- Build the Oscilloscope design system in `packages/ui`: dark tokens from the chosen concept, a light counterpart with the same roles, Tailwind CSS v4 wired to the tokens, self-hosted Space Grotesk and JetBrains Mono, and the first accessible components (buttons, icon button, text field, panel, chip, segmented control, LED progress, confirmation dialog, text-input dialog, toasts). A test asserts every documented text/background pair meets WCAG AA (4.5:1).
- Implement every requirement of `app-shell`: route list and redirects, admin-only sections hidden and blocked on the server once the role is known, desktop header and user menu, mobile slide-out menu and bottom tab bar, Light/System/Dark theme applied before first paint on every screen, EN/FR switching, loading screen, sign-out, the public `/story/<token>` route (placeholder page), confirmation dialog, text-input dialog and toasts. Section pages are placeholders showing the translated section name.
- Implement every requirement of `user-auth` that this change can own: Supabase email/password sign-up, sign-in, sign-out and session restore with `@supabase/ssr`; every validation rule and message; the verification-email and auto-confirm paths; the requested URL kept through sign-in; refusal to start without the public Supabase configuration.
- Add the first database migration: `profiles` created only by a server trigger (first account becomes admin, race-safe), email kept in sync, row-level security (own profile; admins read all; no client writes), `is_admin()`, and the administrator role-change and list-users operations of `admin-console`. pgTAP tests cover every rule and run locally (`pnpm test:db`) and in CI (`supabase test db`).

This change implements existing specs without changing their behavior, so it declares `skip_specs: true` and has no delta specs. Interpretations of the specs made while implementing (for example how auth-service messages are localized) are recorded in `design.md`; none changes a requirement.

## Capabilities

### New Capabilities

None. The behavior is already specified.

### Modified Capabilities

None. `app-shell` and `user-auth` are implemented as written; the role model's server operations come from `admin-console` unchanged.

## Impact

- New code: everything under `apps/`, `packages/`, `supabase/`, `scripts/` and `.github/`.
- New dependencies (exact versions): Next.js, React, next-intl, `@supabase/ssr`, `@supabase/supabase-js`, Tailwind CSS v4, Radix primitives, lucide-react, Fontsource fonts, Biome, Vitest, Playwright, TypeScript.
- Configuration: the browser receives only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (legacy name `NEXT_PUBLIC_SUPABASE_ANON_KEY`); `.env.example` documents them. Sign-up, email verification and the site URL are Supabase Auth settings (`supabase/config.toml` locally, the dashboard in production).
- Out of scope, left to the owning capabilities: admin console screens and user deletion (`admin-console`), every section's real content, and the story page's content and access rules (`build-story-sharing`).
