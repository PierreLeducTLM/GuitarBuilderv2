# Tasks

## 1. Math (`packages/dsp`)

- [x] 1.1 Implement `wood/properties.ts` (`woodProperties`, decision 4) and export it. Verify unit tests:
  - the spec's worked examples (defaults 425.2 kg/m³ and 8.86 GPa, 357.1 kg/m³, the unit cube, the reference spruce panel at 395.9 / 11.84 / 0.82 / 0.91 GPa / 2.77 mm / 157.5 g, and the 226.5 g mass example);
  - all 28 dataset plates for density, E_L, E_C and G_LC at the dataset's precision, with a comment on why the dataset's target columns are not used

## 2. Database

- [x] 2.1 Write the migration for the five result functions, `wood_panel_spectra_is_valid`, `public.wood_panels` (decision 1), its index and `updated_at` trigger, the RLS policies and column grants (decision 2). Write `supabase/tests/database/11_wood_panels_schema.test.sql` and `12_wood_panels_access.test.sql`:
  - blank-name, zero, negative, `NaN` and infinity refusals;
  - generated values for the reference spruce panel and two dataset plates;
  - spectra keys and record checks;
  - `updated_at` moving and `created_at` fixed;
  - owner CRUD;
  - other users and anonymous get nothing;
  - an administrator reads but cannot insert, update or delete;
  - owner, snapshot and timestamps not writable;
  - the cascade with the user.

  Verify with `supabase test db` (CLI 2.122.0) and `pnpm test:db` where pgTAP is installed
- [x] 2.2 Add `public.default_wood_panels` and `public.load_default_wood_panels()` (decision 3) to the migration. Write `13_default_wood_panels.test.sql`:
  - every user reads, and only administrators write;
  - copying into an empty library returns the count, and the copies are independent;
  - `null` for a non-empty library;
  - `0` for an empty set;
  - function settings and grants.

  Add a two-session concurrency check in the style of `scripts/test-db/first-admin-race.sh`, and run it from `pnpm test:db`. Verify both pass, and that the concurrency check fails with the lock removed
- [x] 2.3 Hand-write the two tables, the function and `WoodPanelSpectra` in `packages/db/src/database.types.ts`. Verify `pnpm --filter @gb/db test` and `pnpm typecheck` pass

## 3. Calculator logic (`apps/web/src/lib/wood/`)

