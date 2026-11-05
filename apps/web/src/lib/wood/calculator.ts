import type { WoodInputs } from "@gb/dsp";

export const FIELD_KEYS = [
  "sampleLength",
  "sampleWidth",
  "sampleThickness",
  "sampleMass",
  "freqLongitudinal",
  "freqCrossGrain",
  "freqDiagonal",
  "plateLength",
  "plateWidth",
  "stiffness",
] as const;

export type FieldKey = (typeof FIELD_KEYS)[number];

/** The ten inputs exactly as typed (wood-panel-properties: Numeric Entry). */
export type WoodInputStrings = Readonly<Record<FieldKey, string>>;

export type ValidationErrors = Partial<Record<FieldKey, FieldKey>>;

export const DEFAULT_INPUTS: WoodInputStrings = {
  sampleLength: "280",
  sampleWidth: "70",
  sampleThickness: "3.0",
  sampleMass: "25",
  freqLongitudinal: "180",
  freqCrossGrain: "90",
  freqDiagonal: "120",
  plateLength: "500",
  plateWidth: "380",
  stiffness: "75",
};

const toNumber = (text: string) => {
  const value = Number(text);
  return Number.isNaN(value) ? 0 : value;
};

export const parseInputs = (inputs: WoodInputStrings): WoodInputs => ({
  lengthMm: toNumber(inputs.sampleLength),
  widthMm: toNumber(inputs.sampleWidth),
  thicknessMm: toNumber(inputs.sampleThickness),
  massG: toNumber(inputs.sampleMass),
  fLongHz: toNumber(inputs.freqLongitudinal),
  fCrossHz: toNumber(inputs.freqCrossGrain),
  fDiagHz: toNumber(inputs.freqDiagonal),
  plateLengthMm: toNumber(inputs.plateLength),
  plateWidthMm: toNumber(inputs.plateWidth),
  stiffness: toNumber(inputs.stiffness),
});

/** The fields whose value is not a finite number greater than 0, each with its message key. */
export const validateInputs = (inputs: WoodInputStrings): ValidationErrors =>
  Object.fromEntries(
    FIELD_KEYS.flatMap((key) => {
      const value = toNumber(inputs[key]);
      return value > 0 && Number.isFinite(value) ? [] : [[key, key]];
    }),
  );

export const formatValue = (value: number, decimals: number, locale: string) =>
  new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);

// biome-ignore lint/suspicious/noControlCharactersInRegex: replacing control characters is the point
const REFUSED_IN_FILE_NAMES = /[/\\:*?"<>|\u0000-\u001f\u007f]/g;

/** "<panel name>_<local YYYY-MM-DD>.pdf", with characters file systems refuse replaced by "-". */
export const pdfFileName = (options: { name: string; date: Date; timeZone: string }) => {
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: options.timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(options.date);
  return `${options.name.replace(REFUSED_IN_FILE_NAMES, "-")}_${day}.pdf`;
};
