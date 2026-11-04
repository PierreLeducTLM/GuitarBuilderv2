import { describe, expect, it } from "vitest";
import { fft, hann, inverseFft, realSpectrum } from "./index.ts";
import { randomSignal, sine } from "./test-support/signals.ts";

const directDft = (re: Float64Array, im: Float64Array) => {
  const n = re.length;
  const outRe = new Float64Array(n);
  const outIm = new Float64Array(n);
  for (let k = 0; k < n; k += 1) {
    for (let t = 0; t < n; t += 1) {
      const angle = (-2 * Math.PI * k * t) / n;
      outRe[k] = (outRe[k] ?? 0) + (re[t] ?? 0) * Math.cos(angle) - (im[t] ?? 0) * Math.sin(angle);
      outIm[k] = (outIm[k] ?? 0) + (re[t] ?? 0) * Math.sin(angle) + (im[t] ?? 0) * Math.cos(angle);
    }
  }
  return { re: outRe, im: outIm };
};

const maxAbsDifference = (a: Float64Array, b: Float64Array) =>
  a.reduce((max, value, i) => Math.max(max, Math.abs(value - (b[i] ?? Number.NaN))), 0);

describe("fast Fourier transform", () => {
  it.each([1, 2, 8, 64, 512, 4096])("matches a direct DFT for %i complex samples", (size) => {
    const re = randomSignal(size, size);
    const im = randomSignal(size, size + 1);
    const expected = directDft(re, im);
    const actual = fft({ re, im });
    expect(maxAbsDifference(actual.re, expected.re)).toBeLessThan(1e-9 * size);
    expect(maxAbsDifference(actual.im, expected.im)).toBeLessThan(1e-9 * size);
  });

  it("leaves its input untouched", () => {
    const re = randomSignal(16, 3);
    const im = randomSignal(16, 4);
    const copy = { re: Float64Array.from(re), im: Float64Array.from(im) };
    fft({ re, im });
    expect(re).toEqual(copy.re);
    expect(im).toEqual(copy.im);
  });

  it("returns the input after a forward and an inverse transform", () => {
    const re = randomSignal(1024, 5);
    const im = randomSignal(1024, 6);
    const roundTrip = inverseFft(fft({ re, im }));
    expect(maxAbsDifference(roundTrip.re, re)).toBeLessThan(1e-12);
    expect(maxAbsDifference(roundTrip.im, im)).toBeLessThan(1e-12);
  });

  it.each([0, 3, 12, 1000])("refuses %i samples, which is not a power of two", (size) => {
    const signal = new Float64Array(size);
    expect(() => fft({ re: signal, im: signal })).toThrow("power of two");
  });

  it("refuses real and imaginary parts of different lengths", () => {
    expect(() => fft({ re: new Float64Array(8), im: new Float64Array(4) })).toThrow("same length");
  });
});

describe("real spectrum", () => {
  it("returns the first half of the transform of a real frame", () => {
    const frame = randomSignal(256, 7);
    const full = directDft(frame, new Float64Array(256));
    const half = realSpectrum(frame);
    expect(half.re).toHaveLength(128);
    expect(maxAbsDifference(half.re, full.re.subarray(0, 128))).toBeLessThan(1e-9);
    expect(maxAbsDifference(half.im, full.im.subarray(0, 128))).toBeLessThan(1e-9);
  });
});

describe("Hann window", () => {
  it("is w[n] = 0.5 - 0.5 cos(2 pi n / (N - 1)), zero at both ends and one in the middle", () => {
    const { values } = hann(9);
    expect(Array.from(values)).toEqual(
      Array.from({ length: 9 }, (_, n) => 0.5 - 0.5 * Math.cos((2 * Math.PI * n) / 8)),
    );
    expect(values[0]).toBe(0);
    expect(values[4]).toBeCloseTo(1, 15);
    expect(values[8]).toBeCloseTo(0, 15);
  });

  it("hands back the same window for the same size instead of rebuilding it", () => {
    expect(hann(2048)).toBe(hann(2048));
    expect(hann(2048)).not.toBe(hann(1024));
  });

  it("reports the sum of its values, (N - 1) / 2", () => {
    expect(hann(9).sum).toBeCloseTo(4, 12);
    expect(hann(32768).sum).toBeCloseTo(16383.5, 6);
  });

  it("calibrates a full-scale 375 Hz sine at bin 256 of a 32768-point frame to 1.0", () => {
    const size = 32768;
    const { values, sum } = hann(size);
    const tone = sine({ frequency: 375, sampleRate: 48000, length: size });
    const spectrum = realSpectrum(tone.map((x, n) => x * (values[n] ?? 0)));
    const magnitude = (2 / sum) * Math.hypot(spectrum.re[256] ?? 0, spectrum.im[256] ?? 0);
    expect(magnitude).toBeCloseTo(1, 3);
  });
});
