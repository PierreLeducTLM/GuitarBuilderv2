import { describe, expect, it } from "vitest";
import { isolateResonance, measureDecayQ, tapSegment } from "./index.ts";
import {
  gaussianNoise,
  type Mode,
  type RingingTap,
  ringing,
  tapRecording,
} from "./test-support/signals.ts";

const sampleRate = 48000;
const toneSamplesGivingEightFitted = 696;

const measureTaps = (options: {
  taps: readonly RingingTap[];
  sigma: number;
  frequency: number;
  listed?: readonly number[];
  quietSeconds?: number;
  seed?: number;
}) => {
  const recording = tapRecording({
    quietSeconds: options.quietSeconds ?? 2,
    taps: options.taps,
    sigma: options.sigma,
    seed: options.seed ?? 21,
  });
  const listed = options.listed ?? options.taps.flatMap((tap) => tap.modes.map((m) => m.frequency));
  const result = measureDecayQ({
    signal: recording.signal,
    onsets: recording.onsets,
    used: recording.onsets,
    peak: { frequency: options.frequency, level: -20, bandwidth: null },
    others: listed
      .filter((frequency) => frequency !== options.frequency)
      .map((frequency) => ({ frequency, level: -20 })),
  });
  return { recording, result };
};

const measureOne = (options: {
  modes: readonly Mode[];
  sigma: number;
  seconds?: number;
  frequency?: number;
  listed?: readonly number[];
  quietSeconds?: number;
}) => {
  const { result, recording } = measureTaps({
    ...options,
    taps: [{ modes: options.modes, seconds: options.seconds ?? 1.5 }],
    frequency: options.frequency ?? options.modes[0]?.frequency ?? 0,
  });
  return { result, recording, tap: result.taps[0] };
};

const mode = (frequency: number, amplitude: number, tau: number): Mode => ({
  frequency,
  amplitude,
  tau,
});

const withinPercent = (actual: number | null | undefined, expected: number, percent: number) =>
  expect(Math.abs((actual ?? Number.NaN) / expected - 1) * 100).toBeLessThanOrEqual(percent);

const leastSquares = (times: readonly number[], levels: readonly number[]) => {
  const n = times.length;
  const meanT = times.reduce((a, b) => a + b, 0) / n;
  const meanL = levels.reduce((a, b) => a + b, 0) / n;
  const sxx = times.reduce((total, t) => total + (t - meanT) ** 2, 0);
  const sxy = times.reduce((total, t, i) => total + (t - meanT) * ((levels[i] ?? 0) - meanL), 0);
  const slope = sxy / sxx;
  const intercept = meanL - slope * meanT;
  const residual = Math.sqrt(
    times.reduce((total, t, i) => total + ((levels[i] ?? 0) - intercept - slope * t) ** 2, 0) / n,
  );
  return { slope, intercept, residual };
};

