import { describe, expect, it } from "vitest";
import {
  averageSpectrum,
  detectPeaks,
  type Peak,
  type SpectrumPoint,
  spectralQ,
  spectrumPoints,
  tapPower,
} from "./index.ts";
import { withTaps } from "./test-support/signals.ts";

const sampleRate = 48000;
const halfPower = 10 ** (-3 / 20);

const triangle = (options: {
  centre: number;
  halfWidthAtHalfPower: number;
  grid?: { from: number; to: number; step: number };
}): readonly SpectrumPoint[] => {
  const { from, to, step } = options.grid ?? { from: 100, to: 300, step: 1 };
  const slope = (1 - halfPower) / options.halfWidthAtHalfPower;
  return Array.from({ length: Math.round((to - from) / step) + 1 }, (_, i) => {
    const frequency = from + i * step;
    const magnitude = Math.max(1e-6, 1 - slope * Math.abs(frequency - options.centre));
    return { frequency, magnitude, db: 20 * Math.log10(magnitude) };
  });
};

const onlyPeak = (points: readonly SpectrumPoint[]): Peak => {
  const index = points.reduce(
    (best, p, i) => (p.db > (points[best]?.db ?? -Infinity) ? i : best),
    0,
  );
  const top = points[index];
  if (!top) throw new Error("expected points");
  return { index, frequency: top.frequency, level: top.db, magnitude: top.magnitude };
};

describe("spectral Q", () => {
  it("is 20 for a 200 Hz peak whose -3 dB points are 195 and 205 Hz", () => {
    const points = triangle({ centre: 200, halfWidthAtHalfPower: 5 });
    const q = spectralQ(points, onlyPeak(points));
    expect(q?.low).toBeCloseTo(195, 9);
    expect(q?.high).toBeCloseTo(205, 9);
    expect(q?.bandwidth).toBeCloseTo(10, 9);
    expect(q?.q).toBeCloseTo(20, 9);
  });

  it("interpolates the crossings between points", () => {
    const points = triangle({ centre: 200, halfWidthAtHalfPower: 4.5 });
    const q = spectralQ(points, onlyPeak(points));
    expect(q?.low).toBeCloseTo(195.5, 9);
    expect(q?.high).toBeCloseTo(204.5, 9);
  });

  const tapQ = (frequency: number, tau: number) => {
    const signal = withTaps(new Float64Array(2 * sampleRate), [
      { onset: 24000, amplitude: 0.5, tau, frequency },
    ]);
    const points = spectrumPoints(averageSpectrum([tapPower(signal, 24000)]), sampleRate);
    const [peak] = detectPeaks(points, { mobile: false });
    return peak ? (spectralQ(points, peak)?.q ?? 0) : 0;
  };

  it.each([
    [250, 0.01],
    [250, 0.03],
    [100, 0.05],
    [180, 0.1],
  ])("stays within 20%% of pi f tau for a decaying %i Hz tap with tau %f s", (frequency, tau) => {
    expect(Math.abs(tapQ(frequency, tau) / (Math.PI * frequency * tau) - 1)).toBeLessThan(0.2);
  });

  it("is capped by the tap window for long decays, which decay Q measures instead", () => {
    expect(tapQ(180, 0.2)).toBeLessThan(0.7 * Math.PI * 180 * 0.2);
  });

  it("searches no further than 50 Hz from the peak on either side", () => {
    const reachable = triangle({ centre: 200, halfWidthAtHalfPower: 49.5 });
    const tooBroad = triangle({ centre: 200, halfWidthAtHalfPower: 50.5 });
    expect(spectralQ(reachable, onlyPeak(reachable))?.q).toBeCloseTo(200 / 99, 9);
    expect(spectralQ(tooBroad, onlyPeak(tooBroad))).toBeNull();
  });

  it("counts a point exactly 3 dB down, exactly 50 Hz away", () => {
    const shelf = triangle({ centre: 200, halfWidthAtHalfPower: 5 }).map((p) => {
      if (p.frequency === 150) return { ...p, magnitude: halfPower, db: -3 };
      if (p.frequency > 150 && p.frequency < 200)
        return { ...p, magnitude: 0.9, db: 20 * Math.log10(0.9) };
      return p;
    });
    expect(spectralQ(shelf, onlyPeak(shelf))?.low).toBeCloseTo(150, 9);
  });

  it("gives nothing when the spectrum ends before the level falls 3 dB", () => {
    const edge = triangle({
      centre: 200,
      halfWidthAtHalfPower: 30,
      grid: { from: 190, to: 300, step: 1 },
    });
    expect(spectralQ(edge, onlyPeak(edge))).toBeNull();
  });

  it("gives nothing when only the lower side falls 3 dB within 50 Hz", () => {
    const lopsided = triangle({ centre: 200, halfWidthAtHalfPower: 5 }).map((p) =>
      p.frequency > 200 && p.frequency <= 260
        ? { ...p, magnitude: 0.9, db: 20 * Math.log10(0.9) }
        : p,
    );
    expect(spectralQ(lopsided, onlyPeak(lopsided))).toBeNull();
  });

  it("gives nothing when only the upper side falls 3 dB within 50 Hz", () => {
    const lopsided = triangle({ centre: 200, halfWidthAtHalfPower: 5 }).map((p) =>
      p.frequency < 200 && p.frequency >= 140
        ? { ...p, magnitude: 0.9, db: 20 * Math.log10(0.9) }
        : p,
    );
    expect(spectralQ(lopsided, onlyPeak(lopsided))).toBeNull();
  });

  it("gives nothing for a bandwidth below 0.1 Hz", () => {
    const needle = triangle({
      centre: 200,
      halfWidthAtHalfPower: 0.04,
      grid: { from: 190, to: 210, step: 0.1 },
    });
    expect(spectralQ(needle, onlyPeak(needle))).toBeNull();
    const narrow = triangle({
      centre: 200,
      halfWidthAtHalfPower: 0.06,
      grid: { from: 190, to: 210, step: 0.1 },
    });
    expect(spectralQ(narrow, onlyPeak(narrow))?.bandwidth).toBeCloseTo(0.12, 9);
  });
});
