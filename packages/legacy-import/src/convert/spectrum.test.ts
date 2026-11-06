import type { SpectrumRecord } from "@gb/db";
import { describe, expect, it } from "vitest";
import { MAX_SPECTRUM_POINTS, prepareSpectrum } from "./spectrum.ts";

const SAMPLE_RATE = 16384;
const FFT_SIZE = 32768;
const BIN_WIDTH = SAMPLE_RATE / FFT_SIZE;

/** A record of `count` half-hertz bins from 20 Hz, with magnitudes from `level`. */
const record = (count: number, level: (index: number) => number = () => 0.001): SpectrumRecord => {
  const indexes = Array.from({ length: count }, (_, i) => i);
  return {
    frequencies: indexes.map((i) => (40 + i) * BIN_WIDTH),
    magnitudes: indexes.map(level),
    magnitudesDb: indexes.map((i) => 20 * Math.log10(level(i))),
    sampleRate: SAMPLE_RATE,
    fftSize: FFT_SIZE,
    binWidth: BIN_WIDTH,
  };
};

describe("prepareSpectrum", () => {
  it("returns a valid record unchanged", () => {
    const valid = record(300);

    expect(prepareSpectrum(valid)).toEqual({ kind: "unchanged", record: valid });
  });

  it("keeps only the six record fields", () => {
    const valid = record(3);

    expect(prepareSpectrum({ ...valid, peaks: [1, 2] })).toEqual({
      kind: "unchanged",
      record: valid,
    });
  });

  it("keeps a record of exactly 1024 points", () => {
    expect(prepareSpectrum(record(MAX_SPECTRUM_POINTS))).toMatchObject({ kind: "unchanged" });
  });

  it("reduces an oversized record by keeping the loudest point of each run", () => {
    const peakIndex = 111;
    const oversized = record(1366, (i) => (i === peakIndex ? 0.5 : 0.001 + (i % 2) * 0.0001));

    const result = prepareSpectrum(oversized);

    expect(result.kind).toBe("reduced");
    if (result.kind !== "reduced") return;
    expect(result.from).toBe(1366);
    expect(result.to).toBe(683);
    expect(result.record.frequencies).toHaveLength(683);
    expect(result.record.frequencies[55]).toBe(oversized.frequencies[peakIndex]);
    expect(result.record.magnitudes[55]).toBe(0.5);
    expect(result.record.magnitudesDb[55]).toBe(oversized.magnitudesDb[peakIndex]);
    expect(result.record.frequencies[0]).toBe(oversized.frequencies[1]);
    expect(result.record.magnitudes[0]).toBe(oversized.magnitudes[1]);
    expect(result.record).toMatchObject({
      sampleRate: SAMPLE_RATE,
      fftSize: FFT_SIZE,
      binWidth: BIN_WIDTH,
    });
    expect(prepareSpectrum(result.record)).toEqual({ kind: "unchanged", record: result.record });
  });

  it("uses runs long enough to fit 1024 points, the last run shorter", () => {
    const result = prepareSpectrum(record(2050, (i) => 1 + i));

    expect(result).toMatchObject({ kind: "reduced", from: 2050, to: 684 });
    if (result.kind !== "reduced") return;
    expect(result.record.magnitudes.slice(0, 2)).toEqual([3, 6]);
    expect(result.record.magnitudes.at(-1)).toBe(2050);
  });

  it("keeps the first point of a run on a tie", () => {
    const result = prepareSpectrum(record(1025, () => 0.25));

    expect(result.kind === "reduced" && result.record.frequencies[0]).toBe(40 * BIN_WIDTH);
  });

  it.each([
    ["not an object", 42, "not a spectrum record"],
    ["null", null, "not a spectrum record"],
    ["missing", undefined, "not a spectrum record"],
    ["missing lists", { sampleRate: 1, fftSize: 1, binWidth: 1 }, "not a spectrum record"],
    ["a non-numeric sample rate", { ...record(3), sampleRate: "48000" }, "not a spectrum record"],
    ["a non-numeric FFT size", { ...record(3), fftSize: null }, "not a spectrum record"],
    ["a non-numeric bin width", { ...record(3), binWidth: undefined }, "not a spectrum record"],
    ["a non-list of magnitudes", { ...record(3), magnitudes: "x" }, "not a spectrum record"],
    ["a non-list of dB values", { ...record(3), magnitudesDb: {} }, "not a spectrum record"],
    ["no points", record(0), "no points"],
    [
      "fewer magnitudes than frequencies",
      { ...record(3), magnitudes: [0.1, 0.2] },
      "lists of different lengths",
    ],
    [
      "fewer dB values than frequencies",
      { ...record(3), magnitudesDb: [-1] },
      "lists of different lengths",
    ],
    [
      "a frequency that is not a number",
      { ...record(3), frequencies: [30, "31", 32] },
      "a value that is not a number",
    ],
    [
      "a magnitude that is not a number",
      { ...record(3), magnitudes: [0.1, null, 0.2] },
      "a value that is not a number",
    ],
    [
      "a dB value that is not a number",
      { ...record(3), magnitudesDb: [-1, -2, "x"] },
      "a value that is not a number",
    ],
    [
      "a zero frequency",
      { ...record(3), frequencies: [0, 1, 2] },
      "a frequency outside (0, 2000] Hz",
    ],
    [
      "a frequency above 2000 Hz",
      { ...record(3), frequencies: [1999, 2000, 2000.5] },
      "a frequency outside (0, 2000] Hz",
    ],
    [
      "equal frequencies",
      { ...record(3), frequencies: [30, 31, 31] },
      "frequencies not strictly ascending",
    ],
    [
      "descending frequencies",
      { ...record(3), frequencies: [30, 29, 31] },
      "frequencies not strictly ascending",
    ],
    [
      "a negative magnitude",
      { ...record(3), magnitudes: [0.1, -0.1, 0.2] },
      "a negative magnitude",
    ],
    ["a zero sample rate", { ...record(3), sampleRate: 0 }, "an invalid sample rate"],
    [
      "an FFT size that is not a power of two",
      { ...record(3), fftSize: 3000 },
      "an invalid FFT size",
    ],
    ["an FFT size above 32768", { ...record(3), fftSize: 65536 }, "an invalid FFT size"],
    [
      "a bin width that does not match",
      { ...record(3), binWidth: BIN_WIDTH * 1.001 },
      "a bin width that does not match the sample rate and FFT size",
    ],
    [
      "a bin width just outside rounding",
      { ...record(3), binWidth: BIN_WIDTH + 1e-9 },
      "a bin width that does not match the sample rate and FFT size",
    ],
  ])("refuses %s", (_label, value, reason) => {
    expect(prepareSpectrum(value)).toEqual({ kind: "refused", reason });
  });

  it("accepts the smallest and largest FFT sizes, and a 2000 Hz top frequency", () => {
    const single = { ...record(1), frequencies: [2000], sampleRate: 1, fftSize: 1, binWidth: 1 };
    expect(prepareSpectrum(single)).toMatchObject({ kind: "unchanged" });
    expect(
      prepareSpectrum({ ...record(3), sampleRate: 32768, fftSize: 32768, binWidth: 1 }),
    ).toMatchObject({ kind: "unchanged" });
  });

  it("accepts a zero magnitude and a bin width within rounding", () => {
    expect(
      prepareSpectrum({
        ...record(3),
        magnitudes: [0, 0.1, 0.2],
        binWidth: BIN_WIDTH * (1 + 5e-10),
      }),
    ).toMatchObject({ kind: "unchanged" });
  });
});
