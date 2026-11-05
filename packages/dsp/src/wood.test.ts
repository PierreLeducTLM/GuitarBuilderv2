import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { type WoodInputs, woodProperties } from "./index.ts";

const defaults: WoodInputs = {
  lengthMm: 280,
  widthMm: 70,
  thicknessMm: 3,
  massG: 25,
  fLongHz: 180,
  fCrossHz: 90,
  fDiagHz: 120,
  plateLengthMm: 500,
  plateWidthMm: 380,
  stiffness: 75,
};

const spruce: WoodInputs = {
  ...defaults,
  lengthMm: 605,
  widthMm: 238,
  thicknessMm: 4,
  massG: 228,
  fLongHz: 61.6,
  fCrossHz: 105,
  fDiagHz: 38.2,
};

const round = (value: number, decimals: number) => Number(value.toFixed(decimals));

describe("wood panel properties", () => {
  it("gives 425.2 kg/m3 and E_L 8.86 GPa for the defaults", () => {
    const result = woodProperties(defaults);
    expect(round(result.density, 1)).toBe(425.2);
    expect(round(result.eLong, 2)).toBe(8.86);
  });

  it("recalculates the density to 357.1 kg/m3 for 300 x 80 x 3.5 mm and 30 g", () => {
    const result = woodProperties({
      ...defaults,
      lengthMm: 300,
      widthMm: 80,
      thicknessMm: 3.5,
      massG: 30,
    });
    expect(round(result.density, 1)).toBe(357.1);
  });

  it("gives 1000 kg/m3 for 100 g in 100 x 100 x 10 mm", () => {
    expect(
      woodProperties({ ...defaults, lengthMm: 100, widthMm: 100, thicknessMm: 10, massG: 100 })
        .density,
    ).toBeCloseTo(1000, 9);
  });

  it("matches the reference spruce panel: 395.9, 11.84, 0.82, 0.91 GPa, 2.77 mm and 157.5 g", () => {
    const result = woodProperties(spruce);
    expect(round(result.density, 1)).toBe(395.9);
    expect(round(result.eLong, 2)).toBe(11.84);
    expect(round(result.eCross, 2)).toBe(0.82);
    expect(round(result.gLc, 2)).toBe(0.91);
    expect(round(result.targetThickness, 2)).toBe(2.77);
    expect(round(result.estimatedMass, 1)).toBe(157.5);
  });

  it("uses the sample width for the cross-grain modulus", () => {
    const narrower = woodProperties({ ...spruce, widthMm: 119, massG: 114 });
    expect(narrower.eCross / woodProperties(spruce).eCross).toBeCloseTo(1 / 16, 9);
  });

  it("estimates 226.5 g for 500 kg/m3, a 500 x 400 mm plate and a 3 mm thickness", () => {
    const thick = woodProperties({ ...spruce, plateWidthMm: 400 });
    const scaled = (500 / thick.density) * (3 / thick.targetThickness) * thick.estimatedMass;
    expect(scaled).toBeCloseTo(226.5, 9);
  });
});

type Plate = {
  sample_id: number;
  length_mm: number;
  width_mm: number;
  thickness_mm: number;
  mass_g: number;
  density_kg_m3: number;
  f_long_hz: number;
  f_cross_hz: number;
  f_diag_hz: number;
  e_long_gpa: number;
  e_cross_gpa: number;
  g_lc_gpa: number;
};

const DATASET = "docs/reference-data/measured-elasticity-dataset.json";

const findUp = (directory: string): string => {
  const candidate = join(directory, DATASET);
  if (existsSync(candidate)) return candidate;
  const parent = dirname(directory);
  if (parent === directory) throw new Error(`${DATASET} not found`);
  return findUp(parent);
};

const dataset: { wood_categories: Record<string, { samples: Plate[] }> } = JSON.parse(
  readFileSync(findUp(dirname(fileURLToPath(import.meta.url))), "utf8"),
);
const plates = Object.entries(dataset.wood_categories).flatMap(([category, { samples }]) =>
  samples.map((plate) => [`${category} #${plate.sample_id}`, plate] as const),
);

// The dataset's target_thickness_mm and mass_target_g columns rest on target plate settings it
// does not record (an implied stiffness of about 73-74 for the tops and 54 for the backs, see
// the change's design), so only the measured constants are compared here.
describe("the 28 measured plates", () => {
  it("covers 28 plates", () => {
    expect(plates).toHaveLength(28);
  });

  it.each(plates)("%s: density, E_L, E_C and G_LC at the dataset's precision", (_, plate) => {
    const result = woodProperties({
      ...defaults,
      lengthMm: plate.length_mm,
      widthMm: plate.width_mm,
      thicknessMm: plate.thickness_mm,
      massG: plate.mass_g,
      fLongHz: plate.f_long_hz,
      fCrossHz: plate.f_cross_hz,
      fDiagHz: plate.f_diag_hz,
    });
    expect(round(result.density, 1)).toBe(plate.density_kg_m3);
    expect(round(result.eLong, 2)).toBe(plate.e_long_gpa);
    expect(round(result.eCross, 2)).toBe(plate.e_cross_gpa);
    expect(round(result.gLc, 2)).toBe(plate.g_lc_gpa);
  });
});
