import { describe, expect, it } from "vitest";
import {
  type DecayPeak,
  isolateResonance,
  measureDecayQ,
  quietStretches,
  tapSegment,
} from "./index.ts";
import { type Mode, type RingingTap, sine, tapRecording } from "./test-support/signals.ts";

const sampleRate = 48000;
const peak: DecayPeak = { frequency: 180, level: -20, bandwidth: null };
const ringingAt180: readonly Mode[] = [{ frequency: 180, amplitude: 0.5, tau: 0.1 }];

const measure = (
  recording: { signal: Float64Array; onsets: readonly number[] },
  options: {
    used?: readonly number[];
    others?: readonly { frequency: number; level: number }[];
  } = {},
) =>
  measureDecayQ({
    signal: recording.signal,
    onsets: recording.onsets,
    used: options.used ?? recording.onsets,
    peak,
    others: options.others ?? [],
  });

const median = (values: readonly number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? (sorted[middle] ?? 0)
    : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
};

const floorOf = (envelope: readonly number[]) =>
  Math.sqrt(median(envelope.map((e) => e * e)) / Math.LN2);

const envelopeOf = (samples: Float64Array, halfLength: number) => [
  ...isolateResonance({ samples, frequency: peak.frequency, halfLength }).envelope,
];

const tailFloor = (
  recording: { signal: Float64Array; onsets: readonly number[] },
  onset: number,
  options: { halfLength: number; window: number },
) => {
  const { start, end } = tapSegment({
    onset,
    onsets: recording.onsets,
    length: recording.signal.length,
  });
  const envelope = envelopeOf(recording.signal.subarray(start, end), options.halfLength);
  return floorOf(envelope.slice(-options.window));
};

const withinDb = (actual: number, expected: number, db: number) =>
  expect(Math.abs(20 * Math.log10(actual / expected))).toBeLessThanOrEqual(db);

const relativeError = (actual: number | undefined, expected: number) =>
  Math.abs((actual ?? Number.NaN) / expected - 1);

const taps = (count: number, tap: RingingTap) => Array.from({ length: count }, () => tap);

describe("decay Q quiet stretches", () => {
  it("takes 0.79 s before a tap 0.8 s into the recording", () => {
    const stretches = quietStretches({ onsets: [38400], length: 150000 });
    expect(stretches).toEqual([{ start: 0, end: 37920 }]);
    expect((stretches[0]?.end ?? 0) / sampleRate).toBeCloseTo(0.79, 12);
  });

  it("adds the audio from 3 s after the last onset to the end", () => {
    expect(quietStretches({ onsets: [38400, 100000], length: 400000 })).toEqual([
      { start: 0, end: 37920 },
      { start: 244000, end: 400000 },
    ]);
  });

  it("keeps only non-empty stretches", () => {
    expect(quietStretches({ onsets: [480, 1000], length: 145000 })).toEqual([]);
    expect(quietStretches({ onsets: [481, 1000], length: 145001 })).toEqual([
      { start: 0, end: 1 },
      { start: 145000, end: 145001 },
    ]);
  });

  it("has none without a tap", () => {
    expect(quietStretches({ onsets: [], length: 200000 })).toEqual([]);
  });
});

describe("decay Q noise floor", () => {
  it("reads white noise of RMS 0.001 within 1.5 dB of 0.000085 for a 0.02 s kernel", () => {
    const recording = tapRecording({
      quietSeconds: 2,
      taps: [{ modes: ringingAt180, seconds: 0.5 }],
      sigma: 1e-3,
      seed: 11,
    });
    const { noise, reason } = measure(recording);
    expect(reason).toBeNull();
    expect(noise?.source).toBe("quiet");
    withinDb(noise?.floor ?? 0, 1e-3 * Math.sqrt((2 * 1.73) / (0.02 * 24000)), 1.5);
    expect(noise?.effective).toBe(noise?.floor);
    expect(noise?.threshold).toBeCloseTo(10 * (noise?.floor ?? 0), 15);
  });

  it.each([
    [0.5, 854],
    [0.501, 855],
  ])(
    "is sqrt(median(e^2) / ln 2) over the envelopes of every quiet stretch (%f s before the first tap: %i values)",
    (quietSeconds, values) => {
      const recording = tapRecording({
        quietSeconds,
        taps: [
          { modes: ringingAt180, seconds: 0.5 },
          { modes: ringingAt180, seconds: 3.4 },
        ],
        sigma: 1e-3,
        seed: 12,
      });
      const stretches = quietStretches({
        onsets: recording.onsets,
        length: recording.signal.length,
      });
      expect(stretches).toHaveLength(2);
      const pooled = stretches.flatMap(({ start, end }) =>
        envelopeOf(recording.signal.subarray(start, end), 10),
      );
      expect(pooled).toHaveLength(values);
      expect(relativeError(measure(recording).noise?.floor, floorOf(pooled))).toBeLessThan(1e-12);
    },
  );

  it("counts the stretch after the last tap toward the quiet duration", () => {
    const sourceWith = (trailingSamples: number) =>
      measure(
        tapRecording({
          quietSeconds: 0,
          taps: [{ modes: ringingAt180, seconds: (144000 + trailingSamples) / sampleRate }],
          sigma: 1e-3,
          seed: 20,
        }),
      ).noise?.source;
    expect(sourceWith(4800)).toBe("quiet");
    expect(sourceWith(4799)).toBe("tapTail");
  });

  it("ignores a loud stretch that fills less than half of the quiet audio", () => {
    const quiet = sine({ frequency: 180, sampleRate, length: 96480, amplitude: 1e-3 }).map(
      (x, n) => (n >= 60000 ? 100 * x : x),
    );
    const tap = tapRecording({
      quietSeconds: 0,
      taps: [{ modes: ringingAt180, seconds: 0.5 }],
      sigma: 0,
      seed: 1,
    });
    const signal = Float64Array.from([...quiet, ...tap.signal]);
    const { noise } = measure({ signal, onsets: [96480] });
    expect(relativeError(noise?.floor, 1e-3 / Math.sqrt(Math.LN2))).toBeLessThan(1e-3);
  });

  it("never lets the floor fall below 1e-6 for the fit end", () => {
    const recording = tapRecording({
      quietSeconds: 2,
      taps: [{ modes: ringingAt180, seconds: 0.5 }],
      sigma: 0,
      seed: 1,
    });
    const { noise } = measure(recording);
    expect(noise).toMatchObject({ floor: 0, effective: 1e-6, source: "quiet" });
    expect(noise?.threshold).toBeCloseTo(1e-5, 18);
  });

  it.each([
    [[], 4800],
    [[{ frequency: 215, level: -20 }], 14400],
  ])(
    "needs max(0.1 s, 3 kernel lengths) of quiet audio (others %j: %i samples)",
    (others, needed) => {
      const sourceWith = (quietSamples: number) =>
        measure(
          tapRecording({
            quietSeconds: quietSamples / sampleRate,
            taps: [{ modes: ringingAt180, seconds: 1 }],
            sigma: 1e-3,
            seed: 13,
          }),
          { others },
        ).noise?.source;
      expect(sourceWith(needed)).toBe("quiet");
      expect(sourceWith(needed - 1)).toBe("tapTail");
    },
  );
});

