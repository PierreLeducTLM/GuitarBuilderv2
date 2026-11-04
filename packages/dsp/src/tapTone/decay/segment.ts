import { DECAY_NEXT_TAP_MARGIN_SAMPLES, DECAY_SEGMENT_MAX_SAMPLES } from "../constants.ts";

export type SampleRange = {
  readonly start: number;
  readonly end: number;
};

export const tapSegment = (input: {
  onset: number;
  onsets: readonly number[];
  length: number;
}): SampleRange => {
  const next = input.onsets.find((other) => other > input.onset);
  const nextLimit =
    next === undefined ? Number.POSITIVE_INFINITY : next - DECAY_NEXT_TAP_MARGIN_SAMPLES;
  return {
    start: input.onset,
    end: Math.min(nextLimit, input.length, input.onset + DECAY_SEGMENT_MAX_SAMPLES),
  };
};

export const quietStretches = (input: {
  onsets: readonly number[];
  length: number;
}): readonly SampleRange[] => {
  if (input.onsets.length === 0) return [];
  const first = input.onsets[0] ?? 0;
  const last = input.onsets.at(-1) ?? 0;
  return [
    { start: 0, end: first - DECAY_NEXT_TAP_MARGIN_SAMPLES },
    { start: last + DECAY_SEGMENT_MAX_SAMPLES, end: input.length },
  ].filter((stretch) => stretch.end > stretch.start);
};
