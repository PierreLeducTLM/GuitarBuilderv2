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
  maxHz: 1000,
  minDb: -100,
  maxDb: 0,
  snapHz: 20,
  gridHz: [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000],
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

export const tracePath = (points: readonly SpectrumPoint[]) =>
  points.map((p) => `${xOfFrequency(p.frequency).toFixed(1)},${levelY(p.db).toFixed(1)}`).join(" ");

export const nearestPeakIndex = (peaks: readonly Peak[], frequency: number): number | null =>
  peaks.reduce<number | null>((best, peak, i) => {
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
