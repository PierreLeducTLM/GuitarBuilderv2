/// <reference types="vite/client" />
import { describe, expect, it } from "vitest";
import { measureDecayQ } from "./index.ts";
import { tapRecording } from "./test-support/signals.ts";

const nightly = import.meta.env.DSP_NIGHTLY === "1";
const seeds = 200;
const expectedQ = Math.PI * 180 * 0.2;

const tapAtSeed = (seed: number) => {
  const recording = tapRecording({
    quietSeconds: 2,
    taps: [{ modes: [{ frequency: 180, amplitude: 0.03, tau: 0.2 }], seconds: 1.5 }],
    sigma: 1e-2,
    seed,
  });
  return measureDecayQ({
    signal: recording.signal,
    onsets: recording.onsets,
    used: recording.onsets,
    peak: { frequency: 180, level: -20, bandwidth: null },
    others: [],
  }).taps[0];
};

describe("decay Q Monte Carlo (nightly)", () => {
  it.runIf(nightly)(
    "stays within 5 % RMS per tap near the 10 dB minimum range, rejecting at most 3 % as not exponential",
    () => {
      const taps = Array.from({ length: seeds }, (_, i) => tapAtSeed(1000 + i));
      const errors = taps.flatMap((tap) =>
        tap?.q === null || tap?.q === undefined ? [] : [tap.q / expectedQ - 1],
      );
      const rms = Math.sqrt(errors.reduce((total, e) => total + e * e, 0) / errors.length);
      const notExponential = taps.filter((tap) => tap?.reason === "NOT_EXPONENTIAL").length;
      expect(errors.length).toBeGreaterThan(0);
      expect(rms).toBeLessThanOrEqual(0.05);
      expect(notExponential / seeds).toBeLessThanOrEqual(0.03);
    },
    120000,
  );
});
