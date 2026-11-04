import { describe, expect, it } from "vitest";
import { applyBiquad, biquadHighPass } from "./index.ts";
import { sine } from "./test-support/signals.ts";

const sampleRate = 48000;
const handlingFilter = biquadHighPass({ sampleRate, cutoff: 30, q: 10 ** (1 / 20) });

const rms = (signal: Float64Array) =>
  Math.sqrt(signal.reduce((total, x) => total + x * x, 0) / signal.length);

const toneAmplitude = (signal: Float64Array, frequency: number) => {
  const projection = (basis: (phase: number) => number) =>
    (2 / signal.length) *
    signal.reduce(
      (total, x, n) => total + x * basis((2 * Math.PI * frequency * n) / sampleRate),
      0,
    );
  return Math.hypot(projection(Math.sin), projection(Math.cos));
};

const steadyStateGainDb = (frequency: number) => {
  const input = sine({ frequency, sampleRate, length: 4 * sampleRate });
  const output = applyBiquad(input, handlingFilter);
  const lastSecond = (signal: Float64Array) => signal.subarray(3 * sampleRate);
  return 20 * Math.log10(rms(lastSecond(output)) / rms(lastSecond(input)));
};

describe("high-pass pre-filter", () => {
  it("attenuates 15 Hz handling rumble by about 10.9 dB", () => {
    expect(steadyStateGainDb(15)).toBeCloseTo(-10.9, 1);
  });

  it("peaks at +1.0 dB at its 30 Hz cutoff, from its 1 dB resonance", () => {
    expect(steadyStateGainDb(30)).toBeCloseTo(1.0, 1);
  });

  it("leaves a 180 Hz resonance within 0.2 dB", () => {
    expect(Math.abs(steadyStateGainDb(180))).toBeLessThan(0.2);
  });

  it("keeps the signal length", () => {
    const input = sine({ frequency: 100, sampleRate, length: 1234 });
    expect(applyBiquad(input, handlingFilter)).toHaveLength(1234);
  });

  it("starts from rest, so the first output is b0 times the first input", () => {
    const output = applyBiquad(Float64Array.of(1, 0, 0), handlingFilter);
    expect(output[0]).toBeCloseTo(handlingFilter.b0, 15);
  });

  it("removes most of the 15 Hz rumble mixed with a 180 Hz tone and keeps the tone", () => {
    const length = 4 * sampleRate;
    const rumble = sine({ frequency: 15, sampleRate, length, amplitude: 0.5 });
    const tone = sine({ frequency: 180, sampleRate, length, amplitude: 0.1 });
    const output = applyBiquad(
      rumble.map((x, n) => x + (tone[n] ?? 0)),
      handlingFilter,
    ).subarray(sampleRate);
    expect(toneAmplitude(output, 15)).toBeCloseTo(0.5 * 10 ** (-10.86 / 20), 2);
    expect(toneAmplitude(output, 180)).toBeCloseTo(0.1, 2);
  });

  it("does not modify its input", () => {
    const input = sine({ frequency: 50, sampleRate, length: 64 });
    const copy = Float64Array.from(input);
    applyBiquad(input, handlingFilter);
    expect(input).toEqual(copy);
  });
});
