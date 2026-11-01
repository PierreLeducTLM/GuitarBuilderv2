# Design

## Context

The repository holds only the specs (see proposal.md - Why). The stack, the design direction and the tokens are fixed in `openspec/config.yaml`. The legacy audit (`docs/rewrite/legacy-findings/app-shell-auth-admin.md`) lists the defects this design must not repeat: a client-writable profile table that allowed self-promotion, an unlocked first-admin check, admin deep links redirected before the role loaded, a theme that only applied inside the shell, and preferences unreachable on mobile.

Versions were checked against the installed packages on 2026-11-01, not recalled: Next.js 16.4 renamed `middleware.ts` to `proxy.ts` (Node.js runtime by default), made request APIs (`cookies()`, `params`, `searchParams`) asynchronous, builds with Turbopack by default and ships its docs in `node_modules/next/dist/docs`. next-intl 4 finds `src/i18n/request.ts` by default. `@supabase/ssr` 0.12 takes `getAll`/`setAll(cookies, headers)` cookie adapters and passes no-cache headers to `setAll`. `getClaims()` verifies asymmetric JWTs locally and falls back to `getUser()` for symmetric ones.

## Goals / Non-Goals

**Goals:**
- A monorepo whose `check`, `build`, `test:db` and `test:e2e` scripts pass locally and in CI.
- Every access rule of this change enforced in Postgres and covered by a pgTAP test.
- Every `app-shell` requirement and the client-facing `user-auth` requirements met, in English and French, in both themes.

**Non-Goals:**
- No section features: Builds, Chat, Simulator, Wood Props, References and Admin pages show their translated name only.
- No user deletion operation: its cascade covers tables that do not exist yet; it lands with `admin-console`.
- No Motion animations yet; CSS transitions are enough for the shell. Motion arrives with the first feature that needs physics or layout animation.

## Decisions

### 1. Workspace and toolchain

- pnpm 10.28 workspaces with `apps/*` and `packages/*`. Packages are named `@gb/web`, `@gb/ui`, `@gb/db`, `@gb/dsp`. Internal packages are consumed as TypeScript source (`transpilePackages` in Next.js, no build step), which keeps one source of truth and instant feedback. Alternative considered: building each package with tsup; rejected as extra moving parts while every consumer is in this repo.
- Every dependency is pinned to an exact version (`save-exact` in `.npmrc`).
- TypeScript 6.0.3, not 7.0. Next.js 16.4 can type-check with TypeScript 7's native `tsc`, but TypeScript 7 has no JavaScript API yet, which Next.js's editor plugin and other tooling still use. Revisit when it has one.
- Biome 2.6 replaces ESLint and Prettier (Next.js 16 removed `next lint`). Its CSS parser is set to accept Tailwind directives.
- Node.js 22 LTS (`>=22.18`, where TypeScript type stripping is on by default, so repository scripts can be `.ts` files run by `node`).
- Root scripts: `check` = `typecheck` (every package's `tsc --noEmit`, after `next typegen` for the app) + `lint` (`biome check`) + `test` (every package's `vitest run`).

### 2. Design tokens and Tailwind

- The token values live in TypeScript (`packages/ui/src/tokens/themes.ts`): one object per theme with identical role names. A generator writes `packages/ui/src/styles/tokens.css` (`--gb-*` custom properties under `:root[data-theme=dark]` and `:root[data-theme=light]`, plus a `prefers-color-scheme` fallback when no attribute is set). A unit test fails if the committed CSS differs from the generator's output, and another computes the WCAG contrast of every documented text/background pair in both themes and requires at least 4.5:1. Alternative considered: hand-written CSS parsed by the test; rejected because the TypeScript object is easier to test and to reuse in canvas drawing later.
- Dark values are the concept's (Night `#0A0D10`, Panel `#12171C`, hairline `#26313B`, Readout `#E6EBEF`, Dim `#A3AEB9`, Phosphor amber `#FFB23E` with dark text on it, Signal teal `#4CD4C0`). The light theme keeps the same roles: paper ground `#F3F5F7`, white panels, ink `#0D1318`, and darker "ink" variants of each signal colour for text (amber `#8A4F00`, teal `#06705F`); filled amber and teal buttons keep their dark text. Admin entries get their own accent (a third scope channel: violet `#C9A2FF` dark, `#7A3DB8` light). The lowest computed pair is 4.74:1.
- Tailwind CSS v4: `packages/ui/src/styles/theme.css` maps the tokens with `@theme inline` and clears Tailwind's default palette (`--color-*: initial`), so a raw palette class such as `bg-red-500` cannot be used by mistake. The same file declares `@source` for the UI package, so consumers only import one stylesheet.
- Fonts: `@fontsource-variable/space-grotesk` and `@fontsource-variable/jetbrains-mono`, bundled from npm at build time (no request to Google Fonts). Numbers use the mono family through a `font-mono` / `tabular-nums` convention.

