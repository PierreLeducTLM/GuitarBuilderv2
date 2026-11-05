import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";
import en from "../../../messages/en.json";
import {
  DEFAULT_INPUTS,
  FIELD_KEYS,
  formatValue,
  parseInputs,
  pdfFileName,
  validateInputs,
  type WoodInputStrings,
} from "./calculator";

const inputs = (overrides: Partial<WoodInputStrings> = {}): WoodInputStrings => ({
  ...DEFAULT_INPUTS,
  ...overrides,
});
const t = createTranslator({ locale: "en", messages: en, namespace: "wood.validation" });

describe("calculator inputs", () => {
  it("starts from the specified defaults, as typed", () => {
    expect(FIELD_KEYS.map((key) => DEFAULT_INPUTS[key])).toEqual([
      "280",
      "70",
      "3.0",
      "25",
      "180",
      "90",
      "120",
      "500",
      "380",
      "75",
    ]);
  });

  it("parses the ten strings into the calculator's numbers", () => {
    expect(parseInputs(inputs({ sampleThickness: "3.5" }))).toMatchObject({
      lengthMm: 280,
      thicknessMm: 3.5,
      stiffness: 75,
      plateWidthMm: 380,
    });
  });

  it("treats an empty or non-numeric entry as missing", () => {
    expect(parseInputs(inputs({ sampleMass: "" })).massG).toBe(0);
    expect(parseInputs(inputs({ sampleMass: "abc" })).massG).toBe(0);
    expect(parseInputs(inputs({ sampleMass: "  " })).massG).toBe(0);
    expect(validateInputs(inputs({ sampleMass: "" }))).toEqual({ sampleMass: "sampleMass" });
  });
});

describe("validation", () => {
  it("accepts the defaults", () => {
    expect(validateInputs(inputs())).toEqual({});
  });

  it("names a zero sample length", () => {
    const errors = validateInputs(inputs({ sampleLength: "0" }));
    expect(Object.keys(errors)).toEqual(["sampleLength"]);
    expect(t(errors.sampleLength ?? "sampleLength")).toBe("Sample length must be greater than 0");
  });

  it("names a negative stiffness parameter", () => {
    const errors = validateInputs(inputs({ stiffness: "-5" }));
    expect(t(errors.stiffness ?? "stiffness")).toBe(
      "Vibrational stiffness parameter must be greater than 0",
    );
  });

  it("flags every failing field, and clears an error once the value is fixed", () => {
    expect(
      Object.keys(
        validateInputs(inputs({ sampleWidth: "0", freqDiagonal: "-1", plateLength: "" })),
      ),
    ).toEqual(["sampleWidth", "freqDiagonal", "plateLength"]);
    expect(validateInputs(inputs({ sampleLength: "300" }))).toEqual({});
  });

  it("refuses infinity and accepts small positive values", () => {
    expect(validateInputs(inputs({ freqLongitudinal: "Infinity" }))).toEqual({
      freqLongitudinal: "freqLongitudinal",
    });
    expect(validateInputs(inputs({ freqLongitudinal: "0.1" }))).toEqual({});
  });
});

describe("result formatting", () => {
  it("shows 2.77 mm and 157.5 g, in the user's locale", () => {
    expect(formatValue(2.7738, 2, "en")).toBe("2.77");
    expect(formatValue(157.515, 1, "en")).toBe("157.5");
    expect(formatValue(2.7738, 2, "fr")).toBe("2,77");
    expect(formatValue(1234.56, 1, "en")).toBe("1,234.6");
    expect(formatValue(2.7, 2, "en")).toBe("2.70");
  });
});

describe("PDF file name", () => {
  it("replaces characters file systems refuse and uses the local date", () => {
    expect(
      pdfFileName({
        name: "Sitka 3/4: top",
        date: new Date("2026-03-15T02:00:00Z"),
        timeZone: "America/Toronto",
      }),
    ).toBe("Sitka 3-4- top_2026-03-14.pdf");
  });

  it("replaces every refused character and control characters", () => {
    expect(
      pdfFileName({
        name: 'a\\b*c?d"e<f>g|h\ti',
        date: new Date("2026-03-14T12:00:00Z"),
        timeZone: "UTC",
      }),
    ).toBe("a-b-c-d-e-f-g-h-i_2026-03-14.pdf");
  });

  it("keeps a plain name with spaces and #", () => {
    expect(
      pdfFileName({ name: "Sitka #3", date: new Date("2026-03-14T12:00:00Z"), timeZone: "UTC" }),
    ).toBe("Sitka #3_2026-03-14.pdf");
  });
});
