# Proposal

## Why

Sign-in gets in the way while the app is being built and tried at the bench on several devices. The login screen is set aside for now and will come back later. Builds, wood panels and every other record still belong to an account and are protected by the database, so the app needs an account to run as.

## What Changes

- The operator can configure one shared account (email and password, server-side only).
- With a shared account configured, a visitor without a session is signed in to it on the server and never sees the sign-in screen. `/sign-in` sends the visitor to `/builds`. Sign Out is not offered.
- Every device using the app sees the same builds and panels: those of the shared account. Its role (user or admin) decides whether the admin sections show.
- Without a shared account configured, nothing changes: the sign-in screen gates the app as before. Bringing the login screen back means removing the two settings.
- Database rules do not change.

## Capabilities

### Modified Capabilities

- `app-shell`: Authenticated Access Gate, Sign Out From the Shell.
- `user-auth`: Authentication Configuration.

## Impact

- `apps/web/src/proxy.ts`, `apps/web/src/lib/supabase/proxy.ts`, a new shared-account setting, the You page and `.env.example`.
- Deployments must set `SHARED_ACCOUNT_EMAIL` and `SHARED_ACCOUNT_PASSWORD` (never `NEXT_PUBLIC_`), and the account must exist in Supabase Auth.
- Anyone who can reach the URL can read and change the shared account's data.
