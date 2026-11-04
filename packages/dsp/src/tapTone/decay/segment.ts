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
