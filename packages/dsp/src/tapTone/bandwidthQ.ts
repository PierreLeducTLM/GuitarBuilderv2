import { Q_BANDWIDTH_DB, Q_MIN_BANDWIDTH_HZ, Q_SEARCH_HZ } from "./constants.ts";
import type { Peak } from "./peaks.ts";
import type { SpectrumPoint } from "./spectrum.ts";

export type SpectralQ = {
  readonly q: number;
  readonly bandwidth: number;
  readonly low: number;
  readonly high: number;
};

const amplitude = (point: SpectrumPoint) => 10 ** (point.db / 20);

const crossing = (outer: SpectrumPoint, inner: SpectrumPoint, threshold: number) =>
  outer.frequency +
  ((threshold - amplitude(outer)) / (amplitude(inner) - amplitude(outer))) *
    (inner.frequency - outer.frequency);

const findCrossing = (
  points: readonly SpectrumPoint[],
  peak: Peak,
  step: 1 | -1,
  threshold: number,
): number | null => {
  const side = step === 1 ? points.slice(peak.index) : points.slice(0, peak.index + 1).reverse();
  const reach = side.findIndex((point, k) => k > 0 && amplitude(point) <= threshold);
  const outer = side[reach];
  const inner = side[reach - 1];
  if (!outer || !inner || Math.abs(outer.frequency - peak.frequency) > Q_SEARCH_HZ) return null;
  return crossing(outer, inner, threshold);
};

export const spectralQ = (points: readonly SpectrumPoint[], peak: Peak): SpectralQ | null => {
  const threshold = 10 ** ((peak.level - Q_BANDWIDTH_DB) / 20);
  const low = findCrossing(points, peak, -1, threshold);
  const high = findCrossing(points, peak, 1, threshold);
  if (low === null || high === null) return null;
  const bandwidth = high - low;
  if (bandwidth < Q_MIN_BANDWIDTH_HZ) return null;
  return { q: peak.frequency / bandwidth, bandwidth, low, high };
};
