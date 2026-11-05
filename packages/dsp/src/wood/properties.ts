export type WoodInputs = {
  readonly lengthMm: number;
  readonly widthMm: number;
  readonly thicknessMm: number;
  readonly massG: number;
  readonly fLongHz: number;
  readonly fCrossHz: number;
  readonly fDiagHz: number;
  readonly plateLengthMm: number;
  readonly plateWidthMm: number;
  readonly stiffness: number;
};

export type WoodProperties = {
  readonly density: number;
  readonly eLong: number;
  readonly eCross: number;
  readonly gLc: number;
  readonly targetThickness: number;
  readonly estimatedMass: number;
};

const BENDING = 0.94146;
const TWISTING = 1.21585;
const THICKNESS = 0.95977;
const POISSON_TERM = 0.02857;
const SHEAR_TERM = 1.12;
const SHAPED_FRACTION = 0.755;
const MM = 1e-3;
const G = 1e-3;
const GPA = 1e9;

export const woodProperties = (inputs: WoodInputs): WoodProperties => {
  const L = inputs.lengthMm * MM;
  const W = inputs.widthMm * MM;
  const h = inputs.thicknessMm * MM;
  const a = inputs.plateLengthMm * MM;
  const b = inputs.plateWidthMm * MM;
  const rho = (inputs.massG * G) / (L * W * h);
  const eLong = (BENDING * rho * L ** 4 * inputs.fLongHz ** 2) / h ** 2;
  const eCross = (BENDING * rho * W ** 4 * inputs.fCrossHz ** 2) / h ** 2;
  const gLc = (TWISTING * rho * L ** 2 * W ** 2 * inputs.fDiagHz ** 2) / h ** 2;
  const r = a / b;
  const targetThickness =
    (THICKNESS * inputs.stiffness * a ** 2 * Math.sqrt(rho)) /
    Math.sqrt(eLong + r ** 4 * eCross + r ** 2 * (POISSON_TERM * eLong + SHEAR_TERM * gLc));
  return {
    density: rho,
    eLong: eLong / GPA,
    eCross: eCross / GPA,
    gLc: gLc / GPA,
    targetThickness: targetThickness / MM,
    estimatedMass: (rho * a * b * targetThickness * SHAPED_FRACTION) / G,
  };
};
