# Tasks

## 1. Workspace and toolchain

- [ ] 1.1 Create the pnpm workspace (root `package.json` with `packageManager`, `pnpm-workspace.yaml`, `.npmrc` with exact saves, `.nvmrc`, `tsconfig.base.json`) and the four packages `apps/web`, `packages/ui`, `packages/db`, `packages/dsp`; verify `pnpm install` succeeds and `pnpm -r exec pwd` lists all four
- [ ] 1.2 Configure Biome 2 (formatter, recommended linter with accessibility rules, Tailwind directives in CSS, generated files ignored); verify `pnpm lint` passes
- [ ] 1.3 Add the root scripts `dev`, `build`, `check`, `typecheck`, `lint`, `test`, `test:db`, `test:e2e`, and Vitest in every package (`packages/dsp` with its placeholder test); verify `pnpm check` passes on the skeleton

## 2. Design system (`packages/ui`)

- [ ] 2.1 Define the dark and light themes in `src/tokens/themes.ts` with the documented text/background pairs, generate `src/styles/tokens.css`, and add tests that the CSS is up to date and that every pair is at least 4.5:1 in both themes; verify `pnpm --filter @gb/ui test` passes
- [ ] 2.2 Wire Tailwind v4 (`src/styles/theme.css` with `@theme inline`, default palette cleared, radii, fonts, `@source`) and self-hosted Space Grotesk and JetBrains Mono from Fontsource; verify the built app's CSS contains the token utilities and serves the font files from its own origin
- [ ] 2.3 Build Button (primary, secondary, ghost, danger), IconButton (required label), Field/TextInput (label, hint, error, `aria-describedby`, `aria-invalid`), Panel, Chip, SegmentedControl (radio-group keyboard behavior) and LedProgress (`progressbar` semantics), all with focus rings and 44 px targets; verify with component tests for the label, keyboard and ARIA behavior
- [ ] 2.4 Build ConfirmDialog (title, message, × close, cancel, confirm, backdrop dismissal, danger/warning/info emphasis), TextInputDialog (prefilled, focused and selected, trimmed result, Enter confirms, confirm disabled while blank, above other dialogs) and the Toast provider (success/error/warning/info icons and accents, stacking, non-blocking, 3 s default, about 300 ms fade, × close); verify with component tests for confirm/cancel/backdrop, trimming and blank input, and toast timing

## 3. Database

- [ ] 3.1 Write `supabase/config.toml` (Auth: 1-hour access tokens, refresh-token rotation, sign-up and email-verification switches, site URL, `/auth/confirm` redirect URLs, minimum password length 6, confirmation template) and the confirmation email template; verify the file parses as TOML
- [ ] 3.2 Write the `profiles` migration: table, sign-up trigger with advisory lock and fixed search path, email-sync trigger, RLS policies, reduced grants, `is_admin()`, `admin_set_role()` and `admin_list_users()` with revoked `public`/`anon` execute; verify it applies cleanly to the local shim database
- [ ] 3.3 Build the local runner (`scripts/test-db/run.sh`, `supabase-shim.sql`): throwaway Postgres 16 cluster, Supabase auth shim and default privileges, migrations, pgTAP, `prove`; verify `pnpm test:db` starts and stops the cluster and reports results
- [ ] 3.4 Write pgTAP tests for schema, privileges and function settings; profile creation (first user admin, later users user, email copied and synced, profile removed with the account); visibility (own row only, admin reads all, anonymous gets nothing, user without profile is not admin); role changes (no self-promotion through update, insert, upsert or the RPC; admin cannot update rows directly; RPC messages for non-admin, invalid role and own role; promotion and demotion set `updated_at`); verify `pnpm test:db` passes
- [ ] 3.5 Write the first-admin race test (two concurrent sign-ups, exactly one admin) and run it from `pnpm test:db`; verify it passes, and fails when the advisory lock is removed
- [ ] 3.6 Hand-write `packages/db` types for `profiles` and the three functions in the `supabase gen types` shape, with a `gen-types` script for a running local stack; verify the app type-checks against them

## 4. App foundation (`apps/web`)