describe("decay Q of one tap", () => {
  it("measures tau = 0.2 s and Q = 113.1 for a clean 180 Hz resonance, ending at the noise near 1.29 s", () => {
    const { result, tap } = measureOne({ modes: [mode(180, 0.5, 0.2)], sigma: 1e-3 });
    expect(result.isolation.kernelSeconds).toBe(0.02);
    expect(tap?.reason).toBeNull();
    withinPercent(tap?.tau, 0.2, 1);
    withinPercent(tap?.q, 113.1, 1);
    expect(tap?.interval?.endedBy).toBe("noise");
    expect(Math.abs((tap?.interval?.end ?? 0) - 1.29)).toBeLessThanOrEqual(0.05);
    expect(tap?.fit?.range).toBeGreaterThan(40);
    expect(tap?.fit?.residual).toBeLessThan(0.5);
    expect(tap?.fit?.ratio).toBeGreaterThanOrEqual(0.95);
    expect(tap?.fit?.ratio).toBeLessThanOrEqual(1.05);
  });

  it("fits the dB envelope by least squares from 5 ms after the kernel to the last sample 20 dB above the noise", () => {
    const { result, recording, tap } = measureOne({ modes: [mode(180, 0.5, 0.2)], sigma: 1e-3 });
    const onset = recording.onsets[0] ?? 0;
    const { start, end } = tapSegment({
      onset,
      onsets: recording.onsets,
      length: recording.signal.length,
    });
    const isolated = isolateResonance({
      samples: recording.signal.subarray(start, end),
      frequency: 180,
      halfLength: 10,
    });
    const threshold = result.noise?.threshold ?? 0;
    const below = isolated.envelope.findIndex((e, i) => i >= 5 && e < threshold);
    const times = [...isolated.times.slice(5, below)];
    const levels = [...isolated.envelope.slice(5, below)].map((e) => 20 * Math.log10(e));
    const line = leastSquares(times, levels);
    const half = Math.floor(times.length / 2);
    const first = leastSquares(times.slice(0, half), levels.slice(0, half));
    const second = leastSquares(times.slice(half), levels.slice(half));
    const tStart = times[0] ?? 0;
    const tEnd = times.at(-1) ?? 0;
    expect(tStart).toBeCloseTo((48 * 15 + 94) / sampleRate, 12);
    expect(tap?.interval).toEqual({
      start: tStart,
      end: tEnd,
      samples: times.length,
      endedBy: "noise",
    });
    const close = (actual: number | null | undefined, expected: number) =>
      expect(Math.abs((actual ?? Number.NaN) - expected)).toBeLessThan(1e-9 * Math.abs(expected));
    close(tap?.fit?.slope, line.slope);
    close(tap?.fit?.intercept, line.intercept);
    close(tap?.fit?.residual, line.residual);
    close(tap?.fit?.tau, -8.6859 / line.slope);
    close(tap?.fit?.range, -line.slope * (tEnd - tStart));
    close(tap?.fit?.firstTau, -8.6859 / first.slope);
    close(tap?.fit?.secondTau, -8.6859 / second.slope);
    close(tap?.fit?.ratio, first.slope / second.slope);
    close(tap?.q, Math.PI * 180 * (-8.6859 / line.slope));
    close(tap?.tau, -8.6859 / line.slope);
  });

  it("runs to the end of the segment when the floor is digital silence (Q 113.1 within 0.1 %)", () => {
    const { result, tap } = measureOne({ modes: [mode(180, 0.5, 0.2)], sigma: 0 });
    expect(result.noise?.effective).toBe(1e-6);
    expect(tap?.interval?.endedBy).toBe("recordingEnd");
    withinPercent(tap?.q, 113.1, 0.1);
  });

  it.each([
    [35, 0.1],
    [12, 0.2917],
    [7, 0.5],
  ])(
    "adds no settling bias with an absent neighbour listed %i Hz away (kernel %f s)",
    (spacing, kernelSeconds) => {
      const { result, tap } = measureOne({
        modes: [mode(180, 0.5, 0.2)],
        sigma: 0,
        listed: [180, 180 + spacing],
      });
      expect(result.isolation.kernelSeconds).toBeCloseTo(kernelSeconds, 4);
      withinPercent(tap?.q, 113.1, 0.1);
    },
  );

  it("measures each of two listed modes 12 Hz apart (Q 113.1 and 181.0)", () => {
    const modes = [mode(180, 0.5, 0.2), mode(192, 0.5, 0.3)];
    const low = measureOne({ modes, sigma: 1e-4 });
    const high = measureOne({ modes, sigma: 1e-4, frequency: 192 });
    expect(low.result.isolation.kernelLength).toBe(293);
    withinPercent(low.tap?.q, 113.1, 1);
    withinPercent(high.tap?.q, Math.PI * 192 * 0.3, 1);
    expect(low.tap?.fit?.residual).toBeLessThan(0.2);
    expect(high.tap?.fit?.residual).toBeLessThan(0.2);
  });

  it("measures the weaker of two modes 12 Hz apart when the other is 20 dB louder", () => {
    const { tap } = measureOne({ modes: [mode(180, 0.5, 0.2), mode(192, 5, 0.3)], sigma: 1e-4 });
    withinPercent(tap?.q, 113.1, 1);
    expect(tap?.fit?.residual).toBeLessThan(0.6);
  });

  it("refuses a mode beating with an unlisted neighbour 12 Hz away as not exponential", () => {
    const { result, tap } = measureOne({
      modes: [mode(180, 0.5, 0.2), mode(192, 0.5, 0.3)],
      sigma: 1e-4,
      listed: [180],
    });
    expect(result.isolation.kernelSeconds).toBe(0.02);
    expect(tap?.reason).toBe("NOT_EXPONENTIAL");
    expect(tap?.q).toBeNull();
    expect(tap?.fit?.residual).toBeGreaterThan(1);
  });

  it("refuses a 2.5 Hz beat as not exponential, with a residual above 2.5 dB", () => {
    const { tap } = measureOne({
      modes: [mode(180, 0.5, 0.2), mode(182.5, 0.25, 0.2)],
      sigma: 1e-4,
      listed: [180],
    });
    expect(tap?.reason).toBe("NOT_EXPONENTIAL");
    expect(tap?.fit?.residual).toBeGreaterThan(2.5);
  });

  it("accepts a weak beat (amplitude ratio 0.1) within 2 %", () => {
    const { tap } = measureOne({
      modes: [mode(180, 0.5, 0.2), mode(182.5, 0.05, 0.2)],
      sigma: 1e-4,
      listed: [180],
    });
    expect(tap?.reason).toBeNull();
    withinPercent(tap?.q, 113.1, 2);
  });

  it("refuses a two-stage decay whose late rate is about half the early one", () => {
    const { tap } = measureOne({
      modes: [mode(180, 0.5, 0.08), mode(180.5, 0.05, 0.4)],
      sigma: 1e-5,
      listed: [180],
    });
    expect(tap?.reason).toBe("NOT_EXPONENTIAL");
    expect(tap?.fit?.ratio).toBeGreaterThan(1.43);
  });

  it("measures a Q of 20 next to a neighbour 50 Hz away within 2 %", () => {
    const { result, tap } = measureOne({
      modes: [mode(250, 0.5, 20 / (Math.PI * 250)), mode(300, 0.5, 0.05)],
      sigma: 1e-4,
    });
    expect(result.isolation.kernelSeconds).toBe(0.07);
    withinPercent(tap?.q, 20, 2);
  });

  it("measures a 40 Hz mode through its image-sized kernel (Q 12.57)", () => {
    const { tap } = measureOne({ modes: [mode(40, 0.5, 0.1)], sigma: 1e-4 });
    withinPercent(tap?.q, 12.57, 1);
  });

  it("measures 180 Hz next to a strong 820 Hz mode that aliases onto it", () => {
    const { tap } = measureOne({ modes: [mode(180, 0.05, 0.2), mode(820, 0.5, 0.4)], sigma: 1e-5 });
    withinPercent(tap?.q, 113.1, 1);
  });

  it("measures two modes 7 Hz apart (Q 188.5)", () => {
    const { tap } = measureOne({ modes: [mode(200, 0.5, 0.3), mode(207, 0.5, 0.3)], sigma: 1e-4 });
    withinPercent(tap?.q, 188.5, 1);
  });
});