### 3. Components

- Dialogs (confirmation, text input, the mobile slide-out menu) use Radix Dialog: focus trap, Escape, `aria-modal` and scroll lock come for free. The desktop user menu uses Radix Dropdown Menu, which gives the specified outside-click dismissal. Toasts are a small custom provider instead of Radix Toast, because the spec fixes their timing (3 s default, about 300 ms fade, stacking, close button) and Radix Toast's swipe and viewport model add behavior the spec does not ask for.
- `packages/ui` has no i18n dependency: every user-visible string (labels, `aria-label`s, default button labels) is a prop, and the app passes translated text. `IconButton` makes its accessible label a required prop. Every interactive element is a real `<button>`/`<a>`, has a visible focus ring from the `--gb-focus` token and a minimum 44 × 44 px target.
- Icons: lucide-react (tree-shaken, consistent stroke). The trace logo mark is a custom SVG from the concept.

### 4. Routing and the access gate

| Path | Without session | With session |
|---|---|---|
| `/story/<token>` | story page, no shell | story page, no shell |
| `/sign-in` | sign-in screen | redirect to `next` (or `/builds`) |
| `/auth/confirm` | verification-link handler | same |
| `/builds`, `/builds/<id>`, `/chat`, `/simulator`, `/wood-properties` | redirect to `/sign-in?next=<requested path and query>` | section |
| `/references`, `/admin` | same as above | section if admin, else redirect to `/builds` |
| `/` and every other path | same as above | redirect to `/builds` |

- `proxy.ts` refreshes the Supabase session on every matched request (`getClaims()`, cookies copied onto any redirect response) and applies the table's session column. Redirects issued on a full page load are HTTP 307s, so the browser never stores the unknown URL in history; server-side `redirect()` during client navigation uses `replace`. Every proxy redirect is sent with `Cache-Control: no-store`: its target depends on the session, and without it Chrome replays a stale signed-out redirect on Back and loops between `/sign-in` and the section (found by the end-to-end tests).
- The `next` parameter is accepted only if it is a same-origin path (starts with a single `/`, no `//`, no backslash, no scheme); otherwise it becomes `/builds`. This prevents an open redirect and is unit-tested.
- The admin rule cannot live in the proxy without a database query per request, so it lives in the server layout of the admin route group: it loads the profile, then redirects non-admins. This is also what makes admin deep links wait for the role: the redirect decision is made on the server after the role is read, never on the client before it arrives. Hiding entries remains a convenience; the database refuses admin operations to non-admins (decision 7).
- Session restore loading state: `app/loading.tsx` is the Suspense fallback above the shell layout, so the full-screen "Loading..." is streamed first while the server reads the session and profile, and neither the sign-in form nor the shell appears until that is known.
- After sign-in, sign-up with auto-confirm, or sign-out, the client calls `router.replace()` then `router.refresh()`, so the server re-renders with the new session and no profile or role survives on the client. A client listener for `SIGNED_OUT` (another tab, expired refresh token) does the same.

### 5. Authentication

