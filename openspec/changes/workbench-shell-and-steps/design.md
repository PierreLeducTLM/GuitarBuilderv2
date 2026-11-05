# Design

## Context

Motivation and scope are in proposal.md. The requirements are in this change's deltas for `app-shell`, `guitar-builds` and `build-sequence`.

Current state that shapes the approach:
- **Shell.** `components/shell/AppShell.tsx` renders three forms of `NavEntries` (desktop bar, slide-out list, bottom tabs) from `lib/routes.ts`. The `(shell)/layout.tsx` server layout loads the session, and the `(admin)` layout applies the admin-only rule.
- **Access gate.** `src/proxy.ts` calls `classifyPath()` and sends unknown paths to `/builds`. Every new URL in this change must be classified there, or it will be redirected.
- **Build page.** `builds/[id]/page.tsx` loads the build on the server. The client `BuildDetail` creates the `StepStore` (`useStepStore`), keeps the tab and the open step in component state, and renders the React Flow `SequenceDiagram` and the modal `StepDialog`.
- **Step data.** It is already modelled as pure functions in `lib/sequence/`: the template, variant display graph, state, progress and `nextUp`. All step writes go through `update_build_step`. No database work is needed.
- **Measured template facts that the design relies on**, computed from `template.ts` for every variant:
  - a group's part flow has at most 3 steps side by side (End blocks and linings) and at most 17 steps (Bridge, when both branches show; 9 in any one variant);
  - the groups that feed each other are the same in all six variants;
  - assembly groups ordered by depth are Neck assembly, Body assembly, Heel assembly, Body finish setup, Final assembly.

## Goals / Non-Goals

**Goals:**
- One navigation per viewport, with the four destinations, `/tools` and `/you`.
- A build page whose views, part flows and steps all have URLs, sharing one step store, so that notes typed on one screen are never lost when moving to another.
- Part flows rendered without a canvas library. Every layout decision is a pure, unit-tested function of the display graph.
- No change to data, policies, the step function or any access rule.

**Non-Goals:**
- No new tokens and no type-scale pass on existing screens (slice 5). New components use the existing tokens and Tailwind scale, with page titles at `text-2xl`/`text-3xl` rather than `text-5xl`.
- No change to the builds list content (slice 3) or the wood calculator layout (slice 4).
- No keyboard shortcuts for step navigation.
- No realtime refresh of the sidebar's recent builds.

## Decisions

### 1. A build layout owns the data and the step store; views are child routes

The routes under `app/(shell)/builds/[id]/` are:

| Route | Shows |
|---|---|
| `layout.tsx` | Loads the build and decides `canEdit`, like today's page. Renders a client `BuildProvider`, which holds the build, the variant, the `StepStore` and the display graph. |
| `page.tsx` | Steps view |
| `map/page.tsx` | Build map |
| `map/[group]/page.tsx` | Part flow |
| `overview/page.tsx` | Construction section and the acoustics placeholder |
| `steps/[key]/page.tsx` | Step screen |

- App Router keeps a layout mounted across navigation between its children. The store and its pending note saves therefore survive moving between views and steps.
- The pages are thin client components that read `useBuild()`.
- `BuildProvider` renders the page bar and the summary strip once, above `{children}`.

**Alternatives considered:**
- Query-string views (`?view=map&step=X`) on one page: one route file, but less readable URLs, and Back behaves like a tab switch instead of a page change.
- Intercepting/parallel routes for the desktop step panel: they fit modals, not a split pane that must also work as a standalone screen on phones.

### 2. Invalid group and step URLs are checked on the server and again on the client

- `map/[group]` and `steps/[key]` validate the parameter on the server against the template and the stored variant. An unknown key or a step hidden by the variant leads to `redirect('/builds/<id>')`, which is a replace on a server-rendered request.
- The variant can change on the client ("Change construction") without a server round trip. So `BuildProvider` also checks after every variant change: if the current step is no longer displayed, it calls `router.replace` to the Steps view.