describe("decay Q refusals for one tap", () => {
  it("calls a 0.6 s segment of a tau 0.6 s decay cut off (8.3 dB at 0.588 s)", () => {
    const { tap } = measureOne({ modes: [mode(200, 0.5, 0.6)], sigma: 1e-4, seconds: 0.6 });
    expect(tap?.reason).toBe("DECAY_CUT_OFF");
    expect(tap?.interval?.endedBy).toBe("recordingEnd");
    expect(tap?.interval?.end).toBeCloseTo((48 * 586 + 94) / sampleRate, 12);
    expect(Math.abs((tap?.fit?.range ?? 0) - 8.3)).toBeLessThanOrEqual(0.3);
  });

  it("accepts the same decay over 1.0 s (14 dB, Q 377.0)", () => {
    const { tap } = measureOne({ modes: [mode(200, 0.5, 0.6)], sigma: 1e-4, seconds: 1 });
    expect(tap?.reason).toBeNull();
    expect(tap?.interval?.endedBy).toBe("recordingEnd");
    expect(Math.abs((tap?.fit?.range ?? 0) - 14)).toBeLessThanOrEqual(0.3);
    withinPercent(tap?.q, 377, 1);
  });

  it("finds not enough decay in pure noise", () => {
    const { tap } = measureOne({ modes: [], frequency: 180, sigma: 1e-3, seconds: 1 });
    expect(tap?.reason).toBe("NOT_ENOUGH_DECAY");
    expect(tap?.interval?.samples).toBeLessThan(8);
    expect(tap?.fit).toBeNull();
  });

  it("finds not enough decay when the resonance reaches the noise less than 10 dB down", () => {
    const { tap } = measureOne({ modes: [mode(180, 0.002, 0.2)], sigma: 1e-3 });
    expect(tap?.interval?.endedBy).toBe("noise");
    expect(tap?.fit?.range).toBeLessThan(10);
    expect(tap?.reason).toBe("NOT_ENOUGH_DECAY");
  });

  it("finds no decay in a growing resonance", () => {
    const { tap } = measureOne({ modes: [mode(180, 0.01, -0.5)], sigma: 1e-4 });
    expect(tap?.reason).toBe("NO_DECAY");
    expect(tap?.fit?.slope).toBeGreaterThan(0);
  });

  it("needs 8 envelope samples after the start to try a fit", () => {
    const tapOf = (samples: number) =>
      measureOne({ modes: [mode(180, 0.5, 0.01)], sigma: 1e-4, seconds: samples / sampleRate }).tap;
    const enough = tapOf(189 + 48 * 32);
    expect(enough?.interval?.samples).toBe(8);
    expect(enough?.fit).not.toBeNull();
    expect(tapOf(189 + 48 * 31)).toEqual({
      onset: expect.any(Number),
      q: null,
      tau: null,
      reason: "DECAY_CUT_OFF",
      interval: null,
      fit: null,
    });
  });

  it("needs 8 fitted samples above the noise margin", () => {
    const cutAt = (samples: number) => {
      const tone = ringing([mode(180, 0.1, 1e9)], samples);
      const signal = new Float64Array(96480 + 48000);
      signal.set(tone, 96480);
      return measureDecayQ({
        signal,
        onsets: [96480],
        used: [96480],
        peak: { frequency: 180, level: -20, bandwidth: null },
        others: [],
      }).taps[0];
    };
    const eight = cutAt(toneSamplesGivingEightFitted);
    expect(eight?.interval?.samples).toBe(8);
    expect(eight?.fit).not.toBeNull();
    const seven = cutAt(toneSamplesGivingEightFitted - 48);
    expect(seven?.interval?.samples).toBe(7);
    expect(seven?.reason).toBe("NOT_ENOUGH_DECAY");
    expect(seven?.fit).toBeNull();
  });
});