- Browser and server clients come from `@supabase/ssr`; the session lives in cookies so the server can render the shell. Access tokens last 1 hour and refresh tokens rotate (Supabase Auth settings in `supabase/config.toml`).
- Validation (`validateAuthForm`) is a pure function run before any request, in this order: empty email or password → "Please fill in all fields"; malformed email → the email field is flagged; password shorter than 6 → "Password must be at least 6 characters"; in sign-up mode, a different confirmation → "Passwords do not match". The form uses `noValidate` so these messages, not the browser's, are shown in both languages.
- Sign-up: if Supabase returns a session (verification disabled), the user goes straight to the requested URL; otherwise the success message is shown and the three fields are cleared. The verification link targets `/auth/confirm`, which accepts both a `token_hash` (custom email template in `supabase/templates/`, works across devices) and a PKCE `code` (default template, same browser), then redirects to `next`.
- Messages from the authentication service: known error codes (`invalid_credentials`, `email_not_confirmed`, `user_already_exists`, `weak_password`, `signup_disabled`, `email_address_invalid`, rate limits) are shown as translated messages whose English text matches the service's. Unknown codes show the service's own text; network failures and errors without a message show "An unexpected error occurred". This is an interpretation of "show the reason reported by the authentication service" that also satisfies the rule that every message exists in English and French.
- Sign-out ends the server session first (the logout endpoint, scope `local`, i.e. this browser) and clears the local session only once that succeeded. supabase-js 2.118's `signOut()` clears the local session even when the server refuses, which would contradict "Failed to sign out … the user remains signed in". A session the server no longer knows (401/403/404) counts as ended.
- Configuration: `src/lib/env.ts` validates `NEXT_PUBLIC_SUPABASE_URL` (a URL) and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (non-empty). `next.config.ts` calls it, so `next dev`, `next build` and `next start` stop with a message naming the missing variables and pointing to `.env.example`; `next typegen` (part of `pnpm check`) is exempt because it never contacts Supabase. No other variable reaches the browser.

### 6. Theme and language

- Theme preference is stored in `localStorage` (`gb-theme`: `light`, `system` or `dark`; missing means System). An inline script in the root layout's `<head>` resolves it (System uses `matchMedia('(prefers-color-scheme: dark)')`) and sets `data-theme` and `color-scheme` on `<html>` before first paint. Because it is in the root layout, it covers the loading screen, the sign-in screen and the story page. A client `ThemeProvider` applies changes immediately and, while System is selected, listens to the media query so live OS changes are followed. The resolution logic is one pure function shared by the script and the provider and unit-tested. Alternative considered: a cookie read on the server; rejected because the server cannot know the OS preference behind System and reading cookies in the root layout makes every page dynamic.
- Language uses next-intl without locale-prefixed URLs (the URLs are fixed by `app-shell`). The choice is stored in a `gb-locale` cookie (one year). `src/i18n/request.ts` reads it, defaults to English, and loads the catalog with a dynamic import; French messages are deep-merged over English so a missing French string shows English. Switching writes the cookie and calls `router.refresh()`, which re-renders with the new language without reloading the page. Message keys are typed from `messages/en.json`, and a unit test requires `fr.json` to have exactly the same keys.
- Dates and numbers use next-intl's formatter with shared named formats. The user's time zone is stored in a `gb-tz` cookie on first visit and used by the request config (UTC until then), so dates do not depend on the server's zone.

### 7. Database