describe("decay Q noise floor from tap tails", () => {
  it("takes the quietest last 100 samples of the used taps when there is no quiet stretch", () => {
    const recording = tapRecording({
      quietSeconds: 0,
      taps: taps(3, { modes: ringingAt180, seconds: 2 }),
      sigma: 1e-3,
      seed: 14,
    });
    const expected = Math.min(
      ...recording.onsets.map((onset) =>
        tailFloor(recording, onset, { halfLength: 10, window: 100 }),
      ),
    );
    const { noise, reason } = measure(recording);
    expect(reason).toBeNull();
    expect(noise?.source).toBe("tapTail");
    expect(relativeError(noise?.floor, expected)).toBeLessThan(1e-12);
    withinDb(noise?.floor ?? 0, 8.5e-5, 1.5);
  });

  it("uses the quietest tail, not a tail still ringing", () => {
    const recording = tapRecording({
      quietSeconds: 0,
      taps: [
        { modes: [{ frequency: 180, amplitude: 0.5, tau: 5 }], seconds: 1 },
        { modes: ringingAt180, seconds: 1 },
        { modes: [{ frequency: 180, amplitude: 0.5, tau: 5 }], seconds: 1 },
      ],
      sigma: 1e-3,
      seed: 15,
    });
    const quietTail = tailFloor(recording, recording.onsets[1] ?? 0, {
      halfLength: 10,
      window: 100,
    });
    expect(relativeError(measure(recording).noise?.floor, quietTail)).toBeLessThan(1e-12);
  });

  it("only looks at the used taps", () => {
    const recording = tapRecording({
      quietSeconds: 0,
      taps: [
        { modes: ringingAt180, seconds: 1 },
        { modes: [{ frequency: 180, amplitude: 0.5, tau: 5 }], seconds: 1 },
      ],
      sigma: 1e-3,
      seed: 16,
    });
    const usedOnset = recording.onsets[1] ?? 0;
    const ringingTail = tailFloor(recording, usedOnset, { halfLength: 10, window: 100 });
    expect(
      relativeError(measure(recording, { used: [usedOnset] }).noise?.floor, ringingTail),
    ).toBeLessThan(1e-12);
  });

  it.each([
    [10, 100, 10701, []],
    [50, 300, 33741, [{ frequency: 215, level: -20 }]],
  ])(
    "needs 2 W valid envelope samples (half-length %i, W = %i, %i samples)",
    (halfLength, window, segmentSamples, others) => {
      const tapOf = (samples: number) =>
        tapRecording({
          quietSeconds: 0,
          taps: [{ modes: ringingAt180, seconds: samples / sampleRate }],
          sigma: 1e-3,
          seed: 17,
        });
      const enough = tapOf(segmentSamples);
      const expected = tailFloor(enough, 0, { halfLength, window });
      const { noise } = measure(enough, { others });
      expect(noise?.source).toBe("tapTail");
      expect(relativeError(noise?.floor, expected)).toBeLessThan(1e-12);
      expect(measure(tapOf(segmentSamples - 1), { others })).toMatchObject({
        reason: "NO_QUIET_REFERENCE",
        noise: null,
      });
    },
  );

  it("refuses the peak without a quiet stretch or a long enough tap (one tap of 0.12 s)", () => {
    const recording = tapRecording({
      quietSeconds: 0,
      taps: [{ modes: ringingAt180, seconds: 0.12 }],
      sigma: 1e-3,
      seed: 18,
    });
    expect(measure(recording)).toMatchObject({ reason: "NO_QUIET_REFERENCE", noise: null });
  });

  it("measures no noise for a peak that is not isolated", () => {
    const recording = tapRecording({
      quietSeconds: 1,
      taps: [{ modes: ringingAt180, seconds: 1 }],
      sigma: 1e-3,
      seed: 19,
    });
    expect(measure(recording, { others: [{ frequency: 185, level: -20 }] })).toMatchObject({
      reason: "MODE_NOT_ISOLATED",
      noise: null,
    });
  });
});
