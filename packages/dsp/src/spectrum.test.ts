import { describe, expect, it } from "vitest";
import { averageSpectrum, hann, spectrumPoints, tapPower } from "./index.ts";
import { sine } from "./test-support/signals.ts";

const sampleRate = 48000;
const fftSize = 32768;
const binWidth = sampleRate / fftSize;

const fullScaleTone = (frequency: number, length = 4 * sampleRate) =>
  sine({ frequency, sampleRate, length });

const magnitudeAt = (frequency: number, magnitudes: Float64Array) =>
  magnitudes[Math.round(frequency / binWidth)] ?? Number.NaN;

describe("tap spectrum", () => {
  it("reads 1.0 (0 dB) for a full-scale sine centred on bin 256", () => {
    const power = tapPower(fullScaleTone(375), 48000);
    expect(magnitudeAt(375, averageSpectrum([power]))).toBeCloseTo(1, 3);
  });

  it("places the onset 8192 samples into a 32768-point Hann window", () => {
    const impulseAt = (sample: number) =>
      Float64Array.from({ length: 2 * sampleRate }, (_, n) => (n === sample ? 1 : 0));
    const { values, sum } = hann(fftSize);
    const flatLevel = (offsetFromOnset: number) =>
      averageSpectrum([tapPower(impulseAt(48000 + offsetFromOnset), 48000)])[300];
    expect(flatLevel(0)).toBeCloseTo((2 / sum) * (values[8192] ?? 0), 15);
    expect(flatLevel(-8192)).toBe(0);
    expect(flatLevel(1000)).toBeCloseTo((2 / sum) * (values[9192] ?? 0), 15);
  });

  it("treats audio before the start of the recording as silence", () => {
    const tone = fullScaleTone(375);
    const padded = Float64Array.from({ length: tone.length + 7192 }, (_, n) =>
      n < 7192 ? 0 : (tone[n - 7192] ?? 0),
    );
    const early = averageSpectrum([tapPower(tone, 1000)]);
    const reference = averageSpectrum([tapPower(padded, 8192)]);
    expect(Array.from(early.subarray(0, 700))).toEqual(Array.from(reference.subarray(0, 700)));
  });

  it("treats audio after the end of the recording as silence", () => {
    const tone = fullScaleTone(375, 30000);
    const padded = Float64Array.from({ length: 60000 }, (_, n) => tone[n] ?? 0);
    expect(averageSpectrum([tapPower(tone, 20000)])).toEqual(
      averageSpectrum([tapPower(padded, 20000)]),
    );
  });

  it("averages taps by power: amplitudes 1 and 0.5 give sqrt((1 + 0.25) / 2)", () => {
    const loud = tapPower(fullScaleTone(375), 48000);
    const soft = tapPower(
      fullScaleTone(375).map((x) => x / 2),
      48000,
    );
    expect(magnitudeAt(375, averageSpectrum([loud, soft]))).toBeCloseTo(Math.sqrt(1.25 / 2), 3);
  });

  it("uses only the taps it is given", () => {
    const at = (frequency: number) => tapPower(fullScaleTone(frequency), 48000);
    const twoTaps = averageSpectrum([at(375), at(750)]);
    expect(magnitudeAt(375, twoTaps)).toBeCloseTo(Math.SQRT1_2, 3);
    expect(magnitudeAt(375, averageSpectrum([at(750)]))).toBeLessThan(1e-6);
  });

  it("refuses to average no taps", () => {
    expect(() => averageSpectrum([])).toThrow("at least one tap");
  });
});

describe("spectrum points", () => {
  it("keeps the 662 bins from 30.76171875 Hz to 999.0234375 Hz at 48 kHz", () => {
    const points = spectrumPoints(
      averageSpectrum([tapPower(fullScaleTone(375), 48000)]),
      sampleRate,
    );
    expect(points).toHaveLength(662);
    expect(points[0]?.frequency).toBe(30.76171875);
    expect(points.at(-1)?.frequency).toBe(999.0234375);
    expect(points[1]?.frequency).toBe(30.76171875 + binWidth);
  });

  it("gives each point its magnitude and level in dB", () => {
    const magnitudes = averageSpectrum([tapPower(fullScaleTone(375), 48000)]);
    const point = spectrumPoints(magnitudes, sampleRate).find((p) => p.frequency === 375);
    expect(point?.magnitude).toBe(magnitudes[256]);
    expect(point?.db).toBeCloseTo(20 * Math.log10(magnitudes[256] ?? 0), 12);
  });

  it("floors silent bins at -200 dB", () => {
    const silent = averageSpectrum([tapPower(new Float64Array(sampleRate), 24000)]);
    expect(spectrumPoints(silent, sampleRate).every((p) => p.db === -200)).toBe(true);
  });
});