- [x] 3.1 Implement the defaults, `parseInputs`, `validateInputs` (the ten message keys), result formatting (1 and 2 decimals in the user's locale) and the PDF file-name function. Verify unit tests:
  - the default strings;
  - empty and non-numeric as missing;
  - "Sample length must be greater than 0" and the stiffness message;
  - the error clearing when fixed;
  - "2.77 mm" and "157.5 g";
  - "Sitka 3-4- top_2026-03-14.pdf" with a local date that differs from UTC

## 4. Fake Supabase server

- [x] 4.1 Extend `apps/web/e2e/fake-supabase.ts` with:
  - `wood_panels` (list with owner filter and order, single by id, insert, update and delete returning, snapshot computed with `@gb/dsp`);
  - `default_wood_panels` select;
  - `rpc/load_default_wood_panels` with the same return values;
  - seeding and failure switches under `/__test/*`.

  Verify the existing end-to-end suite still passes

## 5. Page and library

- [x] 5.1 Build `/wood-properties` as a Server Component reading the library (decision 5), with `loading.tsx`, the "Failed to load wood panels" state, and the page layout of decision 8 with its three area titles in both catalogs. Verify end-to-end tests for the library order, the load failure (no empty state and no "Load Default Panels"), and an administrator seeing only their own panels
- [x] 5.2 Build the input area: the four groups, ten fields with symbols, units, hints, defaults and `step` 0.1, the validation messages and invalid styling, and "Reset to defaults". Build the results area: the three groups with their precisions, the prominent thickness, and "Please fix input errors to see results". Verify end-to-end tests for:
  - the defaults and their results;
  - real-time recalculation to 357.1 kg/m³;
  - a zero length hiding the results and showing its message;
  - reset after loading a panel;
  - the French labels "Mesures d'entrée" and "Enregistrer le panneau"
- [x] 5.3 Build the save form and library actions:
  - the name field with its placeholder;
  - Save, and Update when a panel is loaded, with "Saving..." and the double-click guard;
  - the success and failure messages, and the save outcome (name cleared, nothing selected, inputs kept);
  - library entries with name, date, target thickness and optional estimated mass;
  - load (frequencies to 1 decimal, spectra restored, "Currently editing", "PDF") and deselect;
  - delete with the "Delete Wood Panel" confirmation and its outcomes;
  - "Failed to load wood panel".

  Verify end-to-end tests for:
  - save then load;
  - update without a new panel;
  - a blank name disabling Save;
  - a save failure;
  - delete confirmed and cancelled;
  - deleting the loaded panel resetting the calculator;
  - deselecting by a second click;
  - a panel deleted elsewhere
- [x] 5.4 Build the empty state with "Load Default Panels" calling the function, with "Loading...", "Failed to load default panels" and "No default panels are available yet". Verify end-to-end tests for 5 reference panels copied and listed, an empty reference set and a failure

## 6. Plate measurement

- [x] 6.1 Add "Measure plate" under Frequency Measurements, opening `TapToneDialog` in Plate mode with the translated "Plate measurement" label, the fields' current values and their saved records. On Confirm:
  - write each measured take's frequency rounded to 1 decimal and keep its record per field;
  - leave the takes that were not measured untouched;
  - show the Q line ("Spectral Q … · Decay Q …", "—" when missing) in page state only, cleared on typing in that field, on load, on reset and on deselect.

  Reset and deselect also discard unsaved spectra, and Save and Update send `spectra` without any Q value. Verify:
  - component tests for the Q line and each way it clears;
  - end-to-end tests with the reader's `taps.wav` fixture:
    - uploading it on the Cross-grain take writes "190.0", recalculates and shows the Q line;
    - two takes confirmed together fill both fields;
    - cancelling keeps every value;
    - after save, reload and load, the Cross-grain take reopens on its spectrum with 190.0 Hz preselected and no Q line is shown;
    - a typed-only take opens empty

## 7. PDF report

- [x] 7.1 Add `pdf-lib` and `@pdf-lib/fontkit` pinned exactly to the newest releases at least two weeks old. Add the static Space Grotesk and JetBrains Mono Regular and Bold TTF files with `OFL.txt` under `apps/web/public/fonts/pdf/`. Verify the glyph-coverage unit test of design decision 10 passes for both catalogs
- [x] 7.2 Implement `reportContent` and `renderReport` (decision 7), and the "PDF" action with its three notifications and the dynamic import. Verify:
  - unit tests of `reportContent` against the Input Parameters and Calculated Results scenarios in English and French;
  - a Node test that `renderReport` produces a valid PDF that pdf-lib can load again, with the expected page count;
  - an end-to-end test that "PDF" on "Sitka #3" downloads "Sitka #3_<local date>.pdf" starting with `%PDF` and shows "PDF downloaded successfully!"

## 8. Documentation and integration

- [x] 8.1 Update the root `README.md`:
  - the Wood Props section and how the reference set is filled until `admin-console` lands (SQL as an administrator, or the import);
  - the PDF fonts and their licence.

  Verify each documented command runs as written
- [ ] 8.2 Run `pnpm check`, `pnpm build`, the database tests (`supabase test db`, and `pnpm test:db` where pgTAP is installed), `pnpm test:e2e` and `openspec validate --strict`. Verify all pass

## Workflow follow-up

- `tap-tone-reader` is archived: this change uses its Plate mode, its record check and its `taps.wav` fixture.
- Review with the owner: the dataset's target columns, linking panels to builds, and realistic default inputs (design Open Questions).
- `knowledge-assistant` adds "Analyse" and the PDF's "AI Analysis" section; `admin-console` adds the reference-set curation.
- Archive with `/opsx:archive` once reviewed.
