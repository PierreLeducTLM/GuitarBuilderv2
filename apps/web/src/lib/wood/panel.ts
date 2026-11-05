import {
  type SpectrumRecord,
  WOOD_SPECTRUM_KEYS,
  type WoodPanelSpectra,
  type WoodSpectrumKey,
} from "@gb/db";
import type { TapToneRecord } from "@gb/dsp";
import { isRecord, toSpectrum } from "@/lib/sequence/state";
import { DEFAULT_INPUTS, type FieldKey, parseInputs, type WoodInputStrings } from "./calculator";

/** The ten input columns of a stored panel. */
export interface StoredPanelInputs {
  sample_length_mm: number;
  sample_width_mm: number;
  sample_thickness_mm: number;
  sample_mass_g: number;
  freq_longitudinal_hz: number;
  freq_cross_grain_hz: number;
  freq_diagonal_hz: number;
  plate_length_mm: number;
  plate_width_mm: number;
  stiffness_parameter: number;
}

export const PANEL_INPUT_COLUMNS =
  "sample_length_mm, sample_width_mm, sample_thickness_mm, sample_mass_g, freq_longitudinal_hz, freq_cross_grain_hz, freq_diagonal_hz, plate_length_mm, plate_width_mm, stiffness_parameter";

const recordJson = (record: SpectrumRecord) => ({
  frequencies: record.frequencies,
  magnitudes: record.magnitudes,
  magnitudesDb: record.magnitudesDb,
  sampleRate: record.sampleRate,
  fftSize: record.fftSize,
  binWidth: record.binWidth,
});

/** The spectra as the plain JSON object the `spectra` column stores. */
const spectraJson = (spectra: WoodPanelSpectra) =>
  Object.fromEntries(
    WOOD_SPECTRUM_KEYS.flatMap((key) => {
      const record = spectra[key];
      return record ? [[key, recordJson(record)]] : [];
    }),
  );

/** What a save or an update writes: the trimmed name, the ten numbers and the kept spectra. */
export const panelPayload = (options: {
  name: string;
  inputs: WoodInputStrings;
  spectra: WoodPanelSpectra;
}) => {
  const values = parseInputs(options.inputs);
  return {
    name: options.name.trim(),
    sample_length_mm: values.lengthMm,
    sample_width_mm: values.widthMm,
    sample_thickness_mm: values.thicknessMm,
    sample_mass_g: values.massG,
    freq_longitudinal_hz: values.fLongHz,
    freq_cross_grain_hz: values.fCrossHz,
    freq_diagonal_hz: values.fDiagHz,
    plate_length_mm: values.plateLengthMm,
    plate_width_mm: values.plateWidthMm,
    stiffness_parameter: values.stiffness,
    spectra: spectraJson(options.spectra),
  };
};

/** wood-panel-properties: Load a Panel. Frequencies are rounded to one decimal. */
export const inputsFromPanel = (panel: StoredPanelInputs): WoodInputStrings => ({
  sampleLength: String(panel.sample_length_mm),
  sampleWidth: String(panel.sample_width_mm),
  sampleThickness: String(panel.sample_thickness_mm),
  sampleMass: String(panel.sample_mass_g),
  freqLongitudinal: panel.freq_longitudinal_hz.toFixed(1),
  freqCrossGrain: panel.freq_cross_grain_hz.toFixed(1),
  freqDiagonal: panel.freq_diagonal_hz.toFixed(1),
  plateLength: String(panel.plate_length_mm),
  plateWidth: String(panel.plate_width_mm),
  stiffness: String(panel.stiffness_parameter),
});

/** The stored spectra of the three frequency fields; anything else is ignored. */
export const spectraFromStored = (value: unknown): WoodPanelSpectra => {
  if (!isRecord(value)) return {};
  return Object.fromEntries(
    WOOD_SPECTRUM_KEYS.flatMap((key) => {
      const record = toSpectrum(value[key]);
      return record ? [[key, record]] : [];
    }),
  );
};

