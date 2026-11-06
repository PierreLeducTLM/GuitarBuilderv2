import type { SpectrumRecord } from "@gb/db";
import { describe, expect, it } from "vitest";
import {
  comparePanelResults,
  convertDefaultPanel,
  convertPanel,
  type PanelOwners,
} from "./panels.ts";

const OWNER = "b0000000-0000-4000-8000-00000000000b";
const PANEL = "f0000000-0000-4000-8000-00000000000f";

const spectrum = (count = 3): SpectrumRecord => ({
  frequencies: Array.from({ length: count }, (_, i) => 20 + i * 0.5),
  magnitudes: Array.from({ length: count }, () => 0.001),
  magnitudesDb: Array.from({ length: count }, () => -60),
  sampleRate: 16384,
  fftSize: 32768,
  binWidth: 0.5,
});

/** The spec's worked example: 602 x 283 x 3.8 mm, 270 g, f_C = 57.0 Hz. */
const legacyPanel = (overrides: Record<string, unknown> = {}) => ({
  id: PANEL,
  user_id: OWNER,
  build_id: null,
  name: " Sitka #3 ",
  sample_length: 602,
  sample_width: 283,
  sample_thickness: 3.8,
  sample_mass: 270,
  freq_longitudinal: 140,
  freq_cross_grain: 57,
  freq_diagonal: 90,
  target_plate_length: 520,
  target_plate_width: 200,
  vibrational_stiffness_param: 75,
  young_modulus_longitudinal: 12.1,
  young_modulus_cross: 0.28,
  shear_modulus: 0.7,
  target_thickness: 2.9,
  estimated_panel_mass: 150,
  fft_data: null,
  created_at: "2025-02-01T00:00:00+00:00",
  updated_at: "2025-02-02T00:00:00+00:00",
  ...overrides,
});

const owners = (overrides: Partial<PanelOwners> = {}): PanelOwners => ({
  imported: new Set([OWNER]),
  skipped: new Map(),
  ...overrides,
});

const v2Inputs = {
  sample_length_mm: 602,
  sample_width_mm: 283,
  sample_thickness_mm: 3.8,
  sample_mass_g: 270,
  freq_longitudinal_hz: 140,
  freq_cross_grain_hz: 57,
  freq_diagonal_hz: 90,
  plate_length_mm: 520,
  plate_width_mm: 200,
  stiffness_parameter: 75,
};