- `public.profiles(id uuid primary key references auth.users on delete cascade, email text, role text not null default 'user' check (role in ('user','admin')), created_at, updated_at)`. A text column with a check constraint rather than an enum, so the role-change operation can return the specified "Invalid role" message instead of a cast error.
- Profiles are created only by `public.handle_new_user()`, an `AFTER INSERT` trigger on `auth.users`, `SECURITY DEFINER` with `SET search_path = ''`. It takes `pg_advisory_xact_lock` on a fixed key, so concurrent sign-ups are serialized; under read committed each statement takes a new snapshot, so the second sign-up sees the first profile and gets the role user. The insert sits in an exception block that logs a warning, so a failed profile never blocks account creation (spec: Automatic Profile Creation); such an account reads as role user everywhere, because nothing else can create a profile. A second trigger copies `email` changes from `auth.users`.
- Row-level security is enabled. Policies (`to authenticated`): select own row; select all when `public.is_admin()`. There are no insert, update or delete policies, and the table privileges for `anon`, `authenticated` and `service_role` are reduced to `select` (authenticated, service role) or nothing (anon), so a missing policy and a missing grant both block writes.
- `public.is_admin()`: `SECURITY DEFINER`, `STABLE`, fixed `search_path`; reads the caller's own profile (the definer bypasses RLS, so there is no policy recursion).
- `public.admin_set_role(target_user_id uuid, new_role text)` and `public.admin_list_users()` implement the admin-console operations with its exact messages ("Access denied. Admin privileges required.", 'Invalid role. Must be "user" or "admin".', "Cannot change your own role."). The admin check runs first, so non-admins learn nothing about targets or values. `EXECUTE` is revoked from `public` and `anon` and granted to `authenticated` (Supabase's default privileges would otherwise grant `anon`).
- Types in `packages/db` are hand-written in the `supabase gen types` shape until the CLI can run; `pnpm --filter @gb/db gen-types` regenerates them from a running local stack.

### 8. Database tests

- pgTAP files live in `supabase/tests/database/*.test.sql`, the layout `supabase test db` expects. Each runs in a transaction that is rolled back, creates its users by inserting into `auth.users` (which exercises the trigger), and impersonates users by setting `role` and `request.jwt.claims` through small helpers created inside that transaction.
- Locally (`pnpm test:db`, no Docker): `scripts/test-db/run.sh` starts a throwaway Postgres 16 cluster in a temporary directory (as the `postgres` OS user when run as root), loads `scripts/test-db/supabase-shim.sql` (the `auth` schema with a minimal `auth.users`, `auth.uid()`, `auth.jwt()` and `auth.role()` reading `request.jwt.claims`, the `anon`/`authenticated`/`service_role` roles, the `extensions` schema, and Supabase's default privileges, so missing revokes are caught), applies the migrations in order, installs pgTAP and runs the files with Perl's `prove`. It requires pgTAP in the local Postgres and fails with install instructions otherwise.
- The first-admin race cannot be shown inside one transaction, so `scripts/test-db/first-admin-race.sh` opens two sessions that sign up at the same time against a committed database and asserts exactly one admin. It runs after the pgTAP files locally, and in CI against the Supabase stack.
- CI: `supabase db start`, `supabase test db`, then the race script through `psql`.

### 9. End-to-end tests

- Playwright 1.63.0, the version of the browsers preinstalled here; the Chromium path can be overridden with `PW_CHROMIUM_EXECUTABLE` (defaulting to `/opt/pw-browsers/chromium` when that exists). CI installs its own browsers.
- `pnpm test:e2e` builds the app into a separate directory (`.next-e2e`) with test configuration, starts it, and runs the tests, so it never depends on a developer's `.env` or on a previous `pnpm build`.
- Signed-out smoke tests need no backend. The shell flows (sign-in, navigation, admin redirects, mobile menu, sign-out) run against `e2e/fake-supabase.ts`, a small HTTP server that mimics the Auth and REST endpoints the app calls. It is a test double: the database rules are covered by pgTAP, not by these tests.

## Risks / Trade-offs

- [The fake Supabase can drift from the real Auth API] → It covers only the five endpoints the app calls and is used only for shell navigation tests; the real API is exercised by the database tests and should get a CI end-to-end job against `supabase start` once the first feature needs it.
- [The CI database job could not be run here (no Docker)] → The same SQL files pass under the local shim, which reproduces Supabase's roles and default privileges; the CI job is the first real run against the Supabase image.
- [GitHub Actions are referenced by major version tags] → Pin them to commit SHAs once the repository is pushed and the SHAs can be looked up.
- [Hand-written database types can drift] → Regenerate with `gen-types` as soon as a local stack is available; a later change can add a CI check that the committed types match.
- [Auth messages for unknown error codes stay in the service's language (English)] → Known codes are translated; new codes can be added to the map as they appear.
- [The light theme is designed here, not by the owner] → Values are in one file and the contrast test guards any change.

## Migration Plan

Nothing to migrate: this is the first code. Deploying needs a Supabase project with the migration applied, the two public variables set in Vercel, and the site URL and redirect URL (`/auth/confirm`) configured in Supabase Auth. Rollback is redeploying the previous build; the migration only adds objects.

## Open Questions

- Should sign-ups be open on a fresh production deployment, given that the first account becomes administrator? The spec allows either (operator setting); the legacy audit recommends deploying with sign-ups disabled until the owner has signed up.
