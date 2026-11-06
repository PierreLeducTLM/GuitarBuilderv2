import type { SpectrumRecord } from "@gb/db";

/** The most points a Tap-Tone Spectrum Record may hold (spectrum_record_is_valid). */
export const MAX_SPECTRUM_POINTS = 1024;

const MAX_FREQUENCY = 2000;
const FFT_SIZES = new Set(Array.from({ length: 16 }, (_, exponent) => 2 ** exponent));

export type PreparedSpectrum =
  | { kind: "unchanged"; record: SpectrumRecord }
  | { kind: "reduced"; record: SpectrumRecord; from: number; to: number }
  | { kind: "refused"; reason: string };

type Shape = {
  frequencies: unknown[];
  magnitudes: unknown[];
  magnitudesDb: unknown[];
  sampleRate: number;
  fftSize: number;
  binWidth: number;
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const hasShape = (value: unknown): value is Shape =>
  isObject(value) &&
  Array.isArray(value.frequencies) &&
  Array.isArray(value.magnitudes) &&
  Array.isArray(value.magnitudesDb) &&
  typeof value.sampleRate === "number" &&
  typeof value.fftSize === "number" &&
  typeof value.binWidth === "number";

const allNumbers = (values: unknown[]): values is number[] =>
  values.every((value) => typeof value === "number");

const isStrictlyAscending = (values: readonly number[]): boolean =>
  values.every((value, index) => index === 0 || value > (values[index - 1] ?? value));

type Checked = { valid: true; record: SpectrumRecord } | { valid: false; reason: string };

const refused = (reason: string): Checked => ({ valid: false, reason });

/** The record as v2 would accept it, ignoring its length, or the reason it would refuse it. */
const check = (shape: Shape): Checked => {
  const { frequencies, magnitudes, magnitudesDb, sampleRate, fftSize, binWidth } = shape;
  if (frequencies.length === 0) return refused("no points");
  if (magnitudes.length !== frequencies.length || magnitudesDb.length !== frequencies.length) {
    return refused("lists of different lengths");
  }
  if (!allNumbers(frequencies) || !allNumbers(magnitudes) || !allNumbers(magnitudesDb)) {
    return refused("a value that is not a number");
  }
  if (frequencies.some((frequency) => frequency <= 0 || frequency > MAX_FREQUENCY)) {
    return refused("a frequency outside (0, 2000] Hz");
  }
  if (!isStrictlyAscending(frequencies)) return refused("frequencies not strictly ascending");
  if (magnitudes.some((magnitude) => magnitude < 0)) return refused("a negative magnitude");
  if (sampleRate <= 0) return refused("an invalid sample rate");
  if (!FFT_SIZES.has(fftSize)) return refused("an invalid FFT size");
  if (Math.abs(binWidth - sampleRate / fftSize) > 1e-9 * binWidth) {
    return refused("a bin width that does not match the sample rate and FFT size");
  }
  return {
    valid: true,
    record: { frequencies, magnitudes, magnitudesDb, sampleRate, fftSize, binWidth },
  };
};

const loudestOfRuns = (record: SpectrumRecord, runLength: number): SpectrumRecord => {
  const runStarts = Array.from(
    { length: Math.ceil(record.frequencies.length / runLength) },
    (_, run) => run * runLength,
  );
  const kept = runStarts.map((start) =>
    record.magnitudes
      .slice(start, start + runLength)
      .reduce(
        (best, magnitude, offset) =>
          magnitude > (record.magnitudes[best] ?? magnitude) ? start + offset : best,
        start,
      ),
  );
  const pick = (values: readonly number[]): number[] => kept.map((index) => values[index] ?? 0);
  return {
    ...record,
    frequencies: pick(record.frequencies),
    magnitudes: pick(record.magnitudes),
    magnitudesDb: pick(record.magnitudesDb),
  };
};

/**
 * Prepares a stored spectrum for v2 (legacy-data-migration: Step Measurement Migration,
 * Wood Panel Spectrum Migration): unchanged when v2 accepts it, reduced to at most 1024
 * points by keeping each run's loudest point when it is too long, refused otherwise.
 */
export function prepareSpectrum(value: unknown): PreparedSpectrum {
  if (!hasShape(value)) return { kind: "refused", reason: "not a spectrum record" };
  const checked = check(value);
  if (!checked.valid) return { kind: "refused", reason: checked.reason };
  const { record } = checked;
  const from = record.frequencies.length;
  if (from <= MAX_SPECTRUM_POINTS) return { kind: "unchanged", record };
  const reduced = loudestOfRuns(record, Math.ceil(from / MAX_SPECTRUM_POINTS));
  return { kind: "reduced", record: reduced, from, to: reduced.frequencies.length };
}
