import type { WoodPanelSpectra, WoodSpectrumKey } from "@gb/db";
import type { Row } from "../transport/sql.ts";
import { prepareSpectrum } from "./spectrum.ts";

export const UNTITLED_PANEL = "Untitled panel";

export type PanelOwners = {
  imported: ReadonlySet<string>;
  /** Owners not imported, with the reason (an email conflict). */
  skipped: ReadonlyMap<string, string>;
};

/** Legacy input column → v2 column (wood-panel-properties' ten inputs). */
const INPUTS = [
  ["sample_length", "sample_length_mm"],
  ["sample_width", "sample_width_mm"],
  ["sample_thickness", "sample_thickness_mm"],
  ["sample_mass", "sample_mass_g"],
  ["freq_longitudinal", "freq_longitudinal_hz"],
  ["freq_cross_grain", "freq_cross_grain_hz"],
  ["freq_diagonal", "freq_diagonal_hz"],
  ["target_plate_length", "plate_length_mm"],
  ["target_plate_width", "plate_width_mm"],
  ["vibrational_stiffness_param", "stiffness_parameter"],
] as const;

type V2Input = (typeof INPUTS)[number][1];

export type PanelInputs = Record<V2Input, number>;

/** The legacy results the report compares with v2's regenerated ones. */
export type PanelResults = {
  eCrossGpa: number | null;
  targetThicknessMm: number | null;
  estimatedMassG: number | null;
};

/** v2's results for the same inputs, always set because invalid inputs are skipped. */
export type V2PanelResults = {
  eCrossGpa: number;
  targetThicknessMm: number;
  estimatedMassG: number;
};

export type PanelRow = PanelInputs & {
  id: string;
  owner_id: string;
  name: string;
  spectra: WoodPanelSpectra;
  created_at: unknown;
  updated_at: unknown;
};

export type DefaultPanelRow = PanelInputs & { id: string; name: string; created_at: unknown };

export type PanelNote =
  | { kind: "renamed"; to: string }
  | { kind: "build-link-dropped" }
  | { kind: "unknown-spectrum-key"; key: string }
  | { kind: "spectrum-reduced"; key: WoodSpectrumKey; from: number; to: number }
  | { kind: "spectrum-refused"; key: WoodSpectrumKey; reason: string };

type Skip = { kind: "skip"; id: string; name: string; ownerId: string | null; reason: string };

export type PanelPlan<R> =
  | {
      kind: "import";
      id: string;
      name: string;
      row: R;
      legacyResults: PanelResults;
      notes: PanelNote[];
    }
  | Skip;

const LEGACY_SPECTRUM_KEYS: Readonly<Record<string, WoodSpectrumKey>> = {
  freqLongitudinal: "longitudinal",
  freqCrossGrain: "crossGrain",
  freqDiagonal: "diagonal",
};

const isObject = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** A legacy `numeric`, which to_jsonb gives as a JSON number; null when absent. */
const numberOf = (value: unknown): number | null => (typeof value === "number" ? value : null);

const isPositive = (value: number): boolean => Number.isFinite(value) && value > 0;

const readInputs = (legacy: Row): PanelInputs => {
  const input = (column: (typeof INPUTS)[number][0]): number =>
    numberOf(legacy[column]) ?? Number.NaN;
  return {
    sample_length_mm: input("sample_length"),
    sample_width_mm: input("sample_width"),
    sample_thickness_mm: input("sample_thickness"),
    sample_mass_g: input("sample_mass"),
    freq_longitudinal_hz: input("freq_longitudinal"),
    freq_cross_grain_hz: input("freq_cross_grain"),
    freq_diagonal_hz: input("freq_diagonal"),
    plate_length_mm: input("target_plate_length"),
    plate_width_mm: input("target_plate_width"),
    stiffness_parameter: input("vibrational_stiffness_param"),
  };
};

type Common =
  | { valid: true; id: string; name: string; inputs: PanelInputs; notes: PanelNote[] }
  | { valid: false; skip: Skip };

const readCommon = (legacy: Row, ownerId: string | null): Common => {
  const id = String(legacy.id);
  const trimmed = typeof legacy.name === "string" ? legacy.name.trim() : "";
  const name = trimmed === "" ? UNTITLED_PANEL : trimmed;
  const inputs = readInputs(legacy);
  const invalid = INPUTS.find(([, v2Column]) => !isPositive(inputs[v2Column]));
  if (invalid !== undefined) {
    const reason = `input ${invalid[0]} is not a positive number`;
    return { valid: false, skip: { kind: "skip", id, name, ownerId, reason } };
  }
  const notes: PanelNote[] = trimmed === "" ? [{ kind: "renamed", to: UNTITLED_PANEL }] : [];
  return { valid: true, id, name, inputs, notes };
};

