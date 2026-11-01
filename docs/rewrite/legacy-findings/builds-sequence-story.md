# Findings: guitar builds, build sequence, build story / sharing

Capabilities written: `guitar-builds`, `build-sequence`, `build-story-sharing`.

## Dead or unwired code
- `src/components/ImageViewer.tsx:10`: imported nowhere (verified with grep over `src` and `e2e`). It would show a "Referenced Figures" grid of images found by RAG retrieval (`RetrievedImage` from `src/services/retrievalService`). Each card has the figure id, a caption, "Referenced in N source(s)" and an "Image not available" fallback, and clicking a card opens it full size. Its strings are under `imageViewer.*` (`public/locales/en/translation.json:252`, `fr:250`). It belongs with chat/references, not with builds.
- `src/components/InstagramPostModal.tsx:77`: imported nowhere. It is a 3-step "Post to Instagram" wizard: Select, Schedule, Review.
  - Postable steps are completed steps that have photos and are not yet posted or scheduled (`:135-155`).
  - The caption is `🎸 <build>\n\n<notes or step label>\n\n#guitarbuilding #luthier #handmade` (`:177-182`).
  - Scheduling offers "Post Now", or "Spread Over Time" from a start date and time (default 10:00) every 1, 2, 3 or 7 days (`:184-233`, `:455-468`). Pending posts can be cancelled through an RPC (`:235-242`).
  - The "Connect Instagram" button has no handler (`:320`), and its step-label map is truncated to 27 of the 132 steps (`:34`).
- `supabase/migrations/20251206000002_add_instagram_tables.sql`: the `instagram_accounts`, `scheduled_posts` and `posted_steps` tables and the `get_due_scheduled_posts` and `cancel_scheduled_post` functions are used only by the dead modal. No OAuth flow and no publishing worker exist; `supabase/functions` holds only ask-llm, generate-embeddings and upload-reference-images. The `scheduled_posts` and `posted_steps` rows cascade-delete with a build.
- Build model name, width and length can never be set. `AddBuildForm.tsx:31-33` always sends `''`, `null` and `null`, and no edit-build UI exists. `BuildDetail.tsx:229-283` still displays them, so the values always show as N/A or empty.
- Unused translation keys: `builds.modelName`, `builds.modelNamePlaceholder` and `builds.measurements` (`public/locales/en/translation.json:50-51,62`, and the same lines in fr).
- `BuildSequenceDiagram.tsx:114-273`: the per-node `type: 'input'` and `'output'` values are overwritten to `'custom'` at `:276`, so they have no effect. `ShareBuildModal.tsx:93-97` is an empty `useEffect`.
- The step template is duplicated in 4 places: labels and edges in `BuildSequenceDiagram.tsx:112-444`, ids in `src/lib/defaultSequenceDiagram.ts:4-170`, labels in `BuildStory.tsx:9-142`, and partial labels in `InstagramPostModal.tsx:6-35`. The story's step total is the size of its own label map (`BuildStory.tsx:335-337`).

## Bugs and inconsistencies
- **No current migration creates the `sequence_diagram` column.** Commit 5eafef9 added `supabase/migrations/20251206_add_sequence_diagram.sql`, and commit 9901653 deleted it. On a database built from the migrations alone, two things break:
  - creating a build fails, because the insert includes `sequence_diagram` (`AddBuildForm.tsx:34`);
  - `get_build_by_share_token` fails to compile (`20251206000001_add_share_token.sql:110,122`).
  - Spec: the sequence state is a stored build attribute.
- The `step-photos` bucket is not created by any migration ("created manually", `20251206000000_add_step_photos_bucket.sql:2`). The code needs the bucket to be public (`getPublicUrl`, `BuildSequenceDiagram.tsx:827`).
- Live story updates need `guitar_builds` in the realtime publication, and no migration adds it. `BuildStory.tsx:207-254` subscribes, but it gets no events unless the table was enabled by hand.
- **"Your Builds" leaks other users' builds.** The list query has no owner filter (`App.tsx:277-280`). Two policies widen it:
  - the admin SELECT-all policy was re-added in `20251121170000_fix_user_profiles_visibility.sql:58-62`, although `20251121000001_fix_admin_rls_policies.sql:1-14` says admins should see only their own data in user sections;
  - the share policy is always true (see Security).
  - As a result, admins see every user's builds, and every user sees all other users' shared builds. They can open them, but their updates and deletes silently affect 0 rows, and the UI still removes the card.
  - Spec: the list shows only the user's own builds, and admins get full access only through administration features or deep links.
