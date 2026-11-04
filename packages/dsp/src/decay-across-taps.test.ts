import { describe, expect, it } from "vitest";
import {
  inspectDecay,
  isolateResonance,
  measureDecayQ,
  type TapDecay,
  tapSegment,
} from "./index.ts";
import { type Mode, type RingingTap, ringing, tapRecording } from "./test-support/signals.ts";

const mode = (frequency: number, amplitude: number, tau: number): Mode => ({
  frequency,
  amplitude,
  tau,
});

const kinds = {
  valid: { modes: [mode(180, 0.5, 0.2)], seconds: 1.5 },
  cutOff: { modes: [mode(180, 0.5, 0.6)], seconds: 0.6 },
  beating: { modes: [mode(180, 0.5, 0.2), mode(182.5, 0.25, 0.2)], seconds: 1.5 },
  noise: { modes: [], seconds: 1 },
  growing: { modes: [mode(180, 0.01, -0.5)], seconds: 1.5 },
} satisfies Record<string, RingingTap>;

const decayInput = (options: {
  taps: readonly RingingTap[];
  sigma: number;
  quietSeconds?: number;
  used?: (onsets: readonly number[]) => readonly number[];
  others?: readonly { frequency: number; level: number }[];
  frequency?: number;
}) => {
  const recording = tapRecording({
    quietSeconds: options.quietSeconds ?? 2,
    taps: options.taps,
    sigma: options.sigma,
    seed: 31,
  });
  return {
    signal: recording.signal,
    onsets: recording.onsets,
    used: options.used?.(recording.onsets) ?? recording.onsets,
    peak: { frequency: options.frequency ?? 180, level: -20, bandwidth: null },
    others: options.others ?? [],
  };
};

const measure = (options: Parameters<typeof decayInput>[0]) => measureDecayQ(decayInput(options));

const withTau = (tau: number): RingingTap => ({ modes: [mode(180, 0.5, tau)], seconds: 1.5 });

const median = (values: readonly number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? (sorted[middle] ?? 0)
    : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
};

const validQs = (taps: readonly TapDecay[]) =>
  taps.flatMap((tap) => (tap.q === null ? [] : [tap.q]));

const withinPercent = (actual: number | null | undefined, expected: number, percent: number) =>
  expect(Math.abs((actual ?? Number.NaN) / expected - 1) * 100).toBeLessThanOrEqual(percent);

