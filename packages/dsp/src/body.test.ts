import { describe, expect, it } from "vitest";
import { detectPeaks, identifyBodyResonances, reattachRole, type SpectrumPoint } from "./index.ts";
import { pointsFromDb, spikes } from "./test-support/signals.ts";

const binWidth = 1.46484375;
const firstBin = 21;
const hz = (bin: number) => bin * binWidth;

const bodySpectrum = (at: Readonly<Record<number, number>>): readonly SpectrumPoint[] =>
  pointsFromDb(
    spikes({
      count: 662,
      floor: -100,
      at: Object.fromEntries(Object.entries(at).map(([bin, db]) => [Number(bin) - firstBin, db])),
    }),
    { firstBin, binWidth },
  );

const frequencies = (points: readonly SpectrumPoint[]) => {
  const { air, top, back } = identifyBodyResonances(points);
  return {
    air: air?.frequency ?? null,
    top: top?.frequency ?? null,
    back: back?.frequency ?? null,
  };
};

describe("body resonance assignment", () => {
  it("labels a typical assembled body: Air, Top and Back by mode order", () => {
    const result = identifyBodyResonances(bodySpectrum({ 67: -20, 134: -22, 169: -25 }));
    expect(result.air?.frequency).toBe(hz(67));
    expect(result.top?.frequency).toBe(hz(134));
    expect(result.back?.frequency).toBe(hz(169));
    expect(result.top?.level).toBe(-22);
    expect(result.top?.spectralQ.q).toBeGreaterThan(0);
  });

  it("skips a candidate below 1.4 times the air frequency when choosing Top", () => {
    expect(frequencies(bodySpectrum({ 75: -20, 102: -21, 145: -22, 179: -23 }))).toEqual({
      air: hz(75),
      top: hz(145),
      back: hz(179),
    });
  });

  it("takes Top from 140 Hz when 1.4 times the air frequency is lower", () => {
    expect(frequencies(bodySpectrum({ 48: -20, 95: -21, 96: -100, 150: -22 }))).toEqual({
      air: hz(48),
      top: hz(150),
      back: null,
    });
    expect(frequencies(bodySpectrum({ 48: -20, 96: -21, 150: -22 })).top).toBe(hz(96));
  });

  it("chooses the lowest candidate in each range", () => {
    expect(
      frequencies(bodySpectrum({ 60: -30, 80: -20, 120: -31, 150: -20, 180: -32, 230: -20 })),
    ).toEqual({
      air: hz(60),
      top: hz(120),
      back: hz(150),
    });
  });

  it("needs Back at least 15 Hz above Top", () => {
    const backAt = (bin: number) =>
      frequencies(bodySpectrum({ 67: -20, 134: -22, [bin]: -25 })).back;
    expect(backAt(145)).toBe(hz(145));
    expect(backAt(144)).toBeNull();
  });

  it.each([
    [47, null],
    [48, 48],
    [88, 88],
    [89, null],
  ])("accepts an Air candidate only from 70 to 130 Hz (bin %i)", (bin, expected) => {
    expect(frequencies(bodySpectrum({ [bin]: -20 })).air).toBe(
      expected === null ? null : hz(expected),
    );
  });

  it.each([
    [204, 204],
    [205, null],
  ])("accepts a Top candidate only up to 300 Hz (bin %i)", (bin, expected) => {
    expect(frequencies(bodySpectrum({ 67: -20, [bin]: -22 })).top).toBe(
      expected === null ? null : hz(expected),
    );
  });

  it.each([
    [273, 273],
    [274, null],
  ])("accepts a Back candidate only up to 400 Hz (bin %i)", (bin, expected) => {
    expect(frequencies(bodySpectrum({ 67: -20, 134: -22, [bin]: -25 })).back).toBe(
      expected === null ? null : hz(expected),
    );
  });
});

describe("body resonance candidates", () => {
  it("ignores a peak more than 30 dB below the strongest between 60 and 400 Hz", () => {
    expect(frequencies(bodySpectrum({ 67: -52, 134: -20 })).air).toBeNull();
    expect(frequencies(bodySpectrum({ 67: -50, 134: -20 })).air).toBe(hz(67));
  });

  it("measures the 30 dB range only against peaks between 60 and 400 Hz", () => {
    expect(frequencies(bodySpectrum({ 67: -45, 300: -10 })).air).toBe(hz(67));
  });

  it("needs 6 dB of prominence over the 6 points on each side", () => {
    const shoulder = (drop: number, distance: number) =>
      pointsFromDb(
        Array.from({ length: 662 }, (_, i) => {
          if (i === 67 - firstBin) return -20;
          if (Math.abs(i - (67 - firstBin)) === distance) return -20 - drop;
          return -24;
        }),
        { firstBin, binWidth },
      );
    expect(frequencies(shoulder(6, 6)).air).toBe(hz(67));
    expect(frequencies(shoulder(5.9, 6)).air).toBeNull();
    expect(frequencies(shoulder(10, 7)).air).toBeNull();
  });

  it("needs a strict maximum over 3 points on each side", () => {
    const plateau = (distance: number) => bodySpectrum({ 67: -20, [67 + distance]: -20 });
    expect(frequencies(plateau(1)).air).toBeNull();
    expect(frequencies(plateau(3)).air).toBeNull();
  });
});

