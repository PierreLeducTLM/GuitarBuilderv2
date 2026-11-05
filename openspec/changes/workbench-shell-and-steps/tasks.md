# Tasks

Every task is test-first: write the failing unit, component or Playwright test named in the task, then the code.

## 1. Routes and the navigation model (`apps/web/src/lib/routes.ts`)

- [x] 1.1 Replace the flat `sections` list with `destinations` (Builds, Tools with Wood panels and Simulator, Assistant, You; References and Admin flagged `adminOnly`), and add `activeTab(pathname)` and `activeEntry(pathname)` (design decision 4). Verify unit tests for:
  - the order and URLs of Application Sections and URLs;
  - `/builds/x/steps/TopPanel` making Builds active;
  - `/wood-properties` making the Tools tab and the Wood panels entry active;
  - admin entries filtered for the user role
- [ ] 1.2 Extend `classifyPath` and `safeNextPath` for:
  - `/builds/<id>` followed by nothing, `/map`, `/map/<group>`, `/overview` or `/steps/<key>`;
  - `/tools` and `/you`.

  Verify unit tests that these are `section`, that malformed keys (`/builds/x/steps/a b`, `/builds/x/map/UPPER`, `/builds/x/extra`) are `unknown`, and that a sign-in `next` of `/builds/x/steps/TopPanel` is kept

## 2. Shell (`apps/web/src/components/shell/`)

- [ ] 2.1 Add the message keys `nav.*` (Builds, Tools, Assistant, You, Wood panels, Simulator, References, Admin), `tools.*` and `you.*` to `en.json` and `fr.json`, and remove `nav.short.*` and the slide-out menu keys. Verify that the i18n tests pass (French has exactly the English keys, no empty message) and that the labels are those of the app-shell delta
- [ ] 2.2 Build `TabBar` (four entries, active from `activeTab`, hidden on `/builds/<id>/steps/…`). Verify component tests: four entries for an administrator, Tools active on `/wood-properties`, nothing rendered on a step URL
- [ ] 2.3 Build `Sidebar`: title link to `/builds`, destination entries with sections, a `RecentBuilds` slot, admin entries in the admin accent, and an account entry linking to `/you`. Verify component tests: the Desktop Sidebar scenario order, no admin entries for a user, the active entry from `activeEntry`
- [ ] 2.4 Add `listRecentBuilds(userId, 5)` (`id, name`, `owner_id = userId`, `updated_at desc`) and pass the result from `(shell)/layout.tsx` to the sidebar, highlighting the build being viewed. Teach `e2e/fake-supabase.ts` the `updated_at` ordering and `limit`. Verify a query unit test and a Playwright test where 7 builds show the 5 most recently changed, and an administrator sees only their own
- [ ] 2.5 Build `PageBar` (title, optional return link, actions slot) and rewrite `AppShell` around `Sidebar`, `TabBar` and the main area. Remove the header, the `Sheet` menu, `UserMenu` and `NavEntries`. Verify `pnpm typecheck` and that no file imports the removed components
- [ ] 2.6 Add `app/(shell)/you/page.tsx`: "Signed in as" with the email, `LanguageSwitcher`, `ThemeSelector`, the "Administration" group for administrators only, and "Sign Out" with the existing failure toast. Verify component tests for both roles and the sign-out failure message
- [ ] 2.7 Add `app/(shell)/tools/page.tsx` listing Wood panels and Simulator with icon, name and one-line description. Give `/wood-properties` and `/simulator` a page bar whose return control on narrow viewports goes to `/tools`. Verify component tests and the "Return from a tool on a phone" scenario in Playwright
- [ ] 2.8 Rewrite `e2e/shell.spec.ts`, `e2e/mobile.spec.ts` and `e2e/preferences.spec.ts` for the new navigation. Port each existing test, or tie it to a removed requirement in a comment in the PR description. Cover:
  - sidebar at 1280 px, with no tab bar;
  - tab bar at 390 px, with no menu button;
  - preferences and sign-out on `/you` at both widths;
  - admin redirects unchanged;
  - title click to `/builds`;
  - the last content of a long page visible above the tab bar.

  Verify `pnpm test:e2e` passes for these files