describe("decay Q across taps", () => {
  it("reports the median, not the mean, of five taps with one outlier (113.1 from 5 of 5)", () => {
    const result = measure({ taps: [0.2, 0.2, 0.2, 0.2, 0.35].map(withTau), sigma: 1e-3 });
    const qs = validQs(result.taps);
    expect(qs).toHaveLength(5);
    withinPercent(qs[4], 197.9, 1);
    expect(result.reason).toBeNull();
    expect(result.q).toBe(median(qs));
    withinPercent(result.q, 113.1, 1);
    expect(result.tau).toBeCloseTo((result.q ?? 0) / (Math.PI * 180), 15);
    expect(result.valid).toBe(5);
    expect(result.used).toBe(5);
    expect(result.spread).toBeLessThan(0.02);
  });

  it("averages the two middle values of an even number of valid taps", () => {
    const result = measure({ taps: [0.2, 0.21, 0.22, 0.2].map(withTau), sigma: 1e-4 });
    const qs = validQs(result.taps);
    expect(qs).toHaveLength(4);
    expect(result.q).toBe(median(qs));
  });

  it("refuses taps that disagree: MAD / median = 0.5 for tau 0.1, 0.2 and 0.3 s", () => {
    const result = measure({ taps: [0.1, 0.2, 0.3].map(withTau), sigma: 1e-4 });
    const qs = validQs(result.taps);
    const centre = median(qs);
    expect(qs).toHaveLength(3);
    expect(result.spread).toBe(median(qs.map((q) => Math.abs(q - centre))) / centre);
    expect(result.spread).toBeCloseTo(0.5, 2);
    expect(result).toMatchObject({ reason: "TAPS_INCONSISTENT", q: null, tau: null, valid: 3 });
  });

  it("accepts a spread of 0.1 and refuses one of 0.2", () => {
    const consistent = measure({ taps: [0.18, 0.2, 0.23].map(withTau), sigma: 1e-4 });
    expect(consistent.spread).toBeCloseTo(0.1, 2);
    expect(consistent.reason).toBeNull();
    const scattered = measure({ taps: [0.16, 0.2, 0.24].map(withTau), sigma: 1e-4 });
    expect(scattered.spread).toBeCloseTo(0.2, 2);
    expect(scattered.reason).toBe("TAPS_INCONSISTENT");
  });

  it("gives the most frequent tap reason when fewer than 3 of 5 taps are valid (DECAY_CUT_OFF, 2 of 5)", () => {
    const result = measure({
      taps: [kinds.valid, kinds.valid, kinds.cutOff, kinds.cutOff, kinds.cutOff],
      sigma: 1e-4,
    });
    expect(result).toMatchObject({
      reason: "DECAY_CUT_OFF",
      q: null,
      tau: null,
      valid: 2,
      used: 5,
      spread: null,
    });
  });

  it("asks for more taps when only 2 are used, even if both are valid", () => {
    const result = measure({ taps: [kinds.valid, kinds.valid], sigma: 1e-3 });
    expect(result).toMatchObject({ reason: "TOO_FEW_VALID_TAPS", q: null, valid: 2, used: 2 });
  });

  it("measures 3 valid taps out of 3 used", () => {
    const result = measure({ taps: [kinds.valid, kinds.valid, kinds.valid], sigma: 1e-3 });
    expect(result).toMatchObject({ reason: null, valid: 3, used: 3 });
  });

  it("counts only the used taps", () => {
    const result = measure({
      taps: [kinds.valid, kinds.valid, kinds.valid, kinds.cutOff],
      sigma: 1e-3,
      used: (onsets) => onsets.slice(1),
    });
    expect(result).toMatchObject({ reason: "DECAY_CUT_OFF", valid: 2, used: 3 });
  });

  it("finds not enough decay in five taps of pure noise (0 of 5)", () => {
    const result = measure({ taps: Array.from({ length: 5 }, () => kinds.noise), sigma: 1e-3 });
    expect(result).toMatchObject({ reason: "NOT_ENOUGH_DECAY", valid: 0, used: 5 });
  });

  it.each([
    ["DECAY_CUT_OFF", [kinds.valid, kinds.beating, kinds.cutOff]],
    ["NOT_EXPONENTIAL", [kinds.valid, kinds.noise, kinds.beating]],
    ["NOT_ENOUGH_DECAY", [kinds.valid, kinds.growing, kinds.noise]],
    ["NO_DECAY", [kinds.growing, kinds.noise, kinds.growing]],
  ])("prefers %s on a tie, and the most frequent reason otherwise", (reason, taps) => {
    expect(measure({ taps, sigma: 1e-4 }).reason).toBe(reason);
  });

  it("prefers NO_QUIET_REFERENCE over DECAY_CUT_OFF on a tie", () => {
    const result = measure({
      quietSeconds: 0,
      taps: [kinds.valid, kinds.noise, kinds.cutOff],
      sigma: 1e-3,
    });
    expect(result.noise?.source).toBe("tapTail");
    expect(result.taps.map((tap) => tap.reason)).toEqual([
      null,
      "NO_QUIET_REFERENCE",
      "DECAY_CUT_OFF",
    ]);
    expect(result.reason).toBe("NO_QUIET_REFERENCE");
  });

  it("measures from tap tails without a quiet stretch (three 2 s taps, Q 56.5)", () => {
    const result = measure({
      quietSeconds: 0,
      taps: Array.from({ length: 3 }, () => ({ modes: [mode(180, 0.5, 0.1)], seconds: 2 })),
      sigma: 1e-3,
    });
    expect(result.noise?.source).toBe("tapTail");
    withinPercent(result.q, 56.5, 1);
  });

  it("reports NO_QUIET_REFERENCE for the peak when tap tails are too loud (three 0.6 s taps, tau 0.6 s)", () => {
    const result = measure({
      quietSeconds: 0,
      taps: Array.from({ length: 3 }, () => ({ modes: [mode(200, 0.5, 0.6)], seconds: 0.6 })),
      sigma: 1e-3,
      frequency: 200,
    });
    expect(result).toMatchObject({ reason: "NO_QUIET_REFERENCE", valid: 0, used: 3 });
    expect(result.taps).toHaveLength(3);
  });

  it("keeps the peak-level refusals with no tap results", () => {
    const notIsolated = measure({
      taps: [kinds.valid, kinds.valid, kinds.valid],
      sigma: 1e-3,
      others: [{ frequency: 185, level: -20 }],
    });
    expect(notIsolated).toMatchObject({
      reason: "MODE_NOT_ISOLATED",
      q: null,
      tau: null,
      valid: 0,
      used: 3,
      spread: null,
      taps: [],
    });
    const noReference = measure({
      quietSeconds: 0,
      taps: [{ modes: [], seconds: 0.12 }],
      sigma: 1e-3,
    });
    expect(noReference).toMatchObject({
      reason: "NO_QUIET_REFERENCE",
      valid: 0,
      used: 1,
      taps: [],
    });
  });
});

