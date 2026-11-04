import { DECAY_DISPLAY_BUCKETS, DECAY_DISPLAY_POINTS } from "../constants.ts";
import type { DecayInterval, DecayLine } from "./fit.ts";
import type { IsolatedResonance } from "./isolate.ts";
import { analyseDecay, type DecayInput, type TapDecay } from "./measure.ts";
import type { DecayNoise } from "./noise.ts";

export type SeriesPoint = {
  readonly time: number;
  readonly value: number;
};

export type DecayMarkers = {
  readonly start: number | null;
  readonly end: number | null;
  readonly noise: number;
  readonly threshold: number;
};

export type DecaySeries = {
  readonly response: readonly SeriesPoint[];
  readonly envelope: readonly SeriesPoint[];
  readonly fit: readonly SeriesPoint[];
  readonly markers: DecayMarkers;
  readonly noise: DecayNoise;
  readonly decay: TapDecay;
};

const pointAt = (isolated: IsolatedResonance, values: Float64Array, i: number): SeriesPoint => ({
  time: isolated.times[i] ?? 0,
  value: values[i] ?? 0,
});

const extremesOf = (values: Float64Array, from: number, to: number) => {
  let low = from;
  let high = from;
  for (let i = from + 1; i < to; i += 1) {
    if ((values[i] ?? 0) < (values[low] ?? 0)) low = i;
    if ((values[i] ?? 0) > (values[high] ?? 0)) high = i;
  }
  return low === high ? [low] : [Math.min(low, high), Math.max(low, high)];
};

const responseSeries = (isolated: IsolatedResonance): readonly SeriesPoint[] => {
  const count = isolated.response.length;
  return Array.from({ length: DECAY_DISPLAY_BUCKETS }, (_, b) => {
    const from = Math.floor((b * count) / DECAY_DISPLAY_BUCKETS);
    const to = Math.floor(((b + 1) * count) / DECAY_DISPLAY_BUCKETS);
    if (to <= from) return [];
    return extremesOf(isolated.response, from, to).map((i) =>
      pointAt(isolated, isolated.response, i),
    );
  }).flat();
};

const envelopeSeries = (isolated: IsolatedResonance): readonly SeriesPoint[] => {
  const count = isolated.envelope.length;
  const stride = Math.ceil(count / DECAY_DISPLAY_POINTS);
  return Array.from({ length: Math.ceil(count / stride) }, (_, j) =>
    pointAt(isolated, isolated.envelope, j * stride),
  );
};

const fitSeries = (
  envelope: readonly SeriesPoint[],
  interval: DecayInterval | null,
  fit: DecayLine | null,
): readonly SeriesPoint[] => {
  if (interval === null || fit === null) return [];
  return envelope
    .filter((point) => point.time >= interval.start && point.time <= interval.end)
    .map((point) => ({
      time: point.time,
      value: 10 ** ((fit.intercept + fit.slope * point.time) / 20),
    }));
};

export const inspectDecay = (input: DecayInput & { readonly tap: number }): DecaySeries | null => {
  const analysis = analyseDecay(input);
  if (analysis.reason !== null) return null;
  const measured = analysis.taps.find((tap) => tap.decay.onset === input.tap);
  if (measured === undefined) return null;
  const { isolated, decay } = measured;
  const envelope = envelopeSeries(isolated);
  const { noise } = analysis;
  return {
    response: responseSeries(isolated),
    envelope,
    fit: fitSeries(envelope, decay.interval, decay.fit),
    markers: {
      start: decay.interval?.start ?? null,
      end: decay.interval?.end ?? null,
      noise: noise.effective,
      threshold: noise.threshold,
    },
    noise,
    decay,
  };
};