describe("convertPanel", () => {
  it("keeps the identifier, owner, trimmed name, ten inputs and times, not the results", () => {
    expect(convertPanel(legacyPanel(), owners())).toEqual({
      kind: "import",
      id: PANEL,
      name: "Sitka #3",
      row: {
        id: PANEL,
        owner_id: OWNER,
        name: "Sitka #3",
        ...v2Inputs,
        spectra: {},
        created_at: "2025-02-01T00:00:00+00:00",
        updated_at: "2025-02-02T00:00:00+00:00",
      },
      legacyResults: { eCrossGpa: 0.28, targetThicknessMm: 2.9, estimatedMassG: 150 },
      notes: [],
    });
  });

  it("reads a panel without a build link column as having none", () => {
    const { build_id: _b, ...withoutBuildLink } = legacyPanel();

    expect(convertPanel(withoutBuildLink, owners())).toMatchObject({ kind: "import", notes: [] });
  });

  it("reads stored spectra that are text as none", () => {
    const plan = convertPanel(legacyPanel({ fft_data: "abc" }), owners());

    expect(plan).toMatchObject({ kind: "import", row: { spectra: {} }, notes: [] });
  });

  it("skips a panel whose owner is not an identifier as ownerless", () => {
    expect(convertPanel(legacyPanel({ user_id: 7 }), owners())).toMatchObject({
      kind: "skip",
      ownerId: null,
      reason: "no owner",
    });
  });

  it("reads a legacy result that is not a number as none", () => {
    const plan = convertPanel(legacyPanel({ young_modulus_cross: "0.28" }), owners());

    expect(plan.kind === "import" && plan.legacyResults.eCrossGpa).toBeNull();
  });

  it("reads a missing legacy mass as none", () => {
    const plan = convertPanel(legacyPanel({ estimated_panel_mass: null }), owners());

    expect(plan.kind === "import" && plan.legacyResults.estimatedMassG).toBeNull();
  });

  it("names a panel with a blank name Untitled panel and reports it", () => {
    const plan = convertPanel(legacyPanel({ name: "  " }), owners());

    expect(plan).toMatchObject({ kind: "import", name: "Untitled panel" });
    expect(plan.kind === "import" && plan.notes).toEqual([
      { kind: "renamed", to: "Untitled panel" },
    ]);
  });

  it("drops the unused build link and reports it", () => {
    const plan = convertPanel(
      legacyPanel({ build_id: "e0000000-0000-4000-8000-00000000000e" }),
      owners(),
    );

    expect(plan.kind === "import" && plan.row).not.toHaveProperty("build_id");
    expect(plan.kind === "import" && plan.notes).toEqual([{ kind: "build-link-dropped" }]);
  });

  it("attaches each spectrum to the matching frequency", () => {
    const plan = convertPanel(
      legacyPanel({
        fft_data: {
          freqLongitudinal: spectrum(4),
          freqCrossGrain: spectrum(5),
          freqDiagonal: spectrum(6),
        },
      }),
      owners(),
    );

    expect(plan.kind === "import" && plan.row.spectra).toEqual({
      longitudinal: spectrum(4),
      crossGrain: spectrum(5),
      diagonal: spectrum(6),
    });
    expect(plan.kind === "import" && plan.notes).toEqual([]);
  });

  it("ignores and reports an unknown spectrum key", () => {
    const plan = convertPanel(
      legacyPanel({ fft_data: { freqCrossGrain: spectrum(), freqTwist: spectrum() } }),
      owners(),
    );

    expect(plan.kind === "import" && plan.row.spectra).toEqual({ crossGrain: spectrum() });
    expect(plan.kind === "import" && plan.notes).toEqual([
      { kind: "unknown-spectrum-key", key: "freqTwist" },
    ]);
  });

  it("reduces an oversized spectrum and reports it", () => {
    const plan = convertPanel(
      legacyPanel({ fft_data: { freqLongitudinal: spectrum(2048) } }),
      owners(),
    );

    expect(plan.kind === "import" && plan.row.spectra.longitudinal?.frequencies).toHaveLength(1024);
    expect(plan.kind === "import" && plan.notes).toEqual([
      { kind: "spectrum-reduced", key: "longitudinal", from: 2048, to: 1024 },
    ]);
  });

  it("leaves out an invalid spectrum, keeps the others, and reports it", () => {
    const plan = convertPanel(
      legacyPanel({
        fft_data: {
          freqLongitudinal: spectrum(),
          freqCrossGrain: { ...spectrum(), magnitudes: [0.1] },
        },
      }),
      owners(),
    );

    expect(plan.kind === "import" && plan.row.spectra).toEqual({ longitudinal: spectrum() });
    expect(plan.kind === "import" && plan.notes).toEqual([
      { kind: "spectrum-refused", key: "crossGrain", reason: "lists of different lengths" },
    ]);
  });

  it("reads stored spectra that are not an object as none", () => {
    const plan = convertPanel(legacyPanel({ fft_data: ["x"] }), owners());

    expect(plan.kind === "import" && plan.row.spectra).toEqual({});
  });

  it("skips an ownerless panel", () => {
    expect(convertPanel(legacyPanel({ user_id: null }), owners())).toEqual({
      kind: "skip",
      id: PANEL,
      name: "Sitka #3",
      ownerId: null,
      reason: "no owner",
    });
  });

  it("skips a panel whose owner was not imported", () => {
    expect(convertPanel(legacyPanel(), owners({ imported: new Set() }))).toMatchObject({
      kind: "skip",
      ownerId: OWNER,
      reason: "owner not imported",
    });
  });

  it("skips a panel whose owner was skipped, with the owner's reason", () => {
    const skipped = new Map([[OWNER, "email already used by another account"]]);

    expect(convertPanel(legacyPanel(), owners({ imported: new Set(), skipped }))).toMatchObject({
      kind: "skip",
      reason: "email already used by another account",
    });
  });

  it.each([
    ["zero", { sample_mass: 0 }, "sample_mass"],
    ["negative", { freq_cross_grain: -57 }, "freq_cross_grain"],
    ["missing", { target_plate_width: null }, "target_plate_width"],
    ["not a number", { vibrational_stiffness_param: "seventy" }, "vibrational_stiffness_param"],
    ["numeric text", { sample_length: "602" }, "sample_length"],
    ["infinite", { sample_width: Number.POSITIVE_INFINITY }, "sample_width"],
  ])("skips a panel with a %s input", (_label, overrides, input) => {
    expect(convertPanel(legacyPanel(overrides), owners())).toMatchObject({
      kind: "skip",
      reason: `input ${input} is not a positive number`,
    });
  });
});

