# Tasks

Every task is test-first: write the failing pgTAP, unit, component or Playwright test named in the task, then the code. Each task adds its own English and French message keys, and the i18n tests (French has exactly the English keys, no empty message) must stay green.

## 1. Database: share control (design decision 1)

- [x] 1.1 Add a minimal `realtime` schema to `scripts/test-db/supabase-shim.sql` with Supabase's signatures:
  - `messages` (topic, extension, event, payload, private, inserted_at);
  - `topic()`, which reads the `realtime.topic` session setting;
  - `send(payload, event, topic, private)`, which inserts a broadcast row.

  Verify `pnpm test:db` still passes on the existing files.
- [x] 1.2 Write `supabase/tests/database/14_build_sharing.test.sql`, then add `set_build_sharing` and `build_share_token` in a new migration `2026110712xxxx_build_story_sharing.sql`. Verify the pgTAP cases:
  - the owner turns sharing on and gets a UUID;
  - on again keeps the token;
  - off nulls the token and the flag;
  - on after off gives a different token;
  - `updated_at` moves on enable;
  - another user, an administrator and `anon` get `42501` or no execute privilege, and the row is unchanged;
  - `share_token` is still unreadable through `select` on `builds` for `authenticated`.

## 2. Database: story data and variant rules (decisions 2 and 3)

- [x] 2.1 Add `step_applies(p_key, p_guitar_type, p_bobo)` with its three arrays between the `step-variant-rules` markers. Verify pgTAP counts of applicable template keys for the six variants (classical, steel-string and not set, each with and without BOBO) against the `build-sequence` spec figures, including 120 for steel-string with BOBO and 112 for classical without BOBO.
- [x] 2.2 Add `apps/web/src/lib/story/variantRulesSql.test.ts`. It reads the migration, extracts the three arrays and compares them with the keys derived from `TEMPLATE_STEPS` (`guitarType` and `needsBobo`). Verify it passes, and that it fails when one key is removed from the SQL during a quick local check.
- [ ] 2.3 Write `15_build_story.test.sql`, then add `get_build_story(p_token)` granted to `anon` and `authenticated`. Verify:
  - a valid token returns exactly the keys `name`, `guitarType`, `boboNeck`, `createdAt` and `steps`;
  - an incomplete step with notes and photos comes back as `{key, completed: false}`;
  - a completed steel-string-only step on a classical build is absent;
  - malformed stored entries read as empty;
  - an unknown token, a disabled build and a revoked token all return null;
  - `anon` still selects nothing from `builds` and lists nothing in `storage.objects` (No Enumeration).

## 3. Database: live-update signal (decision 4)

- [ ] 3.1 Write `16_story_realtime.test.sql`, then add the `after update or delete` trigger that sends `changed` on `story:<old token>`, `can_follow_story(topic)` and the `realtime.messages` select policy for `anon` and `authenticated`. Verify:
  - a step change on a shared build writes one message on its topic;
  - disabling writes one on the old topic;
  - deleting writes one;
  - an unshared build writes none;
  - with `realtime.topic` set to a valid topic `anon` can read the message, and an unknown, revoked or malformed topic reads nothing.
- [ ] 3.2 Regenerate or extend `packages/db/src/database.types.ts` with the three client-facing functions (`set_build_sharing`, `build_share_token`, `get_build_story`). Verify `pnpm typecheck`.

## 4. UI package

- [ ] 4.1 Add `@radix-ui/react-switch` (pinned exactly) and a token-styled `Switch` to `@gb/ui`: amber when on, a visible focus ring, label and description slots. Verify component tests for toggling, the disabled state and the accessible name, and that the contrast tests still pass in both themes.

## 5. Share dialog (decision 5)

- [ ] 5.1 Add `lib/builds/sharing.ts` (`readShareToken`, `setSharing`, each returning `{ ok, token }`) over the browser client. Verify unit tests with a fake client for success, error and null-token results.
- [ ] 5.2 Build `components/builds/ShareDialog.tsx` and enable "Share" in `BuildPageBar`. Verify component tests:
  - the unshared state ("Only you can see this build", "Sharing is disabled", "Enable public access to generate a shareable link");
  - opening and closing makes no write;
  - the switch is disabled while loading and while toggling;
  - enabling shows `<origin>/story/<token>`;
  - "Failed to enable sharing" and "Failed to disable sharing" leave the previous state;
  - Copy writes the link and shows "Copied!" for 2 s (fake timers);
  - Preview is a new-tab link;
  - the tip text;
  - French labels.

## 6. Story logic (`apps/web/src/lib/story/`)

