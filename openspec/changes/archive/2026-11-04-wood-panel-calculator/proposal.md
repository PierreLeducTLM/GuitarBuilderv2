# Proposal

## Why

"Wood Props" is still a placeholder. The calculator is the tool luthiers use to choose and thickness their tops and backs. `wood-panel-properties` comes right after the tap-tone reader in the recommended order (`docs/rewrite/README.md`). The reader (`tap-tone-reader`, archived on 2026-11-04) gives the calculator its three frequency measurements in one Plate-mode session. The legacy calculator also used the wrong cross-grain formula, so every value it showed for E_C, target thickness and mass was off. The rewrite fixes that from the first release.

## What Changes

- **Wood panel data and access rules:**
  - two tables, in a new migration:
    - `wood_panels`: the user's library;
    - `default_wood_panels`: the shared reference set.
  - The results snapshot (E_L, E_C, G_LC, target thickness, estimated mass) is computed by the database from the stored inputs. Clients cannot write it, so it always matches the inputs.
  - Inputs must be finite and greater than 0, and names must not be blank. Stored spectra must use the three field keys and pass the shared record check from `tap-tone-reader`.
  - Row-level security:
    - only the owner writes a panel;
    - an administrator reads any panel but changes none;
    - every signed-in user reads the reference set, and only administrators change it.
  - `load_default_wood_panels()` copies the reference set into an empty library, once, even under double clicks or two tabs.
  - pgTAP tests cover every rule.
- **Wood properties math in `@gb/dsp`:** density, E_L, E_C (width formula), G_LC, target thickness and estimated mass. It is tested against the spec's worked examples and the 28 measured plates in `docs/reference-data/`. The same module will serve the legacy import's recalculation.
- **The calculator page `/wood-properties` (`wood-panel-properties`):**
  - the ten inputs with their defaults, validation messages and real-time results;
  - "Reset to defaults";
  - one "Measure plate" action, which opens the reader in Plate mode:
    - each measured mode's frequency is written to its field, rounded to one decimal, and its spectrum is kept for that field;
    - its spectral and decay Q are shown under the field but not saved;
    - a take with a stored spectrum reopens on it.
- **The library:**
  - newest first, with name, date, target thickness and estimated mass;
  - the empty state with "Load Default Panels";
  - load, deselect, save, update and delete with confirmation, with the specified messages and notifications.
- **The PDF report:** the "PDF" action on the loaded panel downloads `<name>_<date>.pdf` with Input Parameters and Calculated Results in the user's language. Fonts are embedded so "ρ", "³" and French accents render.
- **Deferred:**
  - the "Analyse" action and the PDF's "AI Analysis" section come with `knowledge-assistant`, which owns the grounded answer pipeline. Until then the PDF is produced without that section, as the spec allows when no analysis can be obtained;
  - the admin curation of the reference set (sync, delete) and the prompt template come with `admin-console`;
  - user deletion's cascade to panels comes from the foreign key now, and is exercised by `admin-console`.
- **Spec changes (`wood-panel-properties`):**
  - frequencies come from one Plate-mode measurement instead of three per-field captures, and the measured Q values are shown under each field;
  - what the library shows when panels can't be loaded (a legacy defect showed the empty state and "Load Default Panels" instead);
  - feedback for "Load Default Panels": progress, failure, an empty reference set, and copying once;
  - the server refuses invalid panel data;
  - PDF file names replace characters that file systems refuse, and use the local date.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `wood-panel-properties`:
  - "Tap-Tone Capture for Frequency Fields", "Tap-Tone Spectrum Storage" and "Tap-Tone Spectrum Review" move to one Plate-mode measurement;
  - new requirements "Measured Q Display", "Library Load Failures" and "Load Default Panels Feedback";
  - "Wood Panel Data" gains a server-validation scenario;
  - "PDF Report Download" gains a file-name scenario.

## Impact

- **Database:**
  - a new migration with both tables, the result functions used by their generated columns, the spectra check, the `updated_at` trigger (reusing `public.set_updated_at()`), the policies and column grants, and `load_default_wood_panels()`;
  - pgTAP files `11_wood_panels_schema`, `12_wood_panels_access` and `13_default_wood_panels`.
- **Packages:**
  - `@gb/dsp` gains `wood/properties.ts`;
  - `@gb/db` gains both tables, the function and a `WoodPanelSpectra` type.
- **App:**
  - the page and components under `apps/web/src/app/(shell)/wood-properties/` and `apps/web/src/components/wood/`;
  - validation, formatting and the PDF builder under `apps/web/src/lib/wood/`;
  - new `wood.*` message keys in both catalogs.
- **New dependencies, pinned exactly:** `pdf-lib` and `@pdf-lib/fontkit`, loaded only when a PDF is generated.
- **New assets:** static Space Grotesk and JetBrains Mono TTF files (SIL Open Font License, licence file included), used only for the PDF.
- **Tests:**
  - math unit tests on the spec examples and the dataset;
  - validation and PDF-content unit tests;
  - the fake Supabase server learns the two tables and the function, for end-to-end tests of the whole calculator.
- **Builds on `tap-tone-reader`** (archived): its Plate mode, `spectrum_record_is_valid` and the `taps.wav` end-to-end fixture.
- **Later changes:**
  - `knowledge-assistant` adds "Analyse" and the AI section;
  - `admin-console` adds the reference-set curation and the template setting;
  - `legacy-data-migration` imports panels into these tables, and gets the corrected results from the generated columns.