### 3. The access gate learns the new paths

`classifyPath` accepts the following as `section`:
- `/builds/<id>` followed by nothing, `/map`, `/map/<group key>`, `/overview` or `/steps/<step key>`;
- `/tools` and `/you`.

Keys are matched by shape only: `[a-z-]{1,40}` for groups and `[A-Za-z0-9]{1,64}` for steps, like `update_build_step`. Template membership is checked by the pages (decision 2), which keeps the proxy independent of the template module. `safeNextPath` inherits the rule, so sign-in returns to these URLs.

### 4. Shell: one component tree, CSS breakpoint at `lg` (1024 px)

`AppShell` renders the following:
- **`Sidebar`** (`hidden lg:flex`). It contains the title link, the destination entries with their sections, `RecentBuilds`, the admin entries and the account link to `/you`.
- **`TabBar`** (`lg:hidden`). It has four entries and is hidden by the shell when `usePathname()` matches `/builds/<id>/steps/`.
- **`PageBar`**. Pages render it themselves so that each owns its title, return control and actions. A shared `PageBar` component in `components/shell/` keeps it consistent.

Navigation data moves from the flat `sections` list in `lib/routes.ts` to a `destinations` structure: each destination has an id, an href, an icon, child sections and `adminOnly`. Two pure functions read it:
- `activeTab(pathname)` returns the destination that holds a URL; it is used by the tab bar;
- `activeEntry(pathname)` returns the most specific entry; it is used by the sidebar.

The You page reuses `LanguageSwitcher`, `ThemeSelector` and `useSignOut`. `UserMenu` and the shell's use of `Sheet` are deleted. `Sheet` stays in `@gb/ui` for later use.

**Alternative considered:** separate mobile and desktop layouts chosen by user agent. It is fragile with resizing and tablets. One tree with CSS breakpoints matches the existing approach and the e2e viewport tests.

### 5. Recent builds come from the shell layout

`(shell)/layout.tsx` adds one query: `listRecentBuilds(userId, 5)`, which selects `id, name` from the user's builds ordered by `updated_at desc`.
- It goes through the existing owner-only RLS, plus an explicit `owner_id = userId` filter, so administrators see only their own builds.
- The layout is not re-rendered on client navigation. The build page and the create and delete flows therefore call `router.refresh()` after a change that affects the list: creating, deleting or renaming a build, and the first step change of a visit.
- The `StepStore` exposes an `onSaved` callback for the last of these.

### 6. Part-flow layout is a pure function; connectors are SVG in percentage space

`lib/sequence/groups.ts` defines each group's id (1 to 15), its URL key and its message key, with names in the catalogs (`groups.<key>`). Pure functions in `lib/sequence/`:
- `groupGraph(displayGraph)`: groups with their displayed steps, completed and total counts, state, and feeding groups. It drives the build map and the checklist sections.
- `partFlow(displayGraph, groupId)` returns:
  - `rows`: steps layered by longest path from the group's internal predecessors, in template order within a row;
  - `edges`: internal arrows, each with its row and column span;
  - `entries` and `exits`: cross-group arrows, each naming the other step and group.
- `stepContext(graph, key)`: the predecessors and successors used by Step Context.
- `stepNeighbours(graph, key)`: previous and next steps in template order. `nextAfterDone(graph, states, key)`: the rule in Step Navigation.

Rendering:
- Each row is a CSS grid with as many equal columns as the row has steps. Step boxes have a fixed minimum height and labels clamped to 3 lines.
- One SVG behind the rows uses `viewBox="0 0 100 <rows>"` with `preserveAspectRatio="none"` and `vector-effect: non-scaling-stroke`. Connectors run from a column centre at the bottom of one row to a column centre at the top of a later row.
- An edge that skips a row is drawn as a bracket in the right-hand gutter, so it never passes behind a box.
- All positions come from the pure output, so tests check structure (rows, columns, spans) instead of pixels. The 360 px fit is checked by a Playwright test at that width: no horizontal scroll, every label visible.

