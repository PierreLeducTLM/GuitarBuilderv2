import { describe, expect, it } from "vitest";
import { spectrumPoints, spectrumX, spectrumY } from "./spectrum";

describe("spectrum graph coordinates", () => {
  it("maps 20-600 Hz linearly across the width", () => {
    expect(spectrumX(20)).toBe(0);
    expect(spectrumX(600)).toBe(1);
    expect(spectrumX(310)).toBeCloseTo(0.5);
  });

  it("maps 0 dB to the top and -100 dB to the bottom, clamping beyond", () => {
    expect(spectrumY(0)).toBe(0);
    expect(spectrumY(-100)).toBe(1);
    expect(spectrumY(-50)).toBe(0.5);
    expect(spectrumY(-20)).toBe(0.2);
    expect(spectrumY(-120)).toBe(1);
    expect(spectrumY(3)).toBe(0);
  });

  it("plots points in ascending frequency and only within 20-600 Hz", () => {
    const points = spectrumPoints({
      frequencies: [2.9, 310, 165, 600, 603],
      magnitudes: [1, 1, 1, 1, 1],
      magnitudesDb: [-30, -60, -120, -20, -40],
      sampleRate: 48000,
      fftSize: 16384,
      binWidth: 2.9296875,
    });
    expect(points.map((p) => [Number(p.x.toFixed(4)), p.y])).toEqual([
      [0.25, 1],
      [0.5, 0.6],
      [1, 0.2],
    ]);
  });
});
