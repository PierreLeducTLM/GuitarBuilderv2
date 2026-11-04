import { type SpectralQ, spectralQ } from "./bandwidthQ.ts";
import { type BodyResonances, identifyBodyResonances } from "./body.ts";
import { TAP_WINDOW_SAMPLES } from "./constants.ts";
import { type DecaySeries, inspectDecay } from "./decay/inspect.ts";
import { type DecayInput, measureDecayQ, type PeakDecay } from "./decay/measure.ts";
import { noteLabel } from "./note.ts";
import { detectPeaks, type Peak } from "./peaks.ts";
import { pointsFromRecord, recordFromPoints, type TapToneRecord } from "./record.ts";
import { averageSpectrum, type SpectrumPoint, spectrumPoints, tapPower } from "./spectrum.ts";
import { detectTaps, type Tap } from "./taps.ts";

type Samples = Float64Array | Float32Array;

export type TakeMode = "plate" | "instrument";

export type TakeInput = {
  readonly filtered: Samples;
  readonly raw: readonly Samples[];
  readonly sampleRate: number;
  readonly mode: TakeMode;
  readonly mobile: boolean;
};

export type TakePeak = Peak & { readonly spectralQ: SpectralQ | null; readonly note: string };

export type TakeResult = {
  readonly taps: readonly Tap[];
  readonly used: readonly number[];
  readonly points: readonly SpectrumPoint[];
  readonly peaks: readonly TakePeak[];
  readonly record: TapToneRecord | null;
  readonly roles: BodyResonances | null;
};

export type TakeCache = {
  readonly signal: Samples;
  readonly taps: readonly Tap[];
  readonly powers: ReadonlyMap<number, Float64Array>;
  readonly sampleRate: number;
  readonly mode: TakeMode;
  readonly mobile: boolean;
};

export type TakeAnalysis = { readonly cache: TakeCache; readonly result: TakeResult };

const TAPS_PER_STEP = 4;

const peaksWithQ = (points: readonly SpectrumPoint[], mobile: boolean): readonly TakePeak[] =>
  detectPeaks(points, { mobile }).map((peak) => ({
    ...peak,
    spectralQ: spectralQ(points, peak),
    note: noteLabel(peak.frequency),
  }));

export const resultFromRecord = (record: TapToneRecord): TakeResult => ({
  taps: [],
  used: [],
  points: pointsFromRecord(record),
  peaks: peaksWithQ(pointsFromRecord(record), false),
  record,
  roles: null,
});

export const recomputeTake = (cache: TakeCache, excluded: readonly number[]): TakeResult => {
  const used = cache.taps
    .filter((tap) => tap.rejection === null && !excluded.includes(tap.number))
    .map((tap) => tap.number);
  const powers = used.flatMap((number) => cache.powers.get(number) ?? []);
  if (powers.length === 0) {
    return { taps: cache.taps, used, points: [], peaks: [], record: null, roles: null };
  }
  const points = spectrumPoints(averageSpectrum(powers), cache.sampleRate);
  const peaks = peaksWithQ(points, cache.mobile);
  return {
    taps: cache.taps,
    used,
    points,
    peaks,
    record: recordFromPoints(points, { sampleRate: cache.sampleRate, fftSize: TAP_WINDOW_SAMPLES }),
    roles: cache.mode === "instrument" ? identifyBodyResonances(points) : null,
  };
};

export type DecayTarget = {
  readonly frequency: number;
  readonly level: number;
  readonly spectralQ: SpectralQ | null;
};

const SAME_PEAK_HZ = 0.5;

const decayInput = (cache: TakeCache, result: TakeResult, target: DecayTarget): DecayInput => ({
  signal: cache.signal,
  onsets: cache.taps.map((tap) => tap.onset),
  used: cache.taps.filter((tap) => result.used.includes(tap.number)).map((tap) => tap.onset),
  peak: {
    frequency: target.frequency,
    level: target.level,
    bandwidth: target.spectralQ?.bandwidth ?? null,
  },
  others: result.peaks
    .filter((peak) => Math.abs(peak.frequency - target.frequency) > SAME_PEAK_HZ)
    .map((peak) => ({ frequency: peak.frequency, level: peak.level })),
});

export const takeDecayQ = (cache: TakeCache, result: TakeResult, target: DecayTarget): PeakDecay =>
  measureDecayQ(decayInput(cache, result, target));

export const takeDecaySeries = (
  cache: TakeCache,
  result: TakeResult,
  target: DecayTarget,
  tapNumber: number,
): DecaySeries | null => {
  const tap = cache.taps.find((t) => t.number === tapNumber);
  if (!tap) return null;
  return inspectDecay({ ...decayInput(cache, result, target), tap: tap.onset });
};

export function* analyzeTake(input: TakeInput): Generator<void, TakeAnalysis, void> {
  const taps = detectTaps({ filtered: input.filtered, raw: input.raw });
  const accepted = taps.filter((tap) => tap.rejection === null);
  const powers = new Map<number, Float64Array>();
  for (const [i, tap] of accepted.entries()) {
    powers.set(tap.number, tapPower(input.filtered, tap.onset));
    if ((i + 1) % TAPS_PER_STEP === 0) yield;
  }
  yield;
  const cache: TakeCache = {
    signal: input.filtered,
    taps,
    powers,
    sampleRate: input.sampleRate,
    mode: input.mode,
    mobile: input.mobile,
  };
  return { cache, result: recomputeTake(cache, []) };
}

export const runTake = (input: TakeInput): TakeAnalysis => {
  const steps = analyzeTake(input);
  let next = steps.next();
  while (!next.done) next = steps.next();
  return next.value;
};