describe("body resonance candidates, exact edges on a 1 Hz grid", () => {
  const integerGrid = (
    at: Readonly<Record<number, number>>,
    floor = -100,
  ): readonly SpectrumPoint[] =>
    Array.from({ length: 971 }, (_, i) => {
      const frequency = 30 + i;
      const db = at[frequency] ?? floor;
      return { frequency, magnitude: 10 ** (db / 20), db };
    });
  const roles = (at: Readonly<Record<number, number>>) => {
    const { air, top, back } = identifyBodyResonances(integerGrid(at));
    return [air?.frequency ?? null, top?.frequency ?? null, back?.frequency ?? null];
  };

  it("includes 60 and 400 Hz in the band that sets the 30 dB range", () => {
    expect(roles({ 60: -10, 100: -45 })[0]).toBeNull();
    expect(roles({ 400: -10, 100: -45 })[0]).toBeNull();
    expect(roles({ 59: -10, 100: -45 })[0]).toBe(100);
  });

  it("includes the edges of the Air, Top and Back ranges", () => {
    expect(roles({ 70: -20, 140: -20, 400: -20 })).toEqual([70, 140, 400]);
    expect(roles({ 130: -20, 300: -20 })).toEqual([130, 300, null]);
  });

  it("refuses a role with another candidate exactly 15 Hz away, but not 16 Hz", () => {
    expect(roles({ 70: -20, 85: -21 })[0]).toBeNull();
    expect(roles({ 70: -20, 86: -21 })[0]).toBe(70);
  });

  it("does not take a prominent point with a higher neighbour 2 points away for a candidate", () => {
    const shoulder = integerGrid({ 94: -30, 100: -20, 102: -19, 108: -30 }, -27);
    expect(identifyBodyResonances(shoulder).air?.frequency).toBe(102);
  });

  it("needs the 6 dB dip on both sides, not just one", () => {
    const oneSided = integerGrid(
      { 100: -20, 99: -22, 98: -22, 97: -22, 96: -22, 95: -22, 94: -22 },
      -40,
    );
    expect(identifyBodyResonances(oneSided).air).toBeNull();
  });
});

describe("body resonance reliability", () => {
  it("identifies nothing on a free plate with candidates at 152 and 233 Hz", () => {
    expect(frequencies(bodySpectrum({ 104: -20, 159: -22 }))).toEqual({
      air: null,
      top: null,
      back: null,
    });
  });

  it("refuses an Air with another candidate within 15 Hz, and then Top and Back too", () => {
    expect(frequencies(bodySpectrum({ 66: -20, 76: -21, 134: -22, 169: -25 }))).toEqual({
      air: null,
      top: null,
      back: null,
    });
    expect(frequencies(bodySpectrum({ 66: -20, 77: -21 })).air).toBe(hz(66));
  });

  it("refuses a Top that has no spectral Q, and then Back", () => {
    const fine = Array.from({ length: 6801 }, (_, i) => 60 + i * 0.05);
    const points = fine.map((frequency) => {
      const triangle = Math.max(0, 1 - Math.abs(frequency - 100) * 2);
      const needle = Math.abs(frequency - 200) < 0.001 ? 1 : 0;
      const back = Math.max(0, 1 - Math.abs(frequency - 260) * 2);
      const magnitude = Math.max(1e-5, triangle + needle + back);
      return { frequency, magnitude, db: 20 * Math.log10(magnitude) };
    });
    const result = identifyBodyResonances(points);
    expect(result.air?.frequency).toBeCloseTo(100, 6);
    expect(result.top).toBeNull();
    expect(result.back).toBeNull();
  });
});

describe("re-attaching a role the user set", () => {
  const peaks = detectPeaks(bodySpectrum({ 100: -20, 140: -22 }), { mobile: false });

  it("moves it to the detected peak nearest its frequency within 3 Hz", () => {
    expect(reattachRole(hz(140) + 2.9, peaks)?.frequency).toBe(hz(140));
    expect(reattachRole(hz(140) - 3, peaks)?.frequency).toBe(hz(140));
  });

  it("clears it when no detected peak is within 3 Hz", () => {
    expect(reattachRole(hz(140) + 3.1, peaks)).toBeNull();
    expect(reattachRole(200, [])).toBeNull();
  });
});
