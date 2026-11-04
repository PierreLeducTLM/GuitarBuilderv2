import {
  chooseIsolation,
  type DecayIsolation,
  type DecayPeak,
  isIsolated,
  type NeighbourPeak,
} from "./band.ts";
import type { Samples } from "./isolate.ts";

export type DecayInput = {
  readonly signal: Samples;
  readonly onsets: readonly number[];
  readonly used: readonly number[];
  readonly peak: DecayPeak;
  readonly others: readonly NeighbourPeak[];
};

export type PeakDecayReason = "MODE_NOT_ISOLATED";

export type PeakDecay = {
  readonly reason: PeakDecayReason | null;
  readonly isolation: DecayIsolation;
};

export const measureDecayQ = (input: DecayInput): PeakDecay => {
  const isolation = chooseIsolation(input.peak, input.others);
  return { reason: isIsolated(isolation) ? null : "MODE_NOT_ISOLATED", isolation };
};