## 3. Template groups and derived structure (`apps/web/src/lib/sequence/`)

- [ ] 3.1 Add `groups.ts` (15 groups: id, URL key, message key) and the `groups.<key>` names in both catalogs. Verify a conformance test that parses the Template Group Names scenario in this change's delta (moved to the main spec at archive) and matches every key and English and French name
- [ ] 3.2 Implement `groupGraph(displayGraph, states)`: per group, the displayed steps, completed and total counts, the state (done, ready, not started) and the feeding groups; assembly groups in depth order. Verify unit tests for:
  - the Build Map scenarios (assembly order and inputs, "Truss rod 6/7" ready, "Neck assembly 0/7");
  - feeds that are identical across all six variants
- [ ] 3.3 Implement `partFlow(displayGraph, groupId)` returning rows, internal edges with spans (skip edges flagged) and cross-group entries and exits. Verify unit tests for:
  - Truss rod rows and the shared layer of the nut and stop block;
  - End blocks and linings having 3 steps in one row;
  - the Truss rod exit and the three Neck assembly entries;
  - every displayed arrow of each of the six variants appearing exactly once as an internal edge or as an exit (matched by an entry);
  - the group 12 skip edge being flagged
- [ ] 3.4 Implement `stepContext(graph, states, key)`, `stepNeighbours(graph, key)` and `nextAfterDone(graph, states, key)`. Verify unit tests for:
  - the Step Context scenarios, including "Starting step of" and "Last step of the build";
  - Previous skipping hidden step 13;
  - the disabled ends;
  - the three "Done, next step" outcomes (next ready after, wrap to an earlier ready step, Steps view when none remain)

## 4. Build layout, views and actions (`app/(shell)/builds/[id]/`)

- [ ] 4.1 Move the build loading into `layout.tsx` with a client `BuildProvider` (build, variant, `StepStore`, display graph, `canEdit`) and add the `page.tsx`, `map/page.tsx`, `overview/page.tsx` routes rendering placeholders for their views. Verify a Playwright test that typing notes, switching views and coming back keeps the notes without a reload, and that Back returns to the previous view
- [ ] 4.2 Validate `map/[group]` and `steps/[key]` on the server (unknown key, or a step hidden by the stored variant, redirects to `/builds/<id>`), and add the client guard in `BuildProvider` after a variant change. Verify Playwright tests for the three new Inaccessible Build Links scenarios and for a classical switch while on an SS-only step
- [ ] 4.3 Replace `BuildHeader` with the build's `PageBar`:
  - the return control and title;
  - type, BOBO and created chips;
  - a "More actions" menu (Share placeholder, Change construction opening the existing dialog, Delete Build as a destructive item), absent for read-only builds.

  Add the `builds.views.*` and `builds.actions.*` keys. Verify component tests for the Build Detail Header scenarios and the read-only case
- [ ] 4.4 Add the view switcher (Steps, Map, Overview links with `aria-current`) under the summary strip, and change "Next up" to link to `/builds/<id>/steps/<key>`. Remove `BuildTabs`. Verify component tests and the Build Views scenarios in Playwright (default Steps view, reload keeps Overview)
- [ ] 4.5 Call `router.refresh()` after create, delete and the first saved step change of a visit (`StepStore.onSaved`), so the sidebar's recent builds update. Verify a Playwright test that completing a step in an older build moves it to the top of the sidebar

## 5. Steps checklist

- [ ] 5.1 Build the Steps view:
  - "Ready now" in template order, or "All steps done";
  - one folding section per group with name and "<completed>/<total>", unfolded when it holds a ready step;
  - rows with number, label, state and completion badge, linking to the step screen.

  Verify component tests for the three Steps Checklist scenarios, and an axe check that sections are disclosure buttons with `aria-expanded`

## 6. Build map and part flows

- [ ] 6.1 Build the Map view:
  - Parts and Assembly tiles from `groupGraph`, each with name, count, a state style from the existing ready, completed and idle tokens, and a "from …" line;
  - the three-state legend;
  - "Loading map..." until the step state is ready.

  Verify component tests for the Build Map and Ready Steps scenarios and the French tile names