const bucketExtremes = (values: readonly number[], times: readonly number[]) =>
  Array.from({ length: 400 }, (_, b) => {
    const from = Math.floor((b * values.length) / 400);
    const to = Math.floor(((b + 1) * values.length) / 400);
    const indices = Array.from({ length: to - from }, (_, i) => from + i);
    if (indices.length === 0) return [];
    const low = indices.reduce((best, i) => ((values[i] ?? 0) < (values[best] ?? 0) ? i : best));
    const high = indices.reduce((best, i) => ((values[i] ?? 0) > (values[best] ?? 0) ? i : best));
    return [...new Set([low, high])]
      .sort((x, y) => x - y)
      .map((i) => ({ time: times[i] ?? 0, value: values[i] ?? 0 }));
  }).flat();

describe("decay Q inspector series", () => {
  const t1 = () => decayInput({ taps: [kinds.valid], sigma: 1e-3 });

  it("draws the T1 tap with 800 response points, 739 envelope points and the fit inside its interval", () => {
    const input = t1();
    const onset = input.onsets[0] ?? 0;
    const series = inspectDecay({ ...input, tap: onset });
    const { start, end } = tapSegment({ onset, onsets: input.onsets, length: input.signal.length });
    const isolated = isolateResonance({
      samples: input.signal.subarray(start, end),
      frequency: 180,
      halfLength: 10,
    });
    expect(isolated.envelope).toHaveLength(1477);
    expect(series?.response).toHaveLength(800);
    expect(series?.response).toEqual(bucketExtremes([...isolated.response], [...isolated.times]));
    expect(series?.envelope).toHaveLength(739);
    expect(series?.envelope).toEqual(
      Array.from({ length: 739 }, (_, j) => ({
        time: isolated.times[2 * j],
        value: isolated.envelope[2 * j],
      })),
    );
    const decay = series?.decay;
    const interval = decay?.interval;
    expect(interval?.start).toBeCloseTo(0.01696, 5);
    expect(series?.markers).toEqual({
      start: interval?.start,
      end: interval?.end,
      noise: series?.noise.effective,
      threshold: series?.noise.threshold,
    });
    const inside = (series?.envelope ?? []).filter(
      (point) => point.time >= (interval?.start ?? 0) && point.time <= (interval?.end ?? 0),
    );
    expect(series?.fit.map((point) => point.time)).toEqual(inside.map((point) => point.time));
    for (const point of series?.fit ?? []) {
      expect(point.value).toBeCloseTo(
        10 ** (((decay?.fit?.intercept ?? 0) + (decay?.fit?.slope ?? 0) * point.time) / 20),
        12,
      );
    }
    expect(series?.decay).toEqual(measureDecayQ(input).taps[0]);
  });

  it("draws every sample when the envelope is short", () => {
    const input = decayInput({
      taps: [{ modes: [mode(180, 0.5, 0.05)], seconds: 0.25 }],
      sigma: 1e-4,
    });
    const series = inspectDecay({ ...input, tap: input.onsets[0] ?? 0 });
    const count = Math.floor((12000 - 189) / 48) + 1 - 20;
    expect(count).toBeLessThan(400);
    expect(series?.envelope).toHaveLength(count);
    expect(series?.response).toHaveLength(count);
    expect(series?.fit[0]?.time).toBe(series?.decay.interval?.start);
    expect(series?.fit.at(-1)?.time).toBe(series?.decay.interval?.end);
  });

  it("draws no fitted line when the interval holds too few samples to fit", () => {
    const tone = ringing([mode(180, 0.1, 1e9)], 648);
    const signal = new Float64Array(96480 + 48000);
    signal.set(tone, 96480);
    const series = inspectDecay({
      signal,
      onsets: [96480],
      used: [96480],
      peak: { frequency: 180, level: -20, bandwidth: null },
      others: [],
      tap: 96480,
    });
    expect(series?.decay.interval?.samples).toBe(7);
    expect(series?.decay.fit).toBeNull();
    expect(series?.fit).toEqual([]);
  });

  it("draws no interval markers for a tap too short to fit", () => {
    const input = decayInput({
      taps: [{ modes: [mode(180, 0.5, 0.01)], seconds: (189 + 48 * 31) / 48000 }],
      sigma: 1e-4,
    });
    const series = inspectDecay({ ...input, tap: input.onsets[0] ?? 0 });
    expect(series?.decay.reason).toBe("DECAY_CUT_OFF");
    expect(series?.markers).toMatchObject({ start: null, end: null });
    expect(series?.fit).toEqual([]);
  });

  it("still draws the envelope and the fitted line of a tap refused as not exponential", () => {
    const input = decayInput({ taps: [kinds.beating], sigma: 1e-4 });
    const series = inspectDecay({ ...input, tap: input.onsets[0] ?? 0 });
    expect(series?.decay.reason).toBe("NOT_EXPONENTIAL");
    expect(series?.envelope.length).toBeGreaterThan(0);
    expect(series?.fit.length).toBeGreaterThan(0);
  });

  it("draws no fitted line without a fit", () => {
    const input = decayInput({ taps: [kinds.noise], sigma: 1e-3 });
    const series = inspectDecay({ ...input, tap: input.onsets[0] ?? 0 });
    expect(series?.decay.reason).toBe("NOT_ENOUGH_DECAY");
    expect(series?.fit).toEqual([]);
    expect(series?.markers.start).toBe(series?.decay.interval?.start);
  });

  it("draws nothing for a peak that is not isolated or a tap that is not used", () => {
    const input = t1();
    const onset = input.onsets[0] ?? 0;
    expect(
      inspectDecay({ ...input, others: [{ frequency: 185, level: -20 }], tap: onset }),
    ).toBeNull();
    expect(inspectDecay({ ...input, tap: onset + 1 })).toBeNull();
    const silent = decayInput({
      quietSeconds: 0,
      taps: [{ modes: [], seconds: 0.12 }],
      sigma: 1e-3,
    });
    expect(inspectDecay({ ...silent, tap: silent.onsets[0] ?? 0 })).toBeNull();
  });

  it("draws the tap asked for among several", () => {
    const input = decayInput({ taps: [kinds.valid, kinds.cutOff], sigma: 1e-4 });
    const second = input.onsets[1] ?? 0;
    const series = inspectDecay({ ...input, tap: second });
    expect(series?.decay.onset).toBe(second);
    expect(series?.decay.reason).toBe("DECAY_CUT_OFF");
  });
});
