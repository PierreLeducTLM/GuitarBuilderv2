import { describe, expect, it } from "vitest";
import { averageSpectrum, detectPeaks, nearestPeak, spectrumPoints, tapPower } from "./index.ts";
import { pointsFromDb, spikes, withTaps } from "./test-support/signals.ts";

const sampleRate = 48000;
const binWidth = 1.46484375;
const grid = { firstBin: 21, binWidth };
const desktop = { mobile: false };

const spikeSpectrum = (at: Readonly<Record<number, number>>) =>
  pointsFromDb(spikes({ count: 662, floor: -100, at }), grid);

const levelsAt = (index: number, levels: readonly number[]) =>
  pointsFromDb(
    spikes({
      count: 662,
      floor: -100,
      at: Object.fromEntries(levels.map((db, j) => [index + j, db])),
    }),
    grid,
  );

describe("peak refinement", () => {
  it("fits a parabola through the dB levels: -30, -20, -26 dB around bin 124", () => {
    const [peak] = detectPeaks(levelsAt(124 - 21 - 1, [-30, -20, -26]), desktop);
    expect(peak?.frequency).toBe(181.82373046875);
    expect(peak?.level).toBe(-19.875);
    expect(peak?.magnitude).toBeCloseTo(0.1, 12);
  });

  it("never moves a peak by more than half a bin", () => {
    const [peak] = detectPeaks(levelsAt(100, [-20 - 1e-9, -20, -60]), desktop);
    const centre = (100 + 1 + 21) * binWidth;
    expect(Math.abs((peak?.frequency ?? 0) - centre)).toBeLessThanOrEqual(binWidth / 2);
    expect(peak?.frequency).toBeLessThan(centre);
  });

  it.each([
    [93.1, 0.05],
    [181.7324, 0.15],
    [182.3, 0.15],
    [250.7, 0.4],
  ])("finds a decaying %f Hz tap (tau %f s) within 0.2 Hz", (frequency, tau) => {
    const signal = withTaps(new Float64Array(2 * sampleRate), [
      { onset: 24000, amplitude: 0.5, tau, frequency },
    ]);
    const points = spectrumPoints(averageSpectrum([tapPower(signal, 24000)]), sampleRate);
    const [peak] = detectPeaks(points, desktop);
    expect(Math.abs((peak?.frequency ?? 0) - frequency)).toBeLessThan(0.2);
  });
});

describe("peak candidates", () => {
  it("accepts a peak at -60 dB but not one just below", () => {
    expect(detectPeaks(spikeSpectrum({ 200: -60 }), desktop)).toHaveLength(1);
    expect(detectPeaks(spikeSpectrum({ 200: -60.001 }), desktop)).toHaveLength(0);
  });

  it("rejects ripple that rises less than 3 dB above its neighbourhood and accepts 3 dB", () => {
    const ripple = (rise: number) =>
      pointsFromDb(
        Array.from({ length: 662 }, (_, i) => (i === 300 ? -45 : -45 - rise)),
        grid,
      );
    expect(detectPeaks(ripple(2), desktop)).toHaveLength(0);
    expect(detectPeaks(ripple(3), desktop)).toHaveLength(1);
  });

  it("measures prominence against the lowest points within 30 Hz on each side", () => {
    const withDipAt = (distance: number) =>
      pointsFromDb(
        Array.from({ length: 662 }, (_, i) => {
          if (i === 300) return -40;
          if (i === 300 - distance || i === 300 + distance) return -80;
          return -42;
        }),
        grid,
      );
    expect(detectPeaks(withDipAt(20), desktop)).toHaveLength(1);
    expect(detectPeaks(withDipAt(21), desktop)).toHaveLength(0);
  });

  it("needs a dip on both sides", () => {
    const oneSided = pointsFromDb(
      Array.from({ length: 662 }, (_, i) => {
        if (i === 300) return -40;
        if (i === 290) return -80;
        return -41;
      }),
      grid,
    );
    expect(detectPeaks(oneSided, desktop)).toHaveLength(0);
  });

  it("covers 10 points per side on an older 2.93 Hz record", () => {
    const legacy = (distance: number) =>
      pointsFromDb(
        Array.from({ length: 331 }, (_, i) => {
          if (i === 150) return -40;
          if (i === 150 - distance || i === 150 + distance) return -80;
          return -42;
        }),
        { firstBin: 11, binWidth: 2.9296875 },
      );
    expect(detectPeaks(legacy(10), desktop)).toHaveLength(1);
    expect(detectPeaks(legacy(11), desktop)).toHaveLength(0);
  });

  it("never takes the first or last point for a peak", () => {
    expect(detectPeaks(spikeSpectrum({ 0: -10, 661: -10 }), desktop)).toHaveLength(0);
  });

  it("needs a strict maximum", () => {
    expect(detectPeaks(spikeSpectrum({ 200: -30, 201: -30 }), desktop)).toHaveLength(0);
  });
});

describe("peak ranking", () => {
  it("keeps candidates within 35 dB of the strongest, loudest first", () => {
    const peaks = detectPeaks(spikeSpectrum({ 100: -57, 200: -22, 300: -57.1, 400: -40 }), desktop);
    expect(peaks.map((p) => p.level)).toEqual([-22, -40, -57]);
  });

  it("keeps the 10 loudest of 14 candidates", () => {
    const at = Object.fromEntries(Array.from({ length: 14 }, (_, i) => [40 + i * 40, -20 - i]));
    const peaks = detectPeaks(spikeSpectrum(at), desktop);
    expect(peaks.map((p) => p.level)).toEqual(Array.from({ length: 10 }, (_, i) => -20 - i));
  });

  it("drops peaks from 132 to 138 Hz on a mobile device, after ranking", () => {
    const at = { [92 - 21]: -20, [125 - 21]: -25 };
    expect(detectPeaks(spikeSpectrum(at), { mobile: true }).map((p) => p.frequency)).toEqual([
      125 * binWidth,
    ]);
    expect(detectPeaks(spikeSpectrum(at), desktop)).toHaveLength(2);
  });

  it.each([
    [90, true],
    [91, false],
    [94, false],
    [95, true],
  ])(
    "on a mobile device, keeps a peak at bin %i (just inside or outside 132-138 Hz): %s",
    (bin, kept) => {
      const peaks = detectPeaks(spikeSpectrum({ [bin - 21]: -20 }), { mobile: true });
      expect(peaks.length === 1).toBe(kept);
    },
  );

  it("applies the mobile exclusion after the top-10 limit", () => {
    const at = Object.fromEntries([
      [92 - 21, -20],
      ...Array.from({ length: 10 }, (_, i) => [200 + i * 40, -21 - i]),
    ]);
    expect(detectPeaks(spikeSpectrum(at), { mobile: true })).toHaveLength(9);
  });
});

describe("nearest peak", () => {
  const peaks = detectPeaks(spikeSpectrum({ 100: -30, 120: -20, 140: -25 }), desktop);
  const frequencyOf = (i: number) => (i + 21) * binWidth;

  it("picks the peak closest to a frequency", () => {
    expect(nearestPeak(peaks, frequencyOf(118))?.frequency).toBe(frequencyOf(120));
  });

  it("breaks a tie in favour of the louder peak", () => {
    expect(nearestPeak(peaks, frequencyOf(110))?.level).toBe(-20);
    expect(nearestPeak(peaks, frequencyOf(130))?.level).toBe(-20);
  });

  it("finds nothing without peaks", () => {
    expect(nearestPeak([], 100)).toBeUndefined();
  });
});