- [ ] 6.1 Add `parseStory` (the function's JSON to `{ name, variant, createdAt, states }` via `mergeStepState`), `storyTimeline` and `storyEmptyState`. Verify unit tests built from the spec scenarios:
  - "Join panels" shown and "Bend sides" hidden;
  - an incomplete step with content hidden;
  - whitespace-only notes hidden;
  - numbering 1..n in template order;
  - "justStarted" and "noDetails";
  - progress of 30 of 120 = 25% and 0 of 112 = 0%;
  - the leftover steel-string step on a classical build giving 12 of 120.
- [ ] 6.2 Add `shouldNotify`, `promptDecision` and `updatesPreference` (`gb-story-updates:<token>`, safe when storage throws). Verify unit tests:
  - notify only when the count goes up (4 to 5 yes, 5 to 5 no, 5 to 4 no);
  - the prompt only when supported, permission is "default" and nothing is stored;
  - a stored "on" restored only when permission is "granted".

## 7. Public story page (decision 6)

- [ ] 7.1 Add the `dateLong` format to `i18n/config.ts`. Verify a unit test that 6 December 2025 formats as "December 6, 2025" in English and "6 décembre 2025" in French.
- [ ] 7.2 Replace the placeholder `app/story/[token]/page.tsx` with the server page, and add `loading.tsx` ("Loading build story...") and `StoryNotFound`, with both messages and the "Unable to load this build story." variant. Verify component tests for both messages, and a unit test that `abc` never calls the function.
- [ ] 7.3 Build `StoryView`: header ("Build Story", name, "Started <date>", switch slot), "Build Progress" with `LedProgress`, "<C> of <T> steps" and "<P>% Complete", the timeline or an empty state, and no app navigation. Verify component tests:
  - the "OM #3 / Started December 6, 2025" header;
  - the progress figures;
  - both empty states;
  - no owner name or email and no editing control;
  - a refresh that returns null switches to Story Not Found.
- [ ] 7.4 Build `StoryStepCard`:
  - teal check, label, "Step N";
  - "Notes" with line breaks kept;
  - "<n> Photo" / "<n> Photos" thumbnails;
  - "Sound Analysis (<n>)" with description, "Peak: <f> Hz" (one decimal), date and `SpectrumGraph`.

  Verify the "Card with all content" scenario (2 photos, 187.4 Hz) and the singular "1 Photo".
- [ ] 7.5 Build `StoryPhotos` on `Lightbox`, with previous and next controls and an "i / n" counter. Verify component tests: from the third of 3 photos, next shows the first with "1 / 3"; a single photo shows no controls and no counter; × and a click outside close it.

## 8. Updates and notifications (decision 7)

- [ ] 8.1 Add `public/story-sw.js` (scope `/story/`, `notificationclick` only: close, focus the matching window and post `story-notification-click`, otherwise open `data.url`; no fetch handler) and a `registerStoryWorker()` helper. Verify a unit test of the helper with a fake `navigator.serviceWorker`, and a review that the worker has no `fetch` listener.
- [ ] 8.2 Build the "Get Build Updates?" prompt and the "Get Updates" / "Updates On" switch in `StoryView`. Verify component tests with a fake `Notification`, fake storage and fake timers:
  - the prompt appears after 2 s for a first-time visitor;
  - "Yes" plus granted turns updates on and stores it;
  - "Yes" plus denied stores off;
  - "No thanks" stores off and the prompt does not return;
  - an unsupported browser gets the "does not support notifications" toast;
  - turning updates off is remembered on the next mount.
- [ ] 8.3 Add `useStoryUpdates(token, enabled, onSignal)` on a private `story:<token>` channel, with 1 s coalescing, and wire it to refetch, `shouldNotify`, `showNotification("Update: <name>", { body, tag, data })` and the scroll to the last card on the click message. Verify component tests with an injected channel fake:
  - no subscription while updates are off;
  - a signal refetches once even when 3 signals arrive within 1 s;
  - 4 to 5 steps shows one notification with the tag `story-<token>`;
  - a notes-only edit refreshes without a notification;
  - the click message scrolls to the last card;
  - unmounting removes the channel.

## 9. End-to-end and verification

- [ ] 9.1 Teach `e2e/fake-supabase.ts` the three functions, mirroring the SQL behavior. Write `e2e/story.spec.ts`:
  - the owner enables sharing, copies the link and previews it in a new tab;
  - an anonymous context sees the story without navigation;
  - the owner disables sharing, and reloading shows Story Not Found;
  - turning sharing off then on gives a different link and the old one is Not Found;
  - `/story/abc` and an unknown UUID show Not Found;
  - a `gb-locale=fr` visitor sees French;
  - the story on a 390 px viewport has no horizontal scroll;
  - after navigating away and back, the dialog shows the same link.

  Verify `pnpm test:e2e` passes.
- [ ] 9.2 Manual check on a local Supabase stack (scratch workdir with its own ports):
  - with updates on in one browser, document a step from another; the story refreshes and shows "Update: <name>";
  - disable sharing; the open story turns into Story Not Found;
  - repeat with Android Chrome device emulation, or a phone on the LAN if available.

  Record the outcome in the PR description.
- [ ] 9.3 Run `pnpm check`, `pnpm test:db` and `openspec validate build-story-sharing --type change --strict`, and verify all three are green.
