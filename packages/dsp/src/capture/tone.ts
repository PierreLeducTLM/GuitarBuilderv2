import { TAP_WINDOW_LEAD_SAMPLES, TAP_WINDOW_SAMPLES } from "../tapTone/constants.ts";
import { refinePeak } from "../tapTone/peaks.ts";
import {
  averageSpectrum,
  type SpectrumPoint,
  spectrumPoints,
  tapPower,
} from "../tapTone/spectrum.ts";

export const TEST_TONE_HZ = 440;
const TONE_BAND_HZ = { from: 220, to: 880 } as const;
const TONE_FLOOR_DB = -60;

export type ToneReading =
  | { readonly heard: true; readonly frequency: number; readonly cents: number }
  | { readonly heard: false };

const strongestInBand = (points: readonly SpectrumPoint[]): number =>
  points.reduce((best, point, i) => {
    const inBand = point.frequency >= TONE_BAND_HZ.from && point.frequency <= TONE_BAND_HZ.to;
    const louder = point.db > (points[best]?.db ?? Number.NEGATIVE_INFINITY);
    return inBand && louder ? i : best;
  }, -1);

export const measureTone = (input: {
  samples: Float64Array | Float32Array;
  sampleRate: number;
}): ToneReading => {
  const start = Math.floor((input.samples.length - TAP_WINDOW_SAMPLES) / 2);
  const power = tapPower(input.samples, start + TAP_WINDOW_LEAD_SAMPLES);
  const points = spectrumPoints(averageSpectrum([power]), input.sampleRate);
  const strongest = strongestInBand(points);
  if ((points[strongest]?.db ?? Number.NEGATIVE_INFINITY) < TONE_FLOOR_DB) return { heard: false };
  const { frequency } = refinePeak(points, strongest);
  return { heard: true, frequency, cents: 1200 * Math.log2(frequency / TEST_TONE_HZ) };
};
