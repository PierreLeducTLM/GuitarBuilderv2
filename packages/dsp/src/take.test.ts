import { describe, expect, it } from "vitest";
import {
  analyzeTake,
  averageSpectrum,
  noteLabel,
  recomputeTake,
  resultFromRecord,
  runTake,
  spectrumPoints,
  type TakeInput,
  takeDecayQ,
  tapPower,
} from "./index.ts";
import { type DecayingTone, gaussianNoise, withTaps } from "./test-support/signals.ts";

const sampleRate = 48000;

const recording = (seconds: number, taps: readonly DecayingTone[]) =>
  withTaps(gaussianNoise({ length: seconds * sampleRate, rms: 0.0002, seed: 3 }), taps);

const plateTaps = (onsets: readonly number[]) =>
  onsets.flatMap((onset) => [
    { onset, amplitude: 0.3, tau: 0.12, frequency: 190 },
    { onset, amplitude: 0.2, tau: 0.15, frequency: 95 },
  ]);

const bodyTaps = (onsets: readonly number[]) =>
  onsets.flatMap((onset) => [
    { onset, amplitude: 0.25, tau: 0.05, frequency: 98.4 },
    { onset, amplitude: 0.3, tau: 0.06, frequency: 196.9 },
    { onset, amplitude: 0.2, tau: 0.05, frequency: 247.5 },
  ]);

const input = (signal: Float64Array, overrides: Partial<TakeInput> = {}): TakeInput => ({
  filtered: signal,
  raw: [signal],
  sampleRate,
  mode: "plate",
  mobile: false,
  ...overrides,
});

const threeTaps = recording(4, plateTaps([24000, 76800, 132000]));

describe("analysing a take", () => {
  it("finds the taps, averages them and lists the peaks with spectral Q and note", () => {
    const { result } = runTake(input(threeTaps));
    expect(result.taps.map((t) => t.onset)).toEqual([24000, 76800, 132000]);
    expect(result.peaks.map((p) => Math.round(p.frequency))).toEqual([190, 95]);
    expect(result.peaks[0]?.spectralQ?.q).toBeGreaterThan(0);
    expect(result.peaks[0]?.note).toBe(noteLabel(result.peaks[0]?.frequency ?? 0));
    expect(result.record?.frequencies).toHaveLength(662);
    expect(result.record?.fftSize).toBe(32768);
    expect(result.roles).toBeNull();
  });

  it("labels Air, Top and Back in Instrument mode", () => {
    const body = recording(5, bodyTaps([48000, 105600, 163200]));
    const { result } = runTake(input(body, { mode: "instrument" }));
    expect(
      [result.roles?.air, result.roles?.top, result.roles?.back].map((r) =>
        Math.round(r?.frequency ?? 0),
      ),
    ).toEqual([98, 197, 248]);
  });

  it("drops the 132-138 Hz artifact on a mobile device", () => {
    const signal = recording(2, [{ onset: 24000, amplitude: 0.3, tau: 0.1, frequency: 134.8 }]);
    expect(runTake(input(signal, { mobile: true })).result.peaks).toEqual([]);
    expect(runTake(input(signal)).result.peaks).toHaveLength(1);
  });

  it("gives the same result when driven step by step", () => {
    const steps = analyzeTake(input(threeTaps));
    let yields = 0;
    let next = steps.next();
    while (!next.done) {
      yields += 1;
      next = steps.next();
    }
    expect(yields).toBeGreaterThan(0);
    expect(next.value.result).toEqual(runTake(input(threeTaps)).result);
  });

  it("pauses once for every 4 used taps and once more before the result", () => {
    const pauses = (signal: Float64Array) => {
      const steps = analyzeTake(input(signal));
      let count = 0;
      while (!steps.next().done) count += 1;
      return count;
    };
    const sixTaps = recording(6, plateTaps([24000, 62400, 100800, 139200, 177600, 216000]));
    expect(pauses(threeTaps)).toBe(1);
    expect(pauses(sixTaps)).toBe(2);
  });

  it("reports no taps for room noise", () => {
    const { result } = runTake(input(recording(2, [])));
    expect(result.taps).toEqual([]);
    expect(result.record).toBeNull();
  });

  it("has no spectrum when every tap is rejected", () => {
    const clipped = threeTaps.map((x, n) =>
      n === 76800 + 10 || n === 24000 + 10 || n === 132000 + 10 ? 1 : x,
    );
    const { result } = runTake(input(threeTaps, { raw: [clipped] }));
    expect(result.taps.every((t) => t.rejection === "clipped")).toBe(true);
    expect(result.used).toEqual([]);
    expect(result.points).toEqual([]);
    expect(result.peaks).toEqual([]);
    expect(result.record).toBeNull();
  });
});

