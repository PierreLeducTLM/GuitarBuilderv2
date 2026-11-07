# Design

## Context

Already in place:
- **`builds` table** (`20261102120000_builds_and_steps.sql`).
  - `share_token uuid unique` and `share_enabled boolean` exist, but column grants make the token unreadable by every client role and both share columns unwritable.
  - `set_updated_at()` moves `updated_at` on every update, except in the legacy import's own transactions.
- **Step state.** Each build stores its step state as one `sequence_state` document. Only `update_build_step()` writes it, one owner-checked change at a time.
- **Shared app logic.** `apps/web/src/lib/sequence/` already provides everything the story needs: the template, `stepApplies`, `displayGraph`, `mergeStepState`, `progress` and `SpectrumGraph`. The story reuses these instead of copying them, unlike the legacy app.
- **Photos.** Step photos live in the public `step-photos` bucket. They are readable by URL, nobody can list them, and only the owner writes them.
- **Access gate.** The proxy serves `/story/<token>` without a session and never signs a story visitor in to the shared account.
- **Language.** The root layout applies the stored language, time zone and theme cookies, so the story page gets the visitor's language and falls back to English.
- **Build page.** `BuildFrame` renders `BuildPageBar`, whose "More actions" menu holds a disabled "Share" item. Read-only builds have no menu.
- **Tests.**
  - The pgTAP runner loads `scripts/test-db/supabase-shim.sql` before the migrations.
  - End-to-end tests run against `apps/web/e2e/fake-supabase.ts`, which has no Realtime.

Legacy defects this design must not repeat (`docs/rewrite/legacy-findings/builds-sequence-story.md`):
- a share policy that was always true;
- a story function returning all content and filtering it in the browser;
- a share state that went stale;
- a notification check comparing against a stale count;
- `Notification` used without a feature check;
- a malformed token shown as a generic error;
- a disabled link that kept showing stale content to an open viewer;
- `SECURITY DEFINER` functions without `search_path`.

Requirements: `openspec/specs/build-story-sharing/spec.md` plus this change's delta (Anonymous Story Access).

## Goals / Non-Goals

**Goals:**
- Every `build-story-sharing` requirement, in English and French and in both themes.
- Every access rule enforced in Postgres and covered by pgTAP: share control, story read and live-update subscription.
- One source for variant applicability in the app, with a test that fails if the database's copy drifts from it.

**Non-Goals:**
- No link-preview metadata (Open Graph) for stories.
- No notifications while the story page is closed, and no push service.
- No offline caching. The service worker only shows notifications and handles clicks on them.
- No change to how the owner's own build views load or refresh.

## Decisions

### 1. Share control through two owner-only functions

Both are `security definer`, `set search_path = ''`, granted to `authenticated` only:

- **`set_build_sharing(p_build_id uuid, p_enabled boolean) returns uuid`.**
  - It locks the caller's own row (`owner_id = auth.uid()`).
  - Turning sharing on keeps the current token when sharing is already on. Otherwise it sets `share_token = gen_random_uuid()` and `share_enabled = true`.
  - Turning sharing off sets `share_token = null` and `share_enabled = false`.
  - It returns the token, or null when sharing is off.
  - A missing build, another user's build and an administrator calling on someone else's build all raise the same `42501` "Not allowed" error, so the function reveals nothing about builds the caller does not own.
  - The existing trigger moves `updated_at`.
- **`build_share_token(p_build_id uuid) returns uuid`.** It returns the current token of one of the caller's own builds, or null when sharing is off. It raises the same `42501` error otherwise.

The column grants do not change. Clients still cannot read `share_token` from the table or write either share column.

`gen_random_uuid()` is a version 4 UUID with 122 random bits, which meets Share Token Properties. "A previously issued token never becomes valid again" holds because turning sharing off deletes the token and a new one is drawn at random. A collision with a past token has a probability of about 2⁻¹²² and is accepted; we do not keep a list of revoked tokens.

*Alternative:* PostgREST updates on the share columns guarded by RLS. Rejected: an update could then set a token of the client's choosing, and the keep-or-regenerate rule would live in the client.

