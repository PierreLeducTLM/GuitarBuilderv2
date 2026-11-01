# Guitar Builder rewrite: specs and legacy audit

> The legacy app lives in [PierreLeducTLM/GuitarBuilder](https://github.com/PierreLeducTLM/GuitarBuilder) at commit `3dcaed9`. The `path:line` references in `legacy-findings/` point into that repository, not this one.

This folder goes with the OpenSpec specs in [`openspec/specs/`](../../openspec/specs). The specs were extracted on 2026-11-01 from the legacy implementation at commit `3dcaed9`. They are meant to be the source of truth for re-implementing the app.

- **The specs** describe what the system must do: behavior, rules, formulas and data. They don't depend on any framework. Where the legacy code was buggy, the spec states the evident intent rather than the bug. Every such choice is listed below or in the findings files.
- **The findings** in [`legacy-findings/`](legacy-findings) record what the legacy code actually does:
  - dead code;
  - bugs and inconsistencies;
  - security and data-integrity problems;
  - open questions for the product owner.

  Each item has `path:line` references into the legacy code.

All 14 specs (401 requirements) pass `openspec validate --specs --strict`. The owner's decisions of 2026-11-01 are applied (see [Owner decisions](#owner-decisions-2026-11-01)).

## Capability map

| Capability | What it covers | Reqs | Findings |
|---|---|---:|---|
| [`app-shell`](../../openspec/specs/app-shell/spec.md) | Sections and URLs, admin-only sections, desktop and mobile navigation, theme, EN/FR language, confirmation dialogs and toasts | 27 | [app-shell-auth-admin](legacy-findings/app-shell-auth-admin.md) |
| [`user-auth`](../../openspec/specs/user-auth/spec.md) | Sign up, sign in, sign out, sessions, profiles, roles (first account becomes admin), data isolation, admin access across users | 23 | same |
| [`admin-console`](../../openspec/specs/admin-console/spec.md) | User list and stats, role changes, user deletion and what it cascades to, AI prompt template setting, default wood panels | 25 | same |
| [`guitar-builds`](../../openspec/specs/guitar-builds/spec.md) | Builds list, create (name, guitar type, BOBO neck), detail tabs, changing the variant, delete, ownership | 18 | [builds-sequence-story](legacy-findings/builds-sequence-story.md) |
| [`build-sequence`](../../openspec/specs/build-sequence/spec.md) | Per-build process diagram: the full default template (132 steps in 15 groups, 144 links, English and French labels), steps hidden by variant, completion, notes, photos, attached tap-tone measurements | 45 | same |
| [`build-story-sharing`](../../openspec/specs/build-story-sharing/spec.md) | Share links, the public story page at `/story/:token`, live update notifications | 24 | same |
| [`build-acoustic-analysis`](../../openspec/specs/build-acoustic-analysis/spec.md) | FFT analyzer on a build: microphone or file input, settings, display, resonance and damping modes, air/top/back resonance identification, saved and overlaid results | 27 | [build-acoustic-analysis](legacy-findings/build-acoustic-analysis.md) |
| [`acoustic-signal-analysis`](../../openspec/specs/acoustic-signal-analysis/spec.md) | Math for the analyzer: windows, dBFS, peak hold, peak detection, parabolic interpolation, Q-factor, logarithmic decrement, body resonance identification | 16 | same |
| [`tap-tone-capture`](../../openspec/specs/tap-tone-capture/spec.md) | Microphone tap-tone dialog used by wood panels and build steps: capture, 30 Hz high-pass, framing, peak picking, export, stored spectrum record | 36 | [tap-tone-capture](legacy-findings/tap-tone-capture.md) |
| [`wood-panel-properties`](../../openspec/specs/wood-panel-properties/spec.md) | Tonewood calculator (density, E_L, E_C, G_LC, target thickness, estimated mass), saved and default panels, PDF report, AI wood analysis | 42 | [wood-panels-simulator](legacy-findings/wood-panels-simulator.md) |
| [`guitar-simulator`](../../openspec/specs/guitar-simulator/spec.md) | Gore 4-degree-of-freedom body response model: parameters, presets, plots, import and export | 27 | same |
| [`reference-library`](../../openspec/specs/reference-library/spec.md) | Admin-curated Markdown and LaTeX reference documents, figures, chunking and indexing for search | 45 | [references-chat](legacy-findings/references-chat.md) |
| [`knowledge-assistant`](../../openspec/specs/knowledge-assistant/spec.md) | Retrieval-augmented chat: conversations, retrieval, answers in the user's language, sources, the shared "ask" entry point | 30 | same |
| [`legacy-data-migration`](../../openspec/specs/legacy-data-migration/spec.md) | One-time import of all legacy data: stable IDs and share links, guitar type inference, FFT dB conversion, wood panel recalculation, re-indexing, migration report, dry run | 16 | all of the above |

## How to use this with Claude Code

OpenSpec is initialized in this repo with the Claude Code workflow commands in `.claude/`. To build the new app:

1. Copy `openspec/` (and `.claude/` if you want the commands) into the new repository, or work in place.
2. Settle the open questions below and in each findings file. Update the specs where your answer differs from what was assumed.
3. Implement one capability at a time:
   - `/opsx:propose "implement user-auth"` creates a change with proposal, design and tasks;
   - `/opsx:apply` implements it;
   - `/opsx:archive` merges it back.

   A sensible order:
   - `user-auth` and `app-shell` first;
   - then `guitar-builds` and `build-sequence`;
   - then `tap-tone-capture` and `wood-panel-properties`;
   - then the analysis, library, assistant, simulator and sharing capabilities;
   - `legacy-data-migration` last, once the new data model is stable.
4. Use [`measured-elasticity-dataset.json`](../reference-data/measured-elasticity-dataset.json) (28 measured plates) as test fixtures for `wood-panel-properties`. Use the reference outputs listed in the simulator findings to check `guitar-simulator`.

## Chosen stack (2026-11-01)

The rewrite lives in a **new repository**, with `openspec/` copied over. The stack is also recorded in `openspec/config.yaml`, so every OpenSpec change sees it.

| Layer | Choice |
|---|---|
| Repo layout | pnpm monorepo: `apps/web`, `packages/dsp`, `packages/ui`, `packages/db` |
| App framework | Next.js (App Router) + React + TypeScript (strict), hosted on Vercel. Shared story pages render on the server, with link previews. |
| Data, sign-in, files, live updates | Supabase (Postgres + pgvector, Auth, Storage, Realtime). Every access rule is a database policy with pgTAP tests. |
| AI | Google Gemini, kept by owner decision. Embeddings use `gemini-embedding-2` at 768 dimensions. Answers use a current Gemini Flash model, whose ID is a configuration setting. |
| Signal processing | `packages/dsp`: one pure-TypeScript engine shared by the tap-tone dialog, the build analyzer, the wood calculator and the simulator |
| Visual layer | Tailwind CSS v4 with custom design tokens, Radix primitives, Motion. Spectra are drawn on canvas; the build diagram is custom SVG with automatic layout. The design is new and bespoke. |
| Languages | next-intl (English, French) |
| Quality | Vitest (math and DSP), Playwright (desktop and phone flows), pgTAP (access rules), GitHub Actions |

**The legacy app's AI features are probably down right now.** It calls Google's `text-embedding-004`, shut down on 2026-01-14, and `gemini-2.0-flash-exp`; Gemini 2.0 Flash was shut down on 2026-06-01. The chat, the wood analysis and re-indexing cannot work against those models ([Gemini deprecations](https://ai.google.dev/gemini-api/docs/deprecations), [release notes](https://ai.google.dev/gemini-api/docs/changelog)). The rewrite's migration re-indexes every document with `gemini-embedding-2`. The retrieval similarity threshold is now a setting (default 0.5), because it has to be re-tuned for the new embedding model.

## Design direction (2026-11-01)

The owner chose **Oscilloscope**, a dark instrument panel, from the three concepts at https://claude.ai/artifact/M1hH26F23oyJEXW3xwao8U (row C).
- **Look:** amber phosphor traces on graticule grids, teal for completed steps, LED-segment progress.
- **Type:** Space Grotesk for words, JetBrains Mono for numbers.
- **Light theme:** a light counterpart with the same color roles.

The tokens are recorded in `openspec/config.yaml`. The owner also accepted three ideas from the concepts, now specified:
- a **Ready** step state (`build-sequence`);
- **step numbers** on the diagram (`build-sequence`);
- a **summary strip** with progress, the latest measurement and "Next up" (`guitar-builds`).

## Places where the specs intentionally differ from the legacy app

Review these first. Each one changes behavior compared with what users see today.

**Numbers and measurements**
- **Cross-grain modulus.** The spec uses `E_C = 0.94146·ρ·W⁴·f_C²/h²` (sample *width*). It reproduces all 28 plates in the measured dataset. The legacy `L⁴/42` formula reproduces only 2 of them. Existing panels' E_C values, and the target thickness and mass derived from them, were computed with the wrong formula.
- **Build analyzer dB scale.** The spec uses true dBFS, where a full-scale sine reads 0 dB, and applies the selected window. Legacy applied the log conversion twice and ignored the window setting. Saved legacy spectra need converting; the formula is in the acoustic findings.
- **Build analyzer algorithms.** The spec defines:
  - a relative peak threshold;
  - peak detection limited to the selected frequency range;
  - analysis of the whole loaded file;
  - no Q-factor when the bandwidth crossing isn't found;
  - correct frequency and units in the logarithmic decrement;
  - re-arming between repeated taps in resonance mode.

  Legacy had a bug in each of these. The analyzer also gains optional identification of the air, top and back body resonances, which legacy never had.
- **Tap-tone dialog.**
  - The live waveform display works (it never drew in legacy).
  - Cents are rounded to the nearest value.
  - Uploaded files are resampled to 48 kHz.
  - All text is localized.
- **Simulator.**
  - Top and back area ranges are 200–2000 cm², so the defaults are within range.
  - Typed values are clamped to their range.
  - Empty entries are ignored instead of producing invalid results.

**Access and roles**
- **Admins can view but not change user data.** Admins see only their own builds, conversations and panels in the Builds, Chat and Wood Props sections. They can open other users' data read-only, through the admin console or a direct link, and the server refuses any change. The only admin actions affecting another user are changing their role and deleting their account. Legacy showed admins everyone's builds and conversations, and let them change or delete any record.
- **Defaults and settings.**
  - The AI prompt template applies to all users; in legacy only admins could read it.
  - Default wood panels are loaded on demand, not copied at sign-up, and the admin text now says so.
  - The default-panel source account is chosen by the operator; legacy hard-coded a personal email.
  - Syncing defaults is all-or-nothing.

**Builds**
- **No model name, width or length.** A build has a name, a guitar type (classical or steel-string) and a bolt-on/bolt-off (BOBO) neck choice. The legacy creation form only asked for a name, though the detail page still showed the old fields.
- **Steps that don't apply are hidden.** Classical builds hide the 12 steel-string-only steps; steel-string builds hide the 12 classical-only steps; builds without a BOBO neck hide the 6 BOBO steps (the loose-tenon and heel bolt-bar steps) and, on classical builds, the 2 BOBO-slat steps. The diagram bridges arrows around hidden steps. Progress and the public story count only the steps that apply, for example "30 of 120 steps". Hidden steps keep their data, which reappears if the variant changes back.

**Sequence, story and chat**
- **Sequence and story.**
  - Notes are saved without losing quick successive edits.
  - A build's photos are deleted with the build.
  - Sharing state stays consistent, so a stale screen can no longer silently replace a share link.
  - Story notifications fire only when the step count goes up.
- **Chat.**
  - Sources belong to their own answer.
  - Errors during streaming are shown.
  - No empty conversation is created when nothing relevant is found.
  - Sources are clickable links only for admins.
  - Answers are written in the user's interface language (English or French), even when the references are in English. The AI wood analysis does the same.

**Everywhere**
- **Localization and preferences.**
  - Every user-visible string is available in English and French. Legacy hard-coded much of it in English, including the 132 step labels, now translated in `build-sequence`.
  - Theme and language can be changed on mobile too.
  - The stored theme applies to every screen, including sign-in and the public story page.

## Not carried over (dead code in legacy)

These exist in the code but are never reachable. They are described in the findings so you can decide whether to bring them back:

- **Instagram publishing.** A post wizard and its database tables. No OAuth flow and no publisher were ever built.
- **Retrieval figures and filters.** A gallery of figures found by retrieval, a selector to limit chat retrieval to chosen documents, and a separate conversation-list component.
- **Admin per-user statistics.** Per-user resource counts and cross-user browsing (`adminHelpers.ts`).
- **Tap-tone extras.** Microphone calibration with noise subtraction, removed in `e8b0e4e`; the old algorithm is documented. Also Gaussian spectrum smoothing, which could never be switched on.
- **Wood panel → build link.** The database field exists, but nothing sets or reads it.
- **Simulator parameters.** Several are declared but ignored by the model: damping, coupling coefficients, excitation amplitude, superimposed sources and sound-hole diameter.

## Security problems in the live legacy app

These affect the deployed app today, independent of the rewrite. The rewrite specs require each rule to be enforced on the server.

1. **Saved FFT results are open to everyone.** Anyone holding the public client key, signed in or not, can read, insert, modify and delete them. The original "anyone can …" policies were never dropped.
2. **Every shared build is exposed.** The policy for reading shared builds is always true (`share_token = share_token`). Anyone can list every shared build with its token and full contents. Signed-in users also see other users' shared builds in their own list.
3. **Step-photo storage is too open.**
   - Any signed-in user can upload to or delete any path.
   - Anonymous clients can list every photo of every build.
   - There are no server-side type or size limits.
4. **Self-promotion to admin.** A user whose profile row is missing can create it themselves with the admin role. Profile creation at sign-up fails silently, and two simultaneous first sign-ups can both become admin.
5. **Reference library poisoning and stored XSS.**
   - Any signed-in user can write reference documents and search passages through the API.
   - The Markdown renderer injects unescaped HTML, for both reference content and LLM answers.
6. **Image-upload server function** (`upload-reference-images`). It has no admin or ownership check, so any signed-in user can:
   - make the server fetch arbitrary URLs (SSRF);
   - overwrite other documents' figures.
7. **Instagram tokens (latent).** `get_due_scheduled_posts` can be called by anyone and would return every user's Instagram access token. The tables are empty today; drop them.
8. **No usage limits.** The LLM and embedding endpoints have no rate limits or quotas.

## Data migration notes

The migration itself is specified in [`legacy-data-migration`](../../openspec/specs/legacy-data-migration/spec.md). Background on the legacy data:

- **Missing schema.**
  - No current migration creates the build `sequence_diagram` column; its migration was deleted in `9901653`.
  - The `step-photos` bucket and the realtime publication for builds were set up by hand.
  - A database built from the migrations alone cannot create builds.
- **Legacy data needing conversion.**
  - Wood panel spectra are keyed `freqLongitudinal`, `freqCrossGrain` and `freqDiagonal`. The migration comment names different keys.
  - Saved FFT results use the double-log dB scale (see above).
  - Panels' E_C, target thickness and estimated mass were computed with the wrong E_C formula.
- **Embeddings.** The search index is 768-dimensional, generated with Google `text-embedding-004`. The dimension changed 1536 → 768 → 384 → 768 across migrations. The chat tables were dropped and re-created on 2025-10-14, so earlier history is gone.
- **Deleting a user deletes their reference documents.** The whole shared library depends on its author's account. Decide whether documents should survive their author.

## Recommendations for the rewrite

- **Build one signal-processing engine.** Legacy has two:
  - the tap-tone dialog uses a fixed Hamming window, 2/N scaling, no sub-bin interpolation and a 10-bin prominence;
  - the build analyzer uses a selectable window, coherent-gain dBFS and parabolic interpolation.

  By owner decision the tap-tone dialog keeps nearest-bin peaks (2.93 Hz at 48 kHz) and gets no calibration; a shared engine is still worth building for the transform, windows and dB scale.
- **Generate the step template from one source.** It is duplicated in 4 places in legacy. The template's keys, labels, arrows and variant applicability in `build-sequence` are complete enough to generate it.
- **Enforce access rules on the server first.** Most legacy security holes come from relying on the UI.

## Owner decisions (2026-11-01)

| Question | Decision | Specs changed |
|---|---|---|
| Should admins keep write access to other users' data? | No. Admins can view but not change user data. | `user-auth`, `admin-console`, `guitar-builds`, `build-sequence`, `build-acoustic-analysis`, `wood-panel-properties`, `knowledge-assistant` |
| Bring back model name, width and length on builds? | No. They are removed from builds. | `guitar-builds`, `build-story-sharing`, `legacy-data-migration` |
| Should a build choose its variant and hide steps that don't apply? | Yes. | `guitar-builds`, `build-sequence`, `build-story-sharing`, `legacy-data-migration` |
| Should answers follow the user's language? | Yes, the interface language. | `knowledge-assistant`, `wood-panel-properties` |
| Convert old spectra and recompute E_C and derived values? | Yes, migrate the data. | new `legacy-data-migration` |

How the decisions were interpreted, in case any of these is not what you meant:
- **Admin account deletion is kept.** Deleting a user account still removes that user's data; it is treated as account management rather than editing user data.
- **The variant is two choices.** Guitar type (classical or steel-string, required) and BOBO neck (a checkbox, checked by default). Step applicability follows the template's "CL", "SS" and "BOBO" prefixes and the two bridge branches.
- **Legacy model name, width and length are dropped during migration.** The migration report lists every build that had values, so nothing disappears silently.
- **Migrated builds get an inferred guitar type.** It comes from which variant-specific steps have data, or is "not set" (all steps shown) until the owner chooses. Every migrated build keeps a BOBO neck, so no step it had disappears.
- **Answers use the interface language,** not the language the question was typed in.

### Second round

| Question | Decision | Specs changed |
|---|---|---|
| Should the build analyzer identify air, top and back resonances? | Yes, if reliable. | `acoustic-signal-analysis`, `build-acoustic-analysis`, `legacy-data-migration` |
| Bring back tap-tone calibration and sub-bin interpolation? | No. | none (the dialog spec already had neither) |
| Should wood panels link to builds or feed the simulator? | To be decided. | none |
| Should the heel bolt-bar steps apply only with a BOBO neck? | Yes. | `build-sequence`, `build-story-sharing` |
| Is the missing component → assembly wiring intended? | No, so it was added. | `build-sequence` |
| Who writes the French step labels? | Claude. | `build-sequence` |

Please review these, because they are content choices rather than code facts:
- **Resonance identification parameters.**
  - The identification runs only when the user switches on "Identify body resonances" (off by default), because a free-plate spectrum would otherwise be mislabelled.
  - Roles follow mode order:
    - Air is the lowest strong peak from 70 to 130 Hz;
    - Top is the next one, from max(140 Hz, 1.4 × air) up to 300 Hz;
    - Back is the next one, at least 15 Hz above Top and up to 400 Hz.
  - A role is "Not identified" whenever any of these gates fails: no candidate in range, Q not determinable, a second candidate within 15 Hz, or resolution coarser than 3 Hz.
  - Saved results store air, top and back (frequency, amplitude, Q) when identified.
- **New template wiring.** 21 arrows now join the component groups to the assembly groups, and "SS cut bridge plate blank" now leads to "SS shape bridge plate". The template now has 144 arrows, 10 starting steps (one per component group) and one final step:
  - truss rod, fretboard and neck feed "Assemble neck, rod, fretboard", and the neck also feeds the heel chain;
  - the braces feed the top and back bracing steps;
  - the braced top and back, the sides in the mould, the linings and the head and tail blocks feed body assembly;
  - the bound body feeds "Pre-fit neck" and body finishing, and the heel mortise feeds the BOBO loose-tenon steps;
  - the finished neck, the bridges and the nut and saddle feed final assembly through "Fix neck to body" and "Fit nut and saddle".
- **Body assembly order reversed.** The legacy chain began with "Bind body" and had "Glue mass blocks" before "Make mass blocks" and "Glue top panel" before "Check-fit top panel"; it now runs:
  1. Fit top and back
  2. Glue top and back linings
  3. Make mass blocks and side splices
  4. Glue mass blocks & side splices
  5. Dome sides for top & back
  6. Fit & glue head & tail blocks
  7. Glue on back panel & trim
  8. Check-fit top panel
  9. Glue on top panel & trim
  10. Bind body, fit butt strip

  Check step 6 in particular: head and tail blocks are often glued before the linings.
- **Hidden-step bridging.** A bridging arrow is now left out when its target is already reachable through other arrows, so hiding steps doesn't add redundant shortcuts.
- **French step labels.** All 132 labels use standard French lutherie terms ("table d'harmonie", "éclisses", "contre-éclisses", "tasseau supérieur", "sillet de tête", "chevalet"). The codes CL, SS and BOBO are kept as is. A francophone luthier should review the wording, especially where France and Québec usage differ.

## Still open

1. Should wood panels link to builds or feed the simulator?
2. Is the reversed body-assembly order right, including where "Fit & glue head & tail blocks" sits?
3. Do the French step labels need terminology changes?
4. Are the resonance identification bands and gates right for your guitars? For example, should classical and steel-string builds use different bands, now that each build has a guitar type?

The other open questions are at the end of each findings file.