- [ ] 6.2 Build the part flow page:
  - a header with the group name, "<c> / <t> done", previous and next group controls, and a return control to the map;
  - rows as CSS grids, with an SVG connector layer and skip edges drawn in the gutter (design decision 6);
  - "Comes from" and "Leads to" links;
  - step boxes linking to `/builds/<id>/steps/<key>?from=<group>`, with the variant highlights kept.

  Verify component tests for the Part Flow scenarios and Diagram Interaction Restrictions (no drag handles, activation navigates)
- [ ] 6.3 Verify the 360 px fit with a Playwright test at a 360 × 740 viewport: for every group of a build whose type is not set and that has a BOBO neck, `scrollWidth <= clientWidth` and every step label is visible. Take one screenshot of the Body finish setup flow and check the gutter skip edge by eye before ticking

## 7. Step screen

- [ ] 7.1 Turn `StepDialog` into `StepScreen`:
  - "Step n", the group name, the title with its completed check, `StepContext` (linked steps), Notes, `StepPhotos` and `StepMeasurements`;
  - no info hint;
  - read-only without completion controls.

  Keep the photo lightbox, delete confirmations and tap-tone capture as modals. Verify the existing photo and measurement component tests still pass against the screen, plus new tests for Step Context rendering and the read-only case
- [ ] 7.2 Add the footer:
  - Previous and Next, disabled at the ends;
  - "Done, next step" when not completed;
  - "Mark as Incomplete" when completed, which stays on the screen.

  Navigation uses `router.replace` and carries `from`, and `store.flushNotes` runs before leaving. Verify component tests for Step Completion Tracking and Step Navigation, and a Playwright test that ten Next presses leave a single history entry before the build page
- [ ] 7.3 Lay out `steps/[key]/page.tsx`:
  - below 1024 px, full screen with the fixed bottom footer and its own compact bar; the build page bar, the summary strip and the tab bar are hidden;
  - from 1024 px, the checklist with the current row highlighted beside a sticky step panel.

  The return control goes to `?from` or to the Steps view. Verify Playwright tests for the Step Screen scenarios at 390 px and 1280 px, including the return to the Top panel part flow

## 8. Removal and cleanup

- [ ] 8.1 Delete `SequenceDiagram`, `StepNode` (and its test), `SequenceLegend`, `viewport.ts`, `lib/sequence/layout.ts` (and its test), `BuildTabs` and `BuildHeader`. Remove `@xyflow/react` and `@dagrejs/dagre` from `apps/web/package.json`. Verify `pnpm install`, `pnpm typecheck` and that `grep -r "xyflow\|dagre" apps/web/src` finds nothing
- [ ] 8.2 On the first visit to any build page, remove every `localStorage` key starting with `gb-viewport:` once (guarded by try/catch). Verify a unit test of the cleanup function
- [ ] 8.3 Remove `sequence.hint`, `sequence.controls.*` and the old tab keys from both catalogs. Verify the i18n tests pass and that `grep` finds no use of the removed keys

## 9. End-to-end and integration

- [ ] 9.1 Rewrite `e2e/builds.spec.ts` and `e2e/sequence.spec.ts` for the views, part flows and step screens. Port each existing test (completion, notes autosave, photos, measurements, variant change, deletion, administrator read-only, deep links), and add a French run of the Steps view, the map and a step screen. Verify `pnpm test:e2e` passes
- [ ] 9.2 Run `pnpm check`, `pnpm build`, `pnpm test:e2e` and `openspec validate workbench-shell-and-steps --strict` from a clean install. Verify all pass
- [ ] 9.3 Check both themes on the new screens (tab bar, sidebar, You, Tools, checklist, map, part flow, step screen) at 390 px and 1280 px. Verify that every text and background pair used is in `contrastPairs` and that the contrast test passes
- [ ] 9.4 Update `README.md` (navigation and URLs) and `docs/rewrite/README.md` (what the redesign changed and why, linking the proposal page). Verify that the links resolve