const legacyResultsOf = (legacy: Row): PanelResults => ({
  eCrossGpa: numberOf(legacy.young_modulus_cross),
  targetThicknessMm: numberOf(legacy.target_thickness),
  estimatedMassG: numberOf(legacy.estimated_panel_mass),
});

const convertSpectra = (stored: unknown): { spectra: WoodPanelSpectra; notes: PanelNote[] } => {
  const entries = isObject(stored) ? Object.entries(stored) : [];
  const results = entries.map(([legacyKey, value]) => {
    const key = LEGACY_SPECTRUM_KEYS[legacyKey];
    if (key === undefined) {
      return { spectrum: null, note: { kind: "unknown-spectrum-key", key: legacyKey } as const };
    }
    const prepared = prepareSpectrum(value);
    if (prepared.kind === "refused") {
      return {
        spectrum: null,
        note: { kind: "spectrum-refused", key, reason: prepared.reason } as const,
      };
    }
    const note =
      prepared.kind === "reduced"
        ? ({ kind: "spectrum-reduced", key, from: prepared.from, to: prepared.to } as const)
        : null;
    return { spectrum: [key, prepared.record] as const, note };
  });
  return {
    spectra: Object.fromEntries(
      results.flatMap((result) => (result.spectrum ? [result.spectrum] : [])),
    ),
    notes: results.flatMap((result) => (result.note ? [result.note] : [])),
  };
};

/** legacy-data-migration: Wood Panel Recalculation, Wood Panel Spectrum Migration. */
export function convertPanel(legacy: Row, owners: PanelOwners): PanelPlan<PanelRow> {
  const ownerId = typeof legacy.user_id === "string" ? legacy.user_id : null;
  const common = readCommon(legacy, ownerId);
  if (!common.valid) return common.skip;
  const { id, name } = common;
  if (ownerId === null) return { kind: "skip", id, name, ownerId, reason: "no owner" };
  if (!owners.imported.has(ownerId)) {
    const reason = owners.skipped.get(ownerId) ?? "owner not imported";
    return { kind: "skip", id, name, ownerId, reason };
  }
  const { spectra, notes: spectrumNotes } = convertSpectra(legacy.fft_data);
  const buildLink = legacy.build_id !== null && legacy.build_id !== undefined;
  return {
    kind: "import",
    id,
    name,
    row: {
      id,
      owner_id: ownerId,
      name,
      ...common.inputs,
      spectra,
      created_at: legacy.created_at,
      updated_at: legacy.updated_at,
    },
    legacyResults: legacyResultsOf(legacy),
    notes: [
      ...common.notes,
      ...(buildLink ? [{ kind: "build-link-dropped" } as const] : []),
      ...spectrumNotes,
    ],
  };
}

/** The reference set (Reference Panel Set): no owner, spectra or update time. */
export function convertDefaultPanel(legacy: Row): PanelPlan<DefaultPanelRow> {
  const common = readCommon(legacy, null);
  if (!common.valid) return common.skip;
  const { id, name } = common;
  return {
    kind: "import",
    id,
    name,
    row: { id, name, ...common.inputs, created_at: legacy.created_at },
    legacyResults: legacyResultsOf(legacy),
    notes: common.notes,
  };
}

export type ValuesChanged = { kind: "values-changed"; old: PanelResults; new: V2PanelResults };

const RELATIVE_TOLERANCE = 0.001;

const differs = (old: number | null, current: number): boolean =>
  old === null || Math.abs(current - old) / Math.abs(old) > RELATIVE_TOLERANCE;

/** A panel is reported when E_C, target thickness or mass moved by more than 0.1%. */
export function comparePanelResults(
  old: PanelResults,
  current: V2PanelResults,
): ValuesChanged | null {
  const changed =
    differs(old.eCrossGpa, current.eCrossGpa) ||
    differs(old.targetThicknessMm, current.targetThicknessMm) ||
    differs(old.estimatedMassG, current.estimatedMassG);
  return changed ? { kind: "values-changed", old, new: current } : null;
}