describe("convertDefaultPanel", () => {
  it("keeps the identifier, trimmed name, inputs and creation time", () => {
    const { user_id: _u, build_id: _b, fft_data: _f, ...legacyDefault } = legacyPanel();

    expect(convertDefaultPanel(legacyDefault)).toEqual({
      kind: "import",
      id: PANEL,
      name: "Sitka #3",
      row: { id: PANEL, name: "Sitka #3", ...v2Inputs, created_at: "2025-02-01T00:00:00+00:00" },
      legacyResults: { eCrossGpa: 0.28, targetThicknessMm: 2.9, estimatedMassG: 150 },
      notes: [],
    });
  });

  it("names a blank default panel Untitled panel", () => {
    expect(convertDefaultPanel(legacyPanel({ name: null }))).toMatchObject({
      kind: "import",
      name: "Untitled panel",
      notes: [{ kind: "renamed", to: "Untitled panel" }],
    });
  });

  it("skips a default panel with an invalid input", () => {
    expect(convertDefaultPanel(legacyPanel({ sample_width: 0 }))).toEqual({
      kind: "skip",
      id: PANEL,
      name: "Sitka #3",
      ownerId: null,
      reason: "input sample_width is not a positive number",
    });
  });
});

describe("comparePanelResults", () => {
  const legacy = { eCrossGpa: 0.28, targetThicknessMm: 2.9, estimatedMassG: 150 };

  it("reports the corrected cross-grain modulus with old and new values", () => {
    const corrected = { eCrossGpa: 0.57, targetThicknessMm: 2.75, estimatedMassG: 141.2 };

    expect(comparePanelResults(legacy, corrected)).toEqual({
      kind: "values-changed",
      old: legacy,
      new: corrected,
    });
  });

  it("does not report values within 0.1%", () => {
    expect(
      comparePanelResults(legacy, {
        eCrossGpa: 0.28 * 1.0009,
        targetThicknessMm: 2.9 * 0.9991,
        estimatedMassG: 150,
      }),
    ).toBeNull();
  });

  it.each([
    ["E_C", { eCrossGpa: 0.28 * 1.0011 }],
    ["the target thickness", { targetThicknessMm: 2.9 * 0.9989 }],
    ["the estimated mass", { estimatedMassG: 150.2 }],
  ])("reports a change above 0.1%% in %s", (_label, change) => {
    expect(comparePanelResults(legacy, { ...legacy, ...change })).toMatchObject({
      kind: "values-changed",
    });
  });

  it("reports a panel whose legacy mass was missing", () => {
    expect(comparePanelResults({ ...legacy, estimatedMassG: null }, legacy)).toMatchObject({
      kind: "values-changed",
    });
  });

  it("does not report a change of exactly 0.1%", () => {
    const thousand = { ...legacy, estimatedMassG: 1000 };

    expect(comparePanelResults(thousand, { ...legacy, estimatedMassG: 1001 })).toBeNull();
  });

  it("reports a legacy value of zero that is now set", () => {
    expect(comparePanelResults({ ...legacy, eCrossGpa: 0 }, legacy)).toMatchObject({
      kind: "values-changed",
    });
  });
});