- The add-build form asks only for a name (`AddBuildForm.tsx:77-92`), but `e2e/guitar-builds.spec.ts:114-116` fills `input-model-name`, `input-width` and `input-length`, which no longer exist, so the test cannot pass. Commit 5eafef9 removed those fields. Spec: the name-only form, plus an open question.
- A name made only of whitespace is accepted, because the only check is the HTML `required` attribute (`AddBuildForm.tsx:86`). Spec: the name must not be blank.
- Deleting a build never deletes its photo files in storage (`App.tsx:317-331`), so orphaned public files remain. Spec: the photos are deleted with the build.
- `BuildDetail.tsx:191-195` calls `onBack()` even when the delete failed; `App.tsx:330` also navigates. This is harmless but redundant.
- **The share state goes stale.**
  - `BuildDetail` keeps `share_token` and `share_enabled` in local state (`BuildDetail.tsx:30-31`), and the cached list in `App` is never updated. `BuildDetailPage` reuses that cached build (`App.tsx:48-53`).
  - After the owner leaves the build and comes back, the dialog shows sharing as off. Toggling it "on" again generates a new token, which silently kills the link the owner already sent to clients.
  - Spec: Share State Consistency.
- **Notes are saved on every keystroke.** The comment says "Debounce", but there is none (`BuildSequenceDiagram.tsx:644-646`).
  - Every step mutation rewrites the whole sequence document (`:561-583`). Out-of-order responses or a second tab or device therefore apply last-writer-wins and can lose data.
  - Save errors are only logged (`:580-582`), so the user is never told.
  - Spec: immediate persistence and no lost rapid edits.
- Photo-upload failures are only reported when every file failed (`BuildSequenceDiagram.tsx:820-839`). Partial failures are silent. Spec: report whenever any file fails.
- An accepted capture that has no spectrum is silently dropped (`BuildSequenceDiagram.tsx:675`; `FrequencyDetectionModal.tsx:825-827` can call `onAccept(freq)` without data).
- Stored step entries whose key is not in the template are discarded on the next save (`BuildSequenceDiagram.tsx:533-552,564-571`). Spec: they are ignored. See the open questions.
- Template structure, specified as it is now:
  - the Heel Assembly chain (`SSFitHeel`) and the Body Assembly chain (`BindBody`) have no incoming edges;
  - no edge links the component groups (truss rod, fretboard, neck, plates, braces, sides, blocks, bridge, nut and saddle) to the assembly steps, and `AssembleNeckRod` is itself a root;
  - "Glue mass blocks & side splices" comes before "Make mass blocks and side splices" (`BuildSequenceDiagram.tsx:430-431`), which looks reversed;
  - `SSCutBridge` is a dead end (`:333`).
  - Cross-links from the source Mermaid chart were probably lost (`:288-444`).
- Many strings are hard-coded in English, so French users get English:
  - the whole of `ShareBuildModal.tsx` and `BuildStory.tsx`;
  - most of `BuildSequenceDiagram.tsx` (`:680,722,948,998,1014-1019,1057,1066,1093,1123-1130,1183,1200,1206,1238-1239`);
  - `BuildDetail.tsx:217` ("Share") and `App.tsx:85` ("Loading build...");
  - dates fixed to `en-US` in `BuildDetail.tsx:180` and `BuildStory.tsx:424`;
  - the French file is missing `builds.tabOverview` and `builds.tabSequence` (`public/locales/fr/translation.json`).
  - Spec: English and French everywhere, including the step labels.
- **The notification check uses a stale count.** `lastStepCount` is read inside the realtime callback and captured when the subscription starts (`BuildStory.tsx:200-259`; `lastStepCount` is not in the deps). After the first increase, every later update notifies again, even a plain note edit. Spec: notify only when the count rises above the last value seen.
- Live refresh of the story only happens while notifications are on (`BuildStory.tsx:201`). This is specified as it is; see the open questions.
- `BuildStory.tsx:194` reads `Notification.permission` without a feature check. It throws in browsers that lack the Notification API when the stored preference is `'true'`.
- The notification icon `/icon-192x192.png` (`BuildStory.tsx:234`) does not exist in `public/`.
- A malformed (non-UUID) token makes the RPC fail, so the page shows the generic "Unable to load this build story." (`BuildStory.tsx:305-316`). Spec: the Not Found page.
- If the owner disables sharing while a viewer has the story open, the empty re-fetch is ignored (`BuildStory.tsx:221`), and the viewer keeps seeing stale content.
- The share tip promises "all completed steps, notes, and photos" (`ShareBuildModal.tsx:188`), but the story shows only completed steps that are documented (`BuildStory.tsx:393-397`).
- `updated_at` has no update trigger (`20251001000000_create_guitar_builds_table.sql:32`); only the share RPCs set it. Spec: it updates on every change.
- The spectrum graph plots bins below 20 Hz to the left of the axis, inside the label gutter (`FFTGraphViewer.tsx:85-88`).