/** The frequency field each plate take measures. */
export const TAKE_FIELDS: Readonly<Record<WoodSpectrumKey, FieldKey>> = {
  longitudinal: "freqLongitudinal",
  crossGrain: "freqCrossGrain",
  diagonal: "freqDiagonal",
};

/** A confirmed take's Q values, shown in the page only (Measured Q Display). */
export interface MeasuredQuality {
  spectralQ: number | null;
  decayQ: number | null;
}

export type MeasuredTakes = Partial<
  Record<WoodSpectrumKey, MeasuredQuality & { frequency: number; spectrum: TapToneRecord }>
>;

export interface CalculatorState {
  inputs: WoodInputStrings;
  name: string;
  loadedId: string | null;
  spectra: WoodPanelSpectra;
  quality: Partial<Record<WoodSpectrumKey, MeasuredQuality>>;
}

export const INITIAL_CALCULATOR: CalculatorState = {
  inputs: DEFAULT_INPUTS,
  name: "",
  loadedId: null,
  spectra: {},
  quality: {},
};

const spectrumFromReader = (record: TapToneRecord): SpectrumRecord => ({
  frequencies: [...record.frequencies],
  magnitudes: [...record.magnitudes],
  magnitudesDb: [...record.magnitudesDb],
  sampleRate: record.sampleRate,
  fftSize: record.fftSize,
  binWidth: record.binWidth,
});

const measuredEntries = (takes: MeasuredTakes) =>
  WOOD_SPECTRUM_KEYS.flatMap((key) => {
    const take = takes[key];
    return take ? [{ key, take }] : [];
  });

function withMeasurements(state: CalculatorState, takes: MeasuredTakes): CalculatorState {
  const measured = measuredEntries(takes);
  return {
    ...state,
    inputs: {
      ...state.inputs,
      ...Object.fromEntries(
        measured.map(({ key, take }) => [TAKE_FIELDS[key], take.frequency.toFixed(1)]),
      ),
    },
    spectra: {
      ...state.spectra,
      ...Object.fromEntries(
        measured.map(({ key, take }) => [key, spectrumFromReader(take.spectrum)]),
      ),
    },
    quality: {
      ...state.quality,
      ...Object.fromEntries(
        measured.map(({ key, take }) => [key, { spectralQ: take.spectralQ, decayQ: take.decayQ }]),
      ),
    },
  };
}

/** Typing a frequency by hand clears that take's Q values; its spectrum stays. */
function withoutQualityOf(state: CalculatorState, field: FieldKey): CalculatorState["quality"] {
  const take = WOOD_SPECTRUM_KEYS.find((key) => TAKE_FIELDS[key] === field);
  if (!take || !state.quality[take]) return state.quality;
  return Object.fromEntries(Object.entries(state.quality).filter(([key]) => key !== take));
}

export type CalculatorEvent =
  | { type: "edited"; key: FieldKey; value: string }
  | { type: "named"; name: string }
  | {
      type: "loaded";
      id: string;
      name: string;
      panel: StoredPanelInputs;
      spectra: WoodPanelSpectra;
    }
  | { type: "measured"; takes: MeasuredTakes }
  | { type: "saved" }
  | { type: "reset" }
  | { type: "deleted"; id: string };

export function calculatorReducer(state: CalculatorState, event: CalculatorEvent): CalculatorState {
  switch (event.type) {
    case "edited":
      return {
        ...state,
        inputs: { ...state.inputs, [event.key]: event.value },
        quality: withoutQualityOf(state, event.key),
      };
    case "named":
      return { ...state, name: event.name };
    case "loaded":
      return {
        inputs: inputsFromPanel(event.panel),
        name: event.name,
        loadedId: event.id,
        spectra: event.spectra,
        quality: {},
      };
    case "measured":
      return withMeasurements(state, event.takes);
    case "saved":
      return { ...state, name: "", loadedId: null };
    case "reset":
      return INITIAL_CALCULATOR;
    case "deleted":
      return event.id === state.loadedId ? INITIAL_CALCULATOR : state;
  }
}
