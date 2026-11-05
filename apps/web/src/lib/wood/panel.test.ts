import type { SpectrumRecord } from "@gb/db";
import { describe, expect, it } from "vitest";
import { DEFAULT_INPUTS, type WoodInputStrings } from "./calculator";
import {
  type CalculatorState,
  calculatorReducer,
  INITIAL_CALCULATOR,
  inputsFromPanel,
  panelPayload,
  type StoredPanelInputs,
  spectraFromStored,
} from "./panel";

const spectrum = (overrides: Partial<SpectrumRecord> = {}): SpectrumRecord => ({
  frequencies: [100, 101],
  magnitudes: [0.5, 0.25],
  magnitudesDb: [-6, -12],
  sampleRate: 48000,
  fftSize: 65536,
  binWidth: 0.732421875,
  ...overrides,
});

const stored = (overrides: Partial<StoredPanelInputs> = {}): StoredPanelInputs => ({
  sample_length_mm: 605,
  sample_width_mm: 238,
  sample_thickness_mm: 4,
  sample_mass_g: 228,
  freq_longitudinal_hz: 61.63,
  freq_cross_grain_hz: 105,
  freq_diagonal_hz: 38.249,
  plate_length_mm: 500,
  plate_width_mm: 380.5,
  stiffness_parameter: 75,
  ...overrides,
});

const state = (overrides: Partial<CalculatorState> = {}): CalculatorState => ({
  ...INITIAL_CALCULATOR,
  ...overrides,
});

const typed = (overrides: Partial<WoodInputStrings>): WoodInputStrings => ({
  ...DEFAULT_INPUTS,
  ...overrides,
});

describe("panel payload", () => {
  it("sends the trimmed name, the ten numbers and the kept spectra", () => {
    const longitudinal = spectrum();
    expect(
      panelPayload({
        name: "  Sitka #3  ",
        inputs: typed({ sampleThickness: "3.5", freqDiagonal: "120.4" }),
        spectra: { longitudinal },
      }),
    ).toEqual({
      name: "Sitka #3",
      sample_length_mm: 280,
      sample_width_mm: 70,
      sample_thickness_mm: 3.5,
      sample_mass_g: 25,
      freq_longitudinal_hz: 180,
      freq_cross_grain_hz: 90,
      freq_diagonal_hz: 120.4,
      plate_length_mm: 500,
      plate_width_mm: 380,
      stiffness_parameter: 75,
      spectra: { longitudinal },
    });
  });
});

describe("inputs from a stored panel", () => {
  it("rounds the frequencies to one decimal and shows the other inputs as stored", () => {
    expect(inputsFromPanel(stored())).toEqual({
      sampleLength: "605",
      sampleWidth: "238",
      sampleThickness: "4",
      sampleMass: "228",
      freqLongitudinal: "61.6",
      freqCrossGrain: "105.0",
      freqDiagonal: "38.2",
      plateLength: "500",
      plateWidth: "380.5",
      stiffness: "75",
    });
  });
});

describe("stored spectra", () => {
  it("keeps the records of the three fields and drops anything else", () => {
    const longitudinal = spectrum();
    const diagonal = spectrum({ sampleRate: 44100 });
    expect(
      spectraFromStored({
        longitudinal,
        diagonal,
        crossGrain: { frequencies: "not a record" },
        freqLongitudinal: spectrum(),
      }),
    ).toEqual({ longitudinal, diagonal });
  });

  it("reads anything that is not an object as no spectra", () => {
    expect(spectraFromStored(null)).toEqual({});
    expect(spectraFromStored(undefined)).toEqual({});
    expect(spectraFromStored([spectrum()])).toEqual({});
  });
});

describe("calculator state", () => {
  it("starts on the defaults, without a name, a loaded panel or spectra", () => {
    expect(INITIAL_CALCULATOR).toEqual({
      inputs: DEFAULT_INPUTS,
      name: "",
      loadedId: null,
      spectra: {},
    });
  });

  it("keeps what the user types", () => {
    const edited = calculatorReducer(state(), { type: "edited", key: "sampleMass", value: "" });
    expect(edited.inputs).toEqual(typed({ sampleMass: "" }));
    expect(calculatorReducer(edited, { type: "named", name: "Sitka" }).name).toBe("Sitka");
  });

  it("loads a panel's inputs, name and spectra and marks it as being edited", () => {
    const longitudinal = spectrum();
    expect(
      calculatorReducer(state({ name: "draft", spectra: { diagonal: spectrum() } }), {
        type: "loaded",
        id: "p1",
        name: "Sitka #3",
        panel: stored(),
        spectra: { longitudinal },
      }),
    ).toEqual({
      inputs: inputsFromPanel(stored()),
      name: "Sitka #3",
      loadedId: "p1",
      spectra: { longitudinal },
    });
  });

  it("after a save clears the name and the selection but keeps the inputs and spectra", () => {
    const longitudinal = spectrum();
    const before = state({
      inputs: typed({ sampleMass: "30" }),
      name: "Sitka #3",
      loadedId: "p1",
      spectra: { longitudinal },
    });
    expect(calculatorReducer(before, { type: "saved" })).toEqual({
      ...before,
      name: "",
      loadedId: null,
    });
  });

  it("resets to the defaults, discarding the name, the selection and the spectra", () => {
    const before = state({
      inputs: typed({ sampleMass: "30" }),
      name: "Sitka #3",
      loadedId: "p1",
      spectra: { longitudinal: spectrum() },
    });
    expect(calculatorReducer(before, { type: "reset" })).toEqual(INITIAL_CALCULATOR);
  });

  it("resets when the loaded panel is deleted, and only then", () => {
    const before = state({ name: "Sitka #3", loadedId: "p1" });
    expect(calculatorReducer(before, { type: "deleted", id: "p2" })).toBe(before);
    expect(calculatorReducer(before, { type: "deleted", id: "p1" })).toEqual(INITIAL_CALCULATOR);
  });
});
