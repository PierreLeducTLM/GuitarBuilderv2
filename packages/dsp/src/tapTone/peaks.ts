import {
  MAX_PEAKS,
  MOBILE_EXCLUSION_HZ,
  PEAK_FLOOR_DB,
  PEAK_NEIGHBOURHOOD_HZ,
  PEAK_PROMINENCE_DB,
  PEAK_RANGE_DB,
} from "./constants.ts";
import type { SpectrumPoint } from "./spectrum.ts";

export type Peak = {
  readonly index: number;
  readonly frequency: number;
  readonly level: number;
  readonly magnitude: number;
};

const isStrictMaximum = (points: readonly SpectrumPoint[], i: number) => {
  const here = points[i]?.db ?? Number.NEGATIVE_INFINITY;
  return here > (points[i - 1]?.db ?? here) && here > (points[i + 1]?.db ?? here);
};

const prominence = (points: readonly SpectrumPoint[], i: number) => {
  const centre = points[i];
  if (!centre) return 0;
  const near = (p: SpectrumPoint) =>
    Math.abs(p.frequency - centre.frequency) <= PEAK_NEIGHBOURHOOD_HZ;
  const lowest = (side: readonly SpectrumPoint[]) =>
    Math.min(...side.filter(near).map((p) => p.db));
  return centre.db - Math.max(lowest(points.slice(0, i)), lowest(points.slice(i + 1)));
};

const isCandidate = (points: readonly SpectrumPoint[], i: number) =>
  i > 0 &&
  i < points.length - 1 &&
  isStrictMaximum(points, i) &&
  (points[i]?.db ?? Number.NEGATIVE_INFINITY) >= PEAK_FLOOR_DB &&
  prominence(points, i) >= PEAK_PROMINENCE_DB;

export const refinePeak = (points: readonly SpectrumPoint[], i: number): Peak => {
  const a = points[i - 1]?.db ?? 0;
  const b = points[i]?.db ?? 0;
  const c = points[i + 1]?.db ?? 0;
  const frequency = points[i]?.frequency ?? 0;
  const binWidth = (points[i + 1]?.frequency ?? frequency) - frequency;
  const offset = (0.5 * (a - c)) / (a - 2 * b + c);
  return {
    index: i,
    frequency: frequency + offset * binWidth,
    level: b - 0.25 * (a - c) * offset,
    magnitude: points[i]?.magnitude ?? 0,
  };
};

const isMobileArtifact = (peak: Peak) =>
  peak.frequency >= MOBILE_EXCLUSION_HZ.from && peak.frequency <= MOBILE_EXCLUSION_HZ.to;

export const detectPeaks = (
  points: readonly SpectrumPoint[],
  options: { mobile: boolean },
): readonly Peak[] => {
  const ranked = points
    .map((_, i) => i)
    .filter((i) => isCandidate(points, i))
    .map((i) => refinePeak(points, i))
    .sort((x, y) => y.level - x.level);
  const strongest = ranked[0]?.level ?? 0;
  const kept = ranked.filter((peak) => peak.level >= strongest - PEAK_RANGE_DB).slice(0, MAX_PEAKS);
  return options.mobile ? kept.filter((peak) => !isMobileArtifact(peak)) : kept;
};

export const nearestPeak = (peaks: readonly Peak[], frequency: number): Peak | undefined =>
  peaks.reduce<Peak | undefined>((best, peak) => {
    if (!best) return peak;
    const distance = Math.abs(peak.frequency - frequency);
    const bestDistance = Math.abs(best.frequency - frequency);
    if (distance < bestDistance) return peak;
    if (distance === bestDistance && peak.level > best.level) return peak;
    return best;
  }, undefined);