describe("decay Q fit edges", () => {
  const afterQuiet = (tap: Float64Array, sigma: number) => {
    const signal = gaussianNoise({ length: 96480 + tap.length, rms: sigma, seed: 22 });
    tap.forEach((x, n) => {
      signal[96480 + n] = (signal[96480 + n] ?? 0) + x;
    });
    return measureDecayQ({
      signal,
      onsets: [96480],
      used: [96480],
      peak: { frequency: 180, level: -20, bandwidth: null },
      others: [],
    }).taps[0];
  };

  const toneFrom = (start: number) => {
    const segment = new Float64Array(4800);
    segment.set(ringing([mode(180, 0.5, 1e9)], 4800 - start), start);
    return segment;
  };

  it("looks for the noise margin only from the fit start onwards", () => {
    const risingBeforeStart = afterQuiet(toneFrom(1260), 0);
    expect(risingBeforeStart?.interval).toMatchObject({ samples: 72, endedBy: "recordingEnd" });
    expect(risingBeforeStart?.reason).toBe("NO_DECAY");
  });

  it("finds not enough decay when the fit start itself is below the noise margin", () => {
    const risingAfterStart = afterQuiet(toneFrom(1300), 0);
    expect(risingAfterStart?.reason).toBe("NOT_ENOUGH_DECAY");
    expect(risingAfterStart?.interval).toMatchObject({ samples: 0, endedBy: "noise" });
    expect(risingAfterStart?.fit).toBeNull();
  });

  const curvedDecay = (options: { tau: number; curvature: number }) =>
    Float64Array.from({ length: 28800 }, (_, n) => {
      const t = n / sampleRate;
      const exponent = -t / options.tau + options.curvature * t * t;
      return 0.5 * Math.exp(exponent) * Math.sin(2 * Math.PI * 180 * t);
    });

  it("refuses a decay that speeds up, with a late rate above 1/0.70 of the early one", () => {
    const tap = afterQuiet(curvedDecay({ tau: 0.417, curvature: -2.88 }), 1e-4);
    expect(tap?.fit?.residual).toBeLessThanOrEqual(1);
    expect(tap?.fit?.range).toBeGreaterThanOrEqual(10);
    expect(tap?.fit?.ratio).toBeLessThan(0.7);
    expect(tap?.reason).toBe("NOT_EXPONENTIAL");
  });

  it("refuses a decay that slows down, with a late rate below 1/1.43 of the early one", () => {
    const tap = afterQuiet(curvedDecay({ tau: 0.208, curvature: 2.56 }), 1e-4);
    expect(tap?.fit?.residual).toBeLessThanOrEqual(1);
    expect(tap?.fit?.range).toBeGreaterThanOrEqual(10);
    expect(tap?.fit?.ratio).toBeGreaterThan(1.43);
    expect(tap?.reason).toBe("NOT_EXPONENTIAL");
  });
});