- [ ] 4.1 Create the Next.js 16 app (App Router, strict TypeScript, typed routes, `transpilePackages` for the workspace packages, PostCSS with Tailwind, global stylesheet importing `@gb/ui`); verify `pnpm build` succeeds
- [ ] 4.2 Validate `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` from `next.config.ts` and add `.env.example`; verify a unit test of the validator and that `pnpm build` without the variables stops with a message naming them
- [ ] 4.3 Add the Supabase browser, server and proxy clients typed with `@gb/db`; verify they type-check
- [ ] 4.4 Set up next-intl without URL prefixes: `gb-locale` cookie, English default, French merged over English, typed message keys, shared date and number formats, `gb-tz` time-zone cookie; verify unit tests for locale resolution, fallback merging, catalog key parity and per-locale formatting
- [ ] 4.5 Implement theme resolution (shared pure function), the pre-paint head script in the root layout and the client ThemeProvider with the live `prefers-color-scheme` listener; verify unit tests for resolution and parsing of stored values

## 5. Authentication

- [ ] 5.1 Implement `validateAuthForm` and the auth-error mapper (known codes translated, unknown codes raw, network errors unexpected); verify unit tests for every rule and message in `user-auth`
- [ ] 5.2 Build the sign-in screen (title, subtitle per mode, fields, Minimum 6 characters hint in sign-up mode, mode-switch link clearing messages, pending state "Please wait...", note, theme and language controls) wired to Supabase sign-in and sign-up (session vs. verification-email paths); verify the e2e validation tests in 7.2
- [ ] 5.3 Add `/auth/confirm` (token hash or PKCE code, then redirect to a safe `next`, or back to sign-in with an error message); verify by type-check and a unit test of the safe-redirect helper

## 6. Application shell

- [ ] 6.1 Implement `proxy.ts`: session refresh, public story route, sign-in redirect with a safe `next`, `/` and unknown paths to `/builds`; verify unit tests for path classification and `next` sanitizing
- [ ] 6.2 Add the shell layout (server: user and profile, missing profile treated as user) and the admin route-group layout redirecting non-admins only after the role is read; verify e2e tests for admin and non-admin deep links
- [ ] 6.3 Build the desktop header (sticky; title and subtitle linking to `/builds`; section bar with icons and active-prefix highlight; admin entries in the admin accent; EN/FR switcher; theme selector with "Light Mode"/"System Theme"/"Dark Mode" tooltips; user button with "Signed in as" and a Sign Out dropdown dismissed by outside clicks); verify e2e on a 1280 px viewport
- [ ] 6.4 Build the mobile slide-out menu (from the right, close button, email, sections, preferences, Sign Out, dimmed non-scrolling backdrop) and the bottom tab bar with content padding; verify e2e on a phone viewport
- [ ] 6.5 Implement sign-out from both menus ("Failed to sign out" toast and staying in the shell on failure) and the client `SIGNED_OUT` listener; verify e2e for successful sign-out and sign-out failure
- [ ] 6.6 Add the full-screen loading screen, the placeholder section pages (translated names, build id on `/builds/<id>`), the browser title "Guitar Build Tracking App", and the shell-less `/story/<token>` placeholder; verify e2e for the story route signed out and signed in
- [ ] 6.7 Provide app-level confirm, text-input and toast hooks with localized default labels ("Confirm"/"Cancel", "Save"/"Cancel"); verify a component test of the default labels in French

## 7. End-to-end tests

- [ ] 7.1 Configure Playwright (pinned to the preinstalled browsers' version, `PW_CHROMIUM_EXECUTABLE` override, dedicated `.next-e2e` build, desktop and phone projects) and the fake Supabase server; verify `pnpm test:e2e` runs
- [ ] 7.2 Write the signed-out smoke tests: sign-in validation messages in English and French, theme persistence across reloads (including on the sign-in screen), language switch without reload and persisted, unauthenticated redirect preserving the URL, public story route; verify `pnpm test:e2e` passes
- [ ] 7.3 Write the signed-in shell tests against the fake server (sign-in to the requested URL, navigation and active entry, admin entries and deep links, unknown-route redirect without a history entry, mobile menu and tab bar, sign-out); verify `pnpm test:e2e` passes

## 8. CI and documentation

- [ ] 8.1 Add `.github/workflows/ci.yml`: install, `check`, `build`, e2e (Playwright browsers installed in CI), and a database job with the Supabase CLI (`supabase db start`, `supabase test db`, race script); verify the YAML parses and every command it runs exists in the repository
- [ ] 8.2 Document setup and commands in the root `README.md` (environment variables, local Supabase, test commands, Auth settings for production); verify each documented command runs as written

## 9. Integration check

- [ ] 9.1 Run `pnpm check`, `pnpm build`, `pnpm test:db`, `pnpm test:e2e` and `openspec validate --strict` from a clean install; verify all pass

## Workflow follow-up

- Review the light theme, the auth-message localization and the open question on production sign-ups with the owner.
- Archive the change with `/opsx:archive` once reviewed.