describe("excluding taps", () => {
  it("averages only the taps still used, from the spectra already computed", () => {
    const { cache } = runTake(input(threeTaps));
    const without2 = recomputeTake(cache, [2]);
    const expected = spectrumPoints(
      averageSpectrum([tapPower(threeTaps, 24000), tapPower(threeTaps, 132000)]),
      sampleRate,
    );
    expect(without2.used).toEqual([1, 3]);
    expect(without2.points).toEqual(expected);
  });

  it("has no spectrum once every tap is excluded", () => {
    const { cache } = runTake(input(threeTaps));
    const none = recomputeTake(cache, [1, 2, 3]);
    expect(none.used).toEqual([]);
    expect(none.record).toBeNull();
  });
});

describe("reopening a saved record", () => {
  it("re-detects the peaks with spectral Q and note, without taps or the mobile exclusion", () => {
    const { result } = runTake(input(threeTaps));
    const record = result.record;
    if (!record) throw new Error("expected a record");
    const reopened = resultFromRecord(record);
    expect(reopened.taps).toEqual([]);
    expect(reopened.used).toEqual([]);
    expect(reopened.record).toBe(record);
    expect(reopened.peaks).toEqual(result.peaks);
    expect(reopened.roles).toBeNull();
  });

  it("keeps a 134.8 Hz peak that a phone would have dropped", () => {
    const signal = recording(2, [{ onset: 24000, amplitude: 0.3, tau: 0.1, frequency: 134.8 }]);
    const record = runTake(input(signal)).result.record;
    if (!record) throw new Error("expected a record");
    expect(resultFromRecord(record).peaks).toHaveLength(1);
  });
});

describe("decay Q of a take's peak", () => {
  it("measures the selected peak across the used taps", () => {
    const { cache, result } = runTake(input(threeTaps));
    const top = result.peaks[0];
    if (!top) throw new Error("expected a peak");
    const decay = takeDecayQ(cache, result, top);
    expect(decay.used).toBe(3);
    expect(Math.abs((decay.q ?? 0) / (Math.PI * 190 * 0.12) - 1)).toBeLessThan(0.02);
  });

  it("uses only the taps still used and treats the other peaks as neighbours", () => {
    const { cache } = runTake(input(threeTaps));
    const without3 = recomputeTake(cache, [3]);
    const top = without3.peaks[0];
    if (!top) throw new Error("expected a peak");
    const decay = takeDecayQ(cache, without3, top);
    expect(decay.used).toBe(2);
    expect(decay.reason).toBe("TOO_FEW_VALID_TAPS");
    expect(decay.isolation.neighbour).toBeCloseTo(95, 0);
  });

  it("takes the noise floor from the silence before the first tap", () => {
    const { cache, result } = runTake(input(threeTaps));
    const top = result.peaks[0];
    if (!top) throw new Error("expected a peak");
    expect(takeDecayQ(cache, result, top).noise?.source).toBe("quiet");
  });

  it("ends each ring-down at the next tap, so slow decays between close taps are cut off", () => {
    const clickThenRing = (onset: number) => [
      { onset, amplitude: 0.5, tau: 0.004, frequency: 700 },
      { onset, amplitude: 0.1, tau: 1, frequency: 190 },
    ];
    const slow = recording(5, [36000, 72000, 108000].flatMap(clickThenRing));
    const { cache, result } = runTake(input(slow));
    const ring = result.peaks.find((peak) => Math.abs(peak.frequency - 190) < 1);
    if (!ring) throw new Error("expected the 190 Hz mode");
    expect(result.used).toEqual([1, 2, 3]);
    expect(takeDecayQ(cache, result, ring).reason).toBe("DECAY_CUT_OFF");
  });

  it("measures a body role that is not among the listed peaks", () => {
    const { cache, result } = runTake(input(threeTaps));
    const decay = takeDecayQ(cache, result, { frequency: 95, level: -30, spectralQ: null });
    expect(Math.abs((decay.q ?? 0) / (Math.PI * 95 * 0.15) - 1)).toBeLessThan(0.02);
  });
});