### 2. Story data from one token-keyed function

**`get_build_story(p_token uuid) returns jsonb`.** It is `security definer`, `stable`, `set search_path = ''`, and granted to `anon` and `authenticated`. It looks up the build with `share_enabled and share_token = p_token`. When there is none it returns `null`; it never raises, so a missing build and a disabled one look the same. Otherwise it returns:

```json
{ "name": "...", "guitarType": "classical" | "steel_string" | null, "boboNeck": true,
  "createdAt": "...", "steps": [ { "key": "...", "completed": true,
  "notes": "...", "photos": [...], "measurements": [...] } ] }
```

- `steps` keeps only the stored entries whose key applies to the build's variant (decision 3).
- Entries that are not completed are reduced to `{key, completed: false}`, as the delta spec requires.
- Entries are normalized the same way `update_build_step` normalizes them, so malformed stored data reads as empty.
- Measurements pass through as stored: id, timestamp, description, frequency, spectrum and optional roles.
- The owner id, the token, `updated_at` and the build id are never returned.

The client merges `steps` with `mergeStepState` and derives everything from it with the existing `displayGraph(variant)` and `progress()`: the timeline, the empty states and "<C> of <T> steps".

A malformed token never reaches the database. The page checks it with the existing `isUuid` and shows Story Not Found.

*Alternative:* an RLS policy that lets `anon` select a build by token. Rejected: a policy cannot require that the token be supplied (the legacy tautology), it cannot withhold incomplete-step content, and it would let clients enumerate builds.

### 3. Variant applicability in SQL, checked against the template

The story function needs to know which steps apply. A SQL function `public.step_applies(p_key text, p_guitar_type text, p_bobo boolean) returns boolean` is `immutable` and holds three arrays:
- the 12 steel-string-only keys;
- the 12 classical-only keys (the 2 CL BOBO-slat keys are in this list and in the next);
- the 8 BOBO-only keys.

It applies the same rule as `stepApplies`: a BOBO-only step needs a BOBO neck, and a step tied to one guitar type is hidden only when the build's guitar type is set to the other one.

The arrays sit between `-- step-variant-rules:begin` and `-- step-variant-rules:end` markers in the migration. A Vitest test (`lib/story/variantRulesSql.test.ts`) reads the migration file, extracts the three arrays and checks that they equal the keys derived from `TEMPLATE_STEPS`. A template change that is not mirrored in a new migration therefore fails `pnpm check`. A pgTAP test also checks the specified counts for all six variants.

*Alternative:* return every step and filter in the browser. Rejected: the delta spec says hidden steps are not returned. *Alternative:* a step table generated from the template. Rejected: it adds a generation step and a table for 32 static facts.

### 4. Live updates: a database signal on a private Realtime channel

- An `after update or delete` trigger on `builds` calls `realtime.send('{}'::jsonb, 'changed', 'story:' || old.share_token, true)` whenever the old row was shared.
  - This covers step changes, variant changes and turning sharing off: viewers then fetch again and see Story Not Found.
  - It also covers deletion.
  - When sharing is turned on there is no old topic, and nobody is listening yet.
  - The signal carries no build data.
- A policy on `realtime.messages` lets `anon` and `authenticated` receive broadcasts on a topic only when `public.can_follow_story(realtime.topic())` is true.
  - That function is `security definer`.
  - It parses `story:<uuid>` and checks that a build with that token has sharing on.
  - A wrong or revoked token cannot join.
- The client subscribes with `supabase.channel('story:<token>', { config: { private: true } })` and listens for `changed`.
  - Each signal schedules one fetch of `get_build_story`, delayed by 1 s and coalescing signals that arrive within that second. Notes autosave every 500 ms while the owner types, so this keeps viewers from fetching on every save.
  - The subscription exists only while updates are on (Live Story Updates).

*Alternative:* Postgres Changes on `builds`. Rejected: it needs `anon` SELECT on the table, which would leak whole rows (the legacy defect). *Alternative:* polling. Rejected: the spec asks for refresh "whenever the build changes", and polling either lags or loads the database.