`@xyflow/react`, `@dagrejs/dagre`, `layout.ts`, `viewport.ts`, `SequenceDiagram`, `StepNode` and their tests are removed. Removed requirements are not kept as dead code.

**Alternatives considered:**
- Keep React Flow per group with pan and zoom disabled: it is about 100 kB of canvas machinery for at most 17 boxes, and its accessibility labels had to be blanked.
- Dagre top-to-bottom per group: unnecessary for layer widths of 3 or less, and its output is harder to assert in tests.

### 7. Step screen: one component, two placements

`StepScreen` contains the header, `StepContext`, Notes, `StepPhotos`, `StepMeasurements` and a footer with Previous, the completion action and Next. It is today's `StepDialog` content without the modal.

| Viewport | Placement |
|---|---|
| Below `lg` | `steps/[key]/page.tsx` renders it alone, with the footer fixed at the bottom (`pb-[env(safe-area-inset-bottom)]`). The provider hides the summary strip and the build page bar, and the screen shows its own compact bar: return control, "Step n of N", group. |
| `lg` and wider | The page renders a two-column grid: the Steps checklist with the current row highlighted, and `StepScreen` in a sticky panel. |

Navigation between steps:
- Previous, Next and "Done, next step" use `router.replace`. A run through ten steps adds one history entry, not ten.
- The return control is a link to its origin. The origin is `?from=<group key>` when the step was opened from a part flow; otherwise it is the Steps view. The link carries `from` through Previous and Next.
- Before any navigation away from a step, `store.flushNotes(key)` runs, as `StepDialog.close()` does today.

`DialogFrame` modals that stack on the step (photo lightbox, delete confirmations, tap-tone capture) stay modals.

### 8. Messages

New keys:
- `nav.*` for the four destinations and the "Wood panels" label;
- `you.*`, `tools.*`, `groups.*` (15 names in each language);
- `builds.views.*` and `builds.actions.*`;
- `sequence.map.*`, `sequence.flow.*`, `sequence.context.*` and `sequence.nav.*`.

Removed keys: `sequence.hint`, `sequence.controls.*`, the slide-out menu labels, `nav.short.*` and the old tab labels.

The existing catalog-parity test catches a key that is missing from one language. The French group names are those in Template Group Names; they reuse each component group's root-step label.

## Risks / Trade-offs

- [Two adjacent steps share the summary strip, but the step screen hides it on phones] → The step screen shows "Step n of N" and the group, and returning shows the strip again. This was accepted in the review.
- [`?from=` leaks into bookmarked step URLs] → It only changes the return target. An unknown value falls back to the Steps view.
- [The sidebar's recent builds can be stale after an edit in another tab] → It refreshes on navigation-triggered refreshes and full loads. Realtime is a non-goal.
- [Removing the full diagram loses the one-picture overview some users may have liked] → The build map is the overview. The owner explicitly asked to split the diagram.
- [The e2e suites for shell, mobile, builds and sequence are largely rewritten at once, which risks losing coverage] → The tasks port each existing test to its new form before deleting the old one. A coverage check confirms that every removed `test(` has a successor or is tied to a removed requirement.
- [Skip edges drawn in the gutter could confuse readers in group 12 (Body finish setup)] → A legend entry is not needed. The gutter bracket ends in the same arrowhead as other connectors. The Playwright screenshot review of that flow is listed in tasks.

## Migration Plan

- Front-end only; the change deploys as a normal release.
- Old bookmarks keep working: `/builds/<id>` opens the Steps view instead of Overview.
- The remembered diagram viewports in `localStorage` (`gb-viewport:<build id>`) are no longer read. A one-time cleanup removes those keys on the next visit, so they don't linger.
- Rollback: revert the release. No data was written in a new format.