## Security and data-integrity concerns
- **The public share policy is a tautology.** "Public can view builds with valid share token" uses `share_token = share_token` (`20251206000001_add_share_token.sql:28-34`).
  - Anyone holding the public anon key can SELECT the full row of every shared build: `user_id`, `share_token`, dimensions and the whole sequence state. They can enumerate every shared build and its token.
  - Every signed-in user sees those builds in their own list, and anonymous realtime subscribers receive full row payloads.
  - Fix: drop the policy and rely on the SECURITY DEFINER token RPC.
- `get_build_by_share_token` returns the whole sequence state (`20251206000001:104-127`). That includes notes, photos and measurements of steps that are not completed, which the story hides only on the client.
- **The `step-photos` storage policies are too broad** (`20251206000000:6-24`):
  - any authenticated user can upload to any path and delete any object, because there is no owner or path check;
  - the public SELECT on `storage.objects` lets anonymous clients list the bucket, which exposes every photo of every build, shared or not;
  - photos of builds that are not shared are readable by URL, and the paths reveal the build UUID and the step key.
- Uploads have no server-side type or size limit. Only the client sets `accept="image/*"` (`BuildSequenceDiagram.tsx:1033`), so arbitrary files (for example HTML) can be hosted in a public bucket.
- Photos stay publicly reachable after their build is deleted, because they are orphaned.
- `generate_share_token`, `revoke_share_token` and `get_build_by_share_token` are SECURITY DEFINER but do not `SET search_path` (`20251206000001:37-128`).
- **`get_due_scheduled_posts` leaks Instagram access tokens.** The function (`20251206000002:132-162`) is SECURITY DEFINER, has no auth check and keeps the default PUBLIC execute grant, so anyone, including anonymous callers, gets every user's pending posts together with the Instagram access tokens. The tokens are also stored in plaintext (`:16-26`). The risk is latent because nothing writes these tables. Recommendation: drop the tables and functions.
- The admin policies on `guitar_builds` are loose:
  - INSERT is `WITH CHECK (is_admin())` (`20251118000000:163-165`), so an admin can create builds owned by anyone;
  - UPDATE has no WITH CHECK (`:167-169`), so an admin can reassign ownership;
  - they still use `is_admin()` rather than `is_admin_safe()`.
- The share RPCs check `user_id = auth.uid()`, so admins cannot share or unshare other users' builds. This matches the spec.

## Open questions for the owner
1. Should the creation form (or a new edit-build feature) collect model name, width (mm) and length (mm) again? The e2e test expects these fields and the detail page displays them, but they can never be set today. The spec keeps a name-only form and read-only display.
2. Should the owner's sequence view show an overall progress figure, such as "X of 132 steps"? Only the public story shows one today; the spec gives the owner per-step badges only.
3. Template structure: should the component groups feed into assembly (for example truss rod, fretboard and neck into "Assemble neck, rod, fretboard", and plates, sides and blocks into "Bind body")? Should "Glue mass blocks" and "Make mass blocks" swap places, and should "SS cut bridge plate blank" lead to "SS shape bridge plate"? The spec copies the current template exactly (132 steps, 123 arrows).
4. The spec assumes CL means classical, SS means steel-string and BOBO means bolt-on/bolt-off neck; please confirm. Should a build choose its variant and hide the steps that do not apply? Today every build gets all variants.
5. The 132 step labels need French translations, which the spec requires and nobody has written yet.
6. Should deleting a photo ask for confirmation, as deleting a measurement does? The spec keeps one-click deletion.
7. Should photos have limits on count, size or type? The spec says "no limit", matching the current code.
8. Should the public story refresh live even when the visitor has not turned on notifications? The spec limits live refresh to when updates are on, as the code does.
9. Should stored step entries with keys unknown to the template be kept rather than dropped? This matters if the template changes. The spec says they are ignored.
10. Should the story show the model name? It is returned but not displayed, and the spec hides it.
11. Should the server, rather than the client, filter out non-completed steps' notes, photos and measurements from the story data?
12. Should the diagram tell the user when a save fails? Today failures are only logged, and the spec does not require a message.
13. Should there be a one-click "regenerate link" action? The spec defines regeneration as turning sharing off and on.
14. Should step completion record a timestamp, so that the story can be chronological? It is ordered by template position today.
15. Is it intended that an admin can open, modify and delete other users' builds by URL? The spec allows it, following the final RLS state.