### 5. The share dialog fetches the state each time it opens

`ShareDialog` (in `components/builds/`) opens from the now-enabled "Share" menu item in `BuildPageBar`.
- Each time it opens, it calls `build_share_token` and shows the switch disabled until the answer arrives. The build layout stays mounted while the owner moves between views, so state loaded with the page could go stale; fetching on open satisfies Share State Consistency.
- Toggling the switch calls `set_build_sharing` with the switch disabled while it runs. A failure shows the "Failed to enable sharing" or "Failed to disable sharing" toast and leaves the previous state.
- The link is `${window.location.origin}/story/${token}`.
- Copy uses `navigator.clipboard.writeText` and shows "Copied!" for 2000 ms.
- Preview opens the link with `target="_blank" rel="noopener"`.
- The calls go through a small `lib/builds/sharing.ts` module that wraps the two functions and returns `{ ok, token }`, so the dialog's tests can fake it.

`@gb/ui` gains `Switch`, built on `@radix-ui/react-switch` and styled with tokens (amber when on). The story's "Get Updates" control uses it too.

### 6. Story page: rendered on the server, refreshed in the browser

- `app/story/[token]/page.tsx` is a server component.
  - It checks the token, calls `get_build_story` through the server client and renders either `StoryNotFound` or `StoryView` with the initial data.
  - A failed call, as opposed to a null result, renders `StoryNotFound` with "Unable to load this build story.".
- `app/story/[token]/loading.tsx` shows "Loading build story...".
- `StoryView` is a client component. It holds the story state, renders the header, the progress and either the timeline or an empty state, and owns the updates logic (decision 7).
  - A fetch that returns null replaces the view with Story Not Found.
  - A failed fetch keeps the current story.
- Pure logic lives in `lib/story/` with unit tests:
  - `storyTimeline(variant, states)`: applicable steps that are completed and documented (non-blank notes, a photo or a measurement), in template order, numbered 1 to n;
  - `storyEmptyState`: "justStarted", "noDetails" or none;
  - `shouldNotify(previousCount, nextCount)`: true only when the count goes up;
  - `promptDecision`;
  - `updatesPreference` storage keyed by token.
- `StoryStepCard` reuses `SpectrumGraph`, the `decimal1` peak format and the `dateTimeShort` date format.
- `StoryPhotos` uses the `Lightbox` from `@gb/ui` and passes it previous and next controls and a monospace "i / n" counter when there is more than one photo. The index wraps around.
- "Started <date>" uses a new `dateLong` format (`{ day: "numeric", month: "long", year: "numeric" }`): "December 6, 2025" in English, "6 décembre 2025" in French.
- Layout follows the Oscilloscope direction:
  - the `TraceMark` app header, without the shell;
  - an LED-segment progress bar (`LedProgress`);
  - a teal check for completed steps;
  - JetBrains Mono for every number.

### 7. Updates preference, prompt and notifications

- **Support.** Notifications are supported when `"Notification" in window && "serviceWorker" in navigator`.
- **Preference.** Stored in `localStorage` under `gb-story-updates:<token>` as `on` or `off`, and read inside try/catch: storage can be missing, and an unreadable value counts as none.
- **Prompt** ("Get Build Updates?"). It opens 2000 ms after the page mounts, but only when notifications are supported, `Notification.permission === "default"` and no preference is stored.
  - "Yes, notify me" calls `Notification.requestPermission()`. "granted" stores `on`; anything else stores `off`.
  - "No thanks" stores `off`.
- **Switch.** It reads "Get Updates" when updates are off and "Updates On" when they are on.
  - Turning it on without support shows the toast "This browser does not support notifications.". With support, it requests permission as above.
  - Turning it off stores `off`.
  - On load, a stored `on` is restored only if `Notification.permission === "granted"`.
- **Service worker.** `public/story/sw.js` is plain JavaScript; served under `/story/`, it passes the access gate like any story path and its scope is `/story/`. It is registered when updates turn on. It has no `fetch` handler and no cache, and it does only two things:
  - On `notificationclick`, it closes the notification and focuses an open window whose URL matches the notification's `data.url`, then posts `{ type: "story-notification-click" }` to it. If no such window is open, it opens `data.url`.
  - It is otherwise idle.
