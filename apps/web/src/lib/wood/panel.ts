import { type SpectrumRecord, WOOD_SPECTRUM_KEYS, type WoodPanelSpectra } from "@gb/db";
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

export interface CalculatorState {
  inputs: WoodInputStrings;
  name: string;
  loadedId: string | null;
  spectra: WoodPanelSpectra;
}

export const INITIAL_CALCULATOR: CalculatorState = {
  inputs: DEFAULT_INPUTS,
  name: "",
  loadedId: null,
  spectra: {},
};

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
  | { type: "saved" }
  | { type: "reset" }
  | { type: "deleted"; id: string };

export function calculatorReducer(state: CalculatorState, event: CalculatorEvent): CalculatorState {
  switch (event.type) {
    case "edited":
      return { ...state, inputs: { ...state.inputs, [event.key]: event.value } };
    case "named":
      return { ...state, name: event.name };
    case "loaded":
      return {
        inputs: inputsFromPanel(event.panel),
        name: event.name,
        loadedId: event.id,
        spectra: event.spectra,
      };
    case "saved":
      return { ...state, name: "", loadedId: null };
    case "reset":
      return INITIAL_CALCULATOR;
    case "deleted":
      return event.id === state.loadedId ? INITIAL_CALCULATOR : state;
  }
}
