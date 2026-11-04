import { describe, expect, it } from "vitest";
import { detectTaps } from "./index.ts";
import { type DecayingTone, gaussianNoise, withTaps } from "./test-support/signals.ts";

const sampleRate = 48000;

const tap = (overrides: Partial<DecayingTone> & Pick<DecayingTone, "onset">): DecayingTone => ({
  amplitude: 0.4,
  tau: 0.12,
  frequency: 190,
  ...overrides,
});

const recording = (options: {
  seconds: number;
  taps: readonly DecayingTone[];
  noiseRms?: number;
}) =>
  withTaps(
    gaussianNoise({
      length: Math.round(options.seconds * sampleRate),
      rms: options.noiseRms ?? 0.0002,
      seed: 1,
    }),
    options.taps,
  );

const analyse = (signal: Float64Array, raw: readonly Float64Array[] = [signal]) =>
  detectTaps({ filtered: signal, raw });

const onsets = (signal: Float64Array) => analyse(signal).map((found) => found.onset);

describe("tap detection", () => {
  it("finds the three taps of a 4 s recording at their onset samples", () => {
    const signal = recording({
      seconds: 4,
      taps: [tap({ onset: 24000 }), tap({ onset: 76800 }), tap({ onset: 132000 })],
    });
    expect(analyse(signal)).toEqual([
      { number: 1, onset: 24000, rejection: null },
      { number: 2, onset: 76800, rejection: null },
      { number: 3, onset: 132000, rejection: null },
    ]);
  });

  it("finds nothing in room noise without a tap", () => {
    expect(onsets(recording({ seconds: 4, taps: [] }))).toEqual([]);
  });

  it("finds nothing in digital silence", () => {
    expect(onsets(new Float64Array(sampleRate))).toEqual([]);
  });

  it("ignores a click quieter than the -60 dBFS floor", () => {
    const signal = withTaps(new Float64Array(sampleRate), [
      tap({ onset: 24000, amplitude: 0.0009 * Math.SQRT2, tau: 1 }),
    ]);
    expect(onsets(signal)).toEqual([]);
  });

  it("finds a tap just above the -60 dBFS floor", () => {
    const signal = withTaps(new Float64Array(sampleRate), [
      tap({ onset: 24000, amplitude: 0.0012 * Math.SQRT2, tau: 1 }),
    ]);
    expect(onsets(signal)).toEqual([24000]);
  });

  it("needs a tap 20 dB above the room's noise floor", () => {
    const loudRoom = (amplitude: number) =>
      recording({ seconds: 2, noiseRms: 0.005, taps: [tap({ onset: 48000, amplitude })] });
    expect(onsets(loudRoom(0.03))).toEqual([]);
    expect(onsets(loudRoom(0.3))).toEqual([48000]);
  });

  it("measures the noise floor at the 10th percentile, not from a short stretch of silence", () => {
    const silenceThenLoudRoom = recording({
      seconds: 2,
      noiseRms: 0.005,
      taps: [tap({ onset: 48000, amplitude: 0.03 })],
    }).map((x, n) => (n < 4800 ? 0 : x));
    expect(onsets(silenceThenLoudRoom)).toEqual([]);
  });

  it("does not let a noisy start raise the noise floor for the rest of the recording", () => {
    const handlingThenQuiet = recording({
      seconds: 2,
      taps: [tap({ onset: 48000, amplitude: 0.05 })],
    }).map((x, n) => (n < 14400 ? x + 50 * x : x));
    expect(onsets(handlingThenQuiet)).toContain(48000);
  });

  it("does not take a slow swell for a tap", () => {
    const swell = Float64Array.from(
      { length: 2 * sampleRate },
      (_, n) => (n / (2 * sampleRate)) * 0.2 * Math.sin((2 * Math.PI * 190 * n) / sampleRate),
    );
    expect(onsets(swell)).toEqual([]);
  });

  it("counts a double hit 40 ms apart as one tap", () => {
    const signal = recording({
      seconds: 2,
      taps: [tap({ onset: 48000 }), tap({ onset: 48000 + 1920 })],
    });
    expect(onsets(signal)).toEqual([48000]);
  });

  it("separates two sharp taps 100 ms apart but not 95 ms apart", () => {
    const sharp = (onset: number) => tap({ onset, tau: 0.004 });
    const apart = (gap: number) =>
      recording({ seconds: 2, taps: [sharp(48000), sharp(48000 + gap)] });
    expect(onsets(apart(4800))).toEqual([48000, 52800]);
    expect(onsets(apart(4560))).toEqual([48000]);
  });

  it("uses at most the first 50 taps", () => {
    const taps = Array.from({ length: 60 }, (_, i) => tap({ onset: 24000 + i * 6000, tau: 0.004 }));
    const found = onsets(recording({ seconds: 8, taps }));
    expect(found).toHaveLength(50);
    expect(found[49]).toBe(24000 + 49 * 6000);
  });
});

describe("tap rejection", () => {
  it("rejects a tap whose raw audio reaches 0.999 in its first 50 ms as clipped", () => {
    const signal = recording({ seconds: 2, taps: [tap({ onset: 48000 })] });
    const clippedAt = (offset: number, level: number) => {
      const raw = Float64Array.from(signal);
      raw[48000 + offset] = level;
      return analyse(signal, [signal, raw])[0]?.rejection;
    };
    expect(clippedAt(2399, 0.999)).toBe("clipped");
    expect(clippedAt(10, -0.999)).toBe("clipped");
    expect(clippedAt(2399, 0.998)).toBeNull();
    expect(clippedAt(2400, 1)).toBeNull();
  });

  it("rejects taps whose spectrum windows hold another tap's onset", () => {
    const pair = (gap: number) =>
      analyse(
        recording({
          seconds: 3,
          taps: [tap({ onset: 48000, tau: 0.02 }), tap({ onset: 48000 + gap, tau: 0.02 })],
        }),
      ).map((found) => found.rejection);
    expect(pair(8160)).toEqual(["tooClose", "tooClose"]);
    expect(pair(24480)).toEqual(["tooClose", null]);
    expect(pair(24720)).toEqual([null, null]);
  });

  it("rejects a tap with less than 250 ms of audio after its onset as cut off", () => {
    const endingAfter = (samples: number) =>
      analyse(
        recording({ seconds: (48000 + samples) / sampleRate, taps: [tap({ onset: 48000 })] }),
      )[0]?.rejection;
    expect(endingAfter(12000)).toBeNull();
    expect(endingAfter(11999)).toBe("cutOff");
  });
});
