import type { Peak, SpectrumPoint } from "@gb/dsp";

const WIDTH = 640;
const HEIGHT = 260;
const LEFT = 44;
const RIGHT = 14;
const TOP = 14;
const BOTTOM = 26;

export const GRAPH = {
  width: WIDTH,
  height: HEIGHT,
  left: LEFT,
  top: TOP,
  plotWidth: WIDTH - LEFT - RIGHT,
  plotHeight: HEIGHT - TOP - BOTTOM,
  minHz: 30,
  maxHz: 600,
  minDb: -100,
  maxDb: 0,
  snapHz: 20,
  gridHz: [50, 100, 200, 300, 400, 500, 600],
  gridDb: [0, -20, -40, -60, -80, -100],
} as const;

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));

export const xOfFrequency = (frequency: number) =>
  GRAPH.left +
  ((clamp(frequency, GRAPH.minHz, GRAPH.maxHz) - GRAPH.minHz) / (GRAPH.maxHz - GRAPH.minHz)) *
    GRAPH.plotWidth;

export const frequencyAtX = (x: number) =>
  GRAPH.minHz + clamp((x - GRAPH.left) / GRAPH.plotWidth, 0, 1) * (GRAPH.maxHz - GRAPH.minHz);

export const levelY = (db: number) =>
  GRAPH.top +
  ((GRAPH.maxDb - clamp(db, GRAPH.minDb, GRAPH.maxDb)) / (GRAPH.maxDb - GRAPH.minDb)) *
    GRAPH.plotHeight;

export const onAxis = (frequency: number) => frequency >= GRAPH.minHz && frequency <= GRAPH.maxHz;

export const tracePath = (points: readonly SpectrumPoint[]) =>
  points
    .filter((p) => onAxis(p.frequency))
    .map((p) => `${xOfFrequency(p.frequency).toFixed(1)},${levelY(p.db).toFixed(1)}`)
    .join(" ");

export const nearestPeakIndex = (peaks: readonly Peak[], frequency: number): number | null =>
  peaks.reduce<number | null>((best, peak, i) => {
    if (!onAxis(peak.frequency)) return best;
    const bestPeak = best === null ? undefined : peaks[best];
    return !bestPeak ||
      Math.abs(peak.frequency - frequency) < Math.abs(bestPeak.frequency - frequency)
      ? i
      : best;
  }, null);

export const snapTargetIndex = (peaks: readonly Peak[], frequency: number): number | null => {
  const nearest = nearestPeakIndex(peaks, frequency);
  const peak = nearest === null ? undefined : peaks[nearest];
  return peak && Math.abs(peak.frequency - frequency) <= GRAPH.snapHz ? nearest : null;
};

type Label = { readonly index: number; readonly wanted: number };
type LabelGroup = { readonly labels: readonly Label[]; readonly center: number };

/** Centres for same-width labels on one row: as close to where each wants to be, never closer than `gap`, inside `min`..`max`, in their given order. */
export const spreadLabels = ({
  centers,
  width,
  gap,
  min,
  max,
}: {
  centers: readonly number[];
  width: number;
  gap: number;
  min: number;
  max: number;
}): number[] => {
  const span = (count: number) => count * width + (count - 1) * gap;
  const group = (labels: readonly Label[]): LabelGroup => {
    const half = span(labels.length) / 2;
    const mean = labels.reduce((sum, label) => sum + label.wanted, 0) / labels.length;
    return { labels, center: clamp(mean, min + half, max - half) };
  };
  const touches = (left: LabelGroup, right: LabelGroup) =>
    left.center + span(left.labels.length) / 2 + gap > right.center - span(right.labels.length) / 2;
  const settle = (groups: readonly LabelGroup[]): readonly LabelGroup[] => {
    const at = groups.findIndex((left, i) => {
      const right = groups[i + 1];
      return right !== undefined && touches(left, right);
    });
    const left = groups[at];
    const right = groups[at + 1];
    if (!left || !right) return groups;
    return settle([
      ...groups.slice(0, at),
      group([...left.labels, ...right.labels]),
      ...groups.slice(at + 2),
    ]);
  };
  const sorted = centers
    .map((wanted, index) => ({ index, wanted }))
    .toSorted((a, b) => a.wanted - b.wanted);
  const placed = settle(sorted.map((label) => group([label]))).flatMap((g) =>
    g.labels.map((label, i) => ({
      index: label.index,
      center: g.center - span(g.labels.length) / 2 + width / 2 + i * (width + gap),
    })),
  );
  return placed.toSorted((a, b) => a.index - b.index).map((label) => label.center);
};