describe("decay Q without a quiet stretch", () => {
  it("measures from the tap tails (three 2 s taps, tau 0.1 s, Q 56.5)", () => {
    const { result } = measureTaps({
      quietSeconds: 0,
      taps: Array.from({ length: 3 }, () => ({ modes: [mode(180, 0.5, 0.1)], seconds: 2 })),
      sigma: 1e-3,
      frequency: 180,
    });
    expect(result.noise?.source).toBe("tapTail");
    expect(result.taps).toHaveLength(3);
    for (const tap of result.taps) withinPercent(tap.q, 56.5, 1);
  });

  it("reports a missing quiet reference rather than not enough decay when the floor came from tap tails", () => {
    const { result } = measureTaps({
      quietSeconds: 0,
      taps: Array.from({ length: 3 }, () => ({ modes: [mode(200, 0.5, 0.6)], seconds: 0.6 })),
      sigma: 1e-3,
      frequency: 200,
    });
    expect(result.noise?.source).toBe("tapTail");
    expect(result.taps.map((tap) => tap.reason)).toEqual([
      "NO_QUIET_REFERENCE",
      "NO_QUIET_REFERENCE",
      "NO_QUIET_REFERENCE",
    ]);
  });

  it("keeps the tap order and onsets of the used taps", () => {
    const { result, recording } = measureTaps({
      taps: Array.from({ length: 2 }, () => ({ modes: [mode(180, 0.5, 0.1)], seconds: 1 })),
      sigma: 1e-4,
      frequency: 180,
    });
    expect(result.taps.map((tap) => tap.onset)).toEqual(recording.onsets);
  });

  it("measures no tap when the peak is refused", () => {
    const { result } = measureTaps({
      quietSeconds: 0,
      taps: [{ modes: [mode(180, 0.5, 0.1)], seconds: 0.12 }],
      sigma: 1e-3,
      frequency: 180,
    });
    expect(result.reason).toBe("NO_QUIET_REFERENCE");
    expect(result.taps).toEqual([]);
  });
});
