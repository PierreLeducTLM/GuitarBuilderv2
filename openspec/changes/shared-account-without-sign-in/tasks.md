## 1. Shared account

- [x] 1.1 Read the shared account from `SHARED_ACCOUNT_EMAIL` and `SHARED_ACCOUNT_PASSWORD`, and treat it as absent unless both are set
- [x] 1.2 Sign a visitor without a session in to the shared account in the proxy, on every URL but the story and auth-callback ones, and send `/sign-in` on to its destination
- [x] 1.3 Hide Sign Out on the You page while a shared account is configured
- [x] 1.4 Document the two settings in `apps/web/.env.example`