- **Showing a notification.** The page shows notifications itself through `registration.showNotification("Update: <name>", { body, tag: "story-<token>", data: { url } })`, so a newer one replaces the older one. That call is the same on desktop and Android.
  - The page keeps the last timeline count in a ref, updated on every fetch.
  - It notifies only when `shouldNotify(previous, next)` is true. This avoids the legacy stale count.
  - When the page receives the click message, it scrolls the last step card into view.

*Alternative:* `new Notification()`. Rejected: Android Chrome throws on it (chosen with the user on 2026-11-07).

### 8. Tests by layer

- **pgTAP** (`14_build_sharing.test.sql`, `15_build_story.test.sql`, `16_story_realtime.test.sql`):
  - share functions: owner on/off/keep/regenerate, non-owner, administrator and anonymous refused, `updated_at` moves, token still unreadable through the table;
  - story function: valid token, disabled, unknown, incomplete-step stripping, hidden-step removal, no owner id or token in the output, the six variant counts from `step_applies`;
  - realtime: the trigger writes a message on the old topic for updates, disable and delete; it writes nothing for unshared builds; the `realtime.messages` policy admits a valid topic and refuses an unknown, revoked or malformed one.
  - The shim gains a minimal `realtime` schema: `messages` (topic, extension, event, payload, private), `topic()` reading `realtime.topic` from the session settings, and `send()`. This matches Supabase's signatures.
- **Vitest:**
  - `lib/story` pure functions against the spec scenarios: 30 of 120 → 25%, 0 of 112, the leftover steel-string step, whitespace notes, notify only on increase;
  - the SQL drift test;
  - component tests for `ShareDialog` (off state, enabling, failure toasts, copy and "Copied!", French labels), `StoryView` (header, progress, timeline, both empty states, no owner info, Not Found after a null refresh), the prompt and switch flows with a fake `Notification` and storage, and the lightbox wrap-around and single-photo case.
- **Playwright:** the fake Supabase server learns the three functions.
  - Owner enables sharing, copies the link and previews it.
  - An anonymous context opens the story.
  - The owner disables sharing, and the reload shows Not Found.
  - The `/story/abc` and unknown-token pages render.
  - A French-cookie visitor sees French.
  - A phone viewport is checked.
- **Manual:** against a local Supabase stack (scratch workdir, per the port-clash note), with updates on in one browser and a step documented in another: the story refreshes and the notification appears.

## Risks / Trade-offs

- [Realtime private channels need `realtime.send` and RLS on `realtime.messages`, which the hosted project and the local CLI stack provide but the pgTAP shim only imitates] → The shim mirrors the function signatures. The manual check on a real local stack is a task, and the trigger and policy are a few lines each.
- [Notes autosave makes the owner's typing produce a signal every 500 ms] → Viewers coalesce signals into at most one fetch per second. The signal is empty, so its cost is small.
- [The SQL list of variant rules duplicates the template] → The drift test fails `pnpm check` on any mismatch, and the pgTAP counts guard the SQL side.
- [On a first visit, the server formats "Started <date>" in UTC until the time-zone cookie is set, so a build created near midnight can show the neighbouring day once] → This is the same behavior as every other server-rendered date in the app.
- [iOS Safari outside an installed web app has no notifications] → It shows the specified "not supported" message. Because live refresh needs updates on, those viewers refresh by reloading, as the spec states.
- [A service worker registered under `/story/` stays installed in the visitor's browser] → It has no fetch handler, so it cannot affect page loads. Changing it later only needs a new file version.

## Migration Plan

- **Deploy.** Apply the new migration (functions, trigger, policy) and deploy the app. No data changes. Builds imported with share tokens by `legacy-data-migration` keep working, because the story function reads the same columns.
- **Rollback.** Revert the app deploy. The migration's functions and trigger can stay: unused functions are harmless. Dropping them needs a down migration that removes the trigger, its function, the policy and the five other functions.
