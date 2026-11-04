import { realSpectrum } from "../fft.ts";
import { hann } from "../windows.ts";
import {
  MAX_FREQUENCY,
  MIN_FREQUENCY,
  TAP_WINDOW_LEAD_SAMPLES,
  TAP_WINDOW_SAMPLES,
} from "./constants.ts";

export type SpectrumPoint = {
  readonly frequency: number;
  readonly magnitude: number;
  readonly db: number;
};

const DB_FLOOR_MAGNITUDE = 1e-10;

export const tapPower = (signal: Float64Array | Float32Array, onset: number): Float64Array => {
  const { values, sum } = hann(TAP_WINDOW_SAMPLES);
  const start = onset - TAP_WINDOW_LEAD_SAMPLES;
  const frame = Float64Array.from(values, (w, n) => w * (signal[start + n] ?? 0));
  const { re, im } = realSpectrum(frame);
  const scale = (2 / sum) ** 2;
  return re.map((x, k) => scale * (x * x + (im[k] ?? 0) ** 2));
};

export const averageSpectrum = (powers: readonly Float64Array[]): Float64Array => {
  const first = powers[0];
  if (!first) throw new Error("Averaging needs at least one tap");
  return first.map((_, k) =>
    Math.sqrt(powers.reduce((total, power) => total + (power[k] ?? 0), 0) / powers.length),
  );
};

export const spectrumPoints = (
  magnitudes: Float64Array,
  sampleRate: number,
): readonly SpectrumPoint[] => {
  const binWidth = sampleRate / (2 * magnitudes.length);
  const first = Math.ceil(MIN_FREQUENCY / binWidth);
  const last = Math.floor(MAX_FREQUENCY / binWidth);
  return Array.from({ length: last - first + 1 }, (_, i) => {
    const magnitude = magnitudes[first + i] ?? 0;
    return {
      frequency: (first + i) * binWidth,
      magnitude,
      db: 20 * Math.log10(Math.max(magnitude, DB_FLOOR_MAGNITUDE)),
    };
  });
};
