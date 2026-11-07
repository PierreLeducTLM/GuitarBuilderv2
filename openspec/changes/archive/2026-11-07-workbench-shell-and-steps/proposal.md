# Proposal

## Why

The owner finds the app confusing and the phone version unusable (redesign review, 4 Nov 2026, https://claude.ai/artifact/5cRorCUw4m8J1Sakfhy96F). On a phone, the bottom tab bar and the slide-out menu repeat the same six sections. The 114 to 132 steps of a build appear only as one pan-and-zoom diagram whose labels are unreadable when it is zoomed to fit. Each step opens in a dialog that closes when it is marked done. The owner confirmed three decisions:
- the phone is used propped on the bench during work, so this change ships the navigation and the step work first;
- the diagram is split into parts, on phones and desktops;
- the theme keeps following the device.

## What Changes

- **Four destinations instead of six sections (`app-shell`).**
  - Builds (home), Tools, Assistant and You. Wood Props and Simulator move under Tools, at a new `/tools` page. Chat is labelled Assistant and keeps `/chat`.
  - A new `/you` page holds the account, language, theme, sign-out and, for administrators only, links to References and Admin.
  - **BREAKING (spec):** the desktop header with its user dropdown and the mobile slide-out menu are removed.
    - On wide screens (1024 px or more), a left sidebar holds the destinations, the user's five most recently updated builds, the admin entries and an account entry.
    - On narrow screens, a four-item bottom tab bar is the only navigation.
  - Every page gets a page bar with its title, an optional way back, and its own actions.
- **Build page views (`guitar-builds`).**
  - The Overview and Sequence Diagram tabs become three views, each with its own URL so Back and reload keep it:
    - Steps (`/builds/<id>`), the default view;
    - Map (`/builds/<id>/map`);
    - Overview (`/builds/<id>/overview`).
  - Share, Change construction and Delete Build move into a "More actions" menu.
  - "Next up" opens the step's own screen.
- **Steps checklist (`build-sequence`).** "Ready now" lists every ready step. Below it, the 15 template groups appear as folding sections with their progress.
- **Split diagram (`build-sequence`).** **BREAKING (spec):** the single left-to-right pan-and-zoom diagram is replaced, along with its zoom range, fit-view control and saved viewport.
  - A build map shows the 15 groups as tiles, with progress, a ready marker and the groups that feed each tile.
  - Selecting a tile opens that group's part flow at `/builds/<id>/map/<group>`.
    - The steps are laid out top to bottom and are at most 3 steps wide.
    - Arrows leaving or entering the group become labelled links to the other group's flow.
- **Step screen (`build-sequence`).** **BREAKING (spec):** the step details dialog is replaced by a step screen at `/builds/<id>/steps/<step key>`.
  - On narrow screens it fills the screen, without the tab bar. On wide screens the step panel sits beside the Steps checklist.
  - It has the same Notes, Photos and Sound Analysis sections.
  - Instead of the repeated info hint, it shows what the step comes after and what it leads to.
  - It has Previous and Next controls and a "Done, next step" action. Marking a step complete or incomplete no longer closes the screen.
- **Group names become visible (`build-sequence`).** The 15 group names are shown in English and French; this change adds the French names.

Out of scope (later slices of the same review): the richer builds home ("Continue" card, progress on the list), the wood calculator's phone layout, the type-scale and hierarchy pass on existing screens, and keyboard shortcuts for steps.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `app-shell`:
  - Application Sections and URLs, Navigation Entry Presentation, Admin-Only Sections, Admin Entries Visually Distinguished, Mobile Bottom Tab Bar, Preferences Reachable On All Viewports and Sign Out From the Shell change to the four destinations, `/tools` and `/you`.
  - Desktop Header, Desktop User Menu and Mobile Slide-Out Menu are removed.
  - New requirements: Desktop Sidebar, Page Bar, Tools Page and You Page.
- `guitar-builds`:
  - Build Detail Header becomes a page bar with a "More actions" menu.
  - Build Detail Tabs becomes Build Views, with URLs.
  - The Build Summary Strip's "Next up" opens the step screen.
  - Build Deep Links and Inaccessible Build Links cover the new view, part and step URLs.
- `build-sequence`:
  - Sequence Diagram Display, Automatic Layered Layout, Diagram Interaction Restrictions, Default Step Template, Step Details Dialog, Step Completion Tracking, Step Completion Indicator, Ready Steps, Step Numbers and Sequence Localization change to the checklist, the build map, part flows and the step screen.
  - Diagram Pan and Zoom and Diagram Viewport Persistence are removed.
  - New requirements: Steps Checklist, Template Group Names, Build Map, Part Flow, Step Context and Step Navigation.

## Impact

- **App:**
  - a new shell (`components/shell/`): sidebar, bottom tab bar, page bar, You and Tools pages;
  - new routes under `app/(shell)/builds/[id]/` for `map`, `map/[group]`, `overview` and `steps/[key]`, plus `app/(shell)/you` and `app/(shell)/tools`;
  - `lib/routes.ts` classifies the new paths for the access gate and safe redirects;
  - new pure modules in `lib/sequence/`: groups and their names, the part-flow layering, the group graph of the build map, step context and step navigation;
  - the step dialog becomes a step screen component;
  - new message keys in `en` and `fr`, including 15 group names.
- **Removed:**
  - `SequenceDiagram`, `StepNode`, `viewport.ts`, `layout.ts`, `SequenceLegend` (replaced by a part-flow legend), `AppShell`'s header and menu sheet, and `UserMenu`;
  - the `@xyflow/react` and `@dagrejs/dagre` dependencies.
- **Data and security:**
  - no database, policy or API change; a new read of the user's five most recently updated builds for the sidebar, through the existing owner-only builds policy;
  - an administrator's sidebar lists only the administrator's own builds.
- **Tests:**
  - unit tests for the group names, part-flow layering, group graph, step context and step navigation against the spec's template;
  - Playwright `shell`, `mobile`, `builds` and `sequence` specs rewritten for the new navigation and URLs.
- **Other specs:**
  - `build-acoustic-analysis` keeps its "overview tab" wording, which now means the Overview view;
  - `knowledge-assistant` keeps `/chat`;
  - wording about the "step dialog" in photo and measurement requirements now refers to the step screen, as Step Details Dialog states.
