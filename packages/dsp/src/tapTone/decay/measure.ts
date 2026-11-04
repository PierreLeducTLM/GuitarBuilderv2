import {
  chooseIsolation,
  type DecayIsolation,
  type DecayPeak,
  isIsolated,
  type NeighbourPeak,
} from "./band.ts";
import { fitTapDecay, type TapFit } from "./fit.ts";
import { isolateResonance, type Samples } from "./isolate.ts";
import { type DecayNoise, estimateNoise } from "./noise.ts";
import { quietStretches, type SampleRange, tapSegment } from "./segment.ts";

export type DecayInput = {
  readonly signal: Samples;
  readonly onsets: readonly number[];
  readonly used: readonly number[];
  readonly peak: DecayPeak;
  readonly others: readonly NeighbourPeak[];
};

export type PeakDecayReason = "MODE_NOT_ISOLATED" | "NO_QUIET_REFERENCE";

export type TapDecay = TapFit & { readonly onset: number };

export type PeakDecay = {
  readonly reason: PeakDecayReason | null;
  readonly isolation: DecayIsolation;
  readonly noise: DecayNoise | null;
  readonly taps: readonly TapDecay[];
};

const envelopeIn = (input: DecayInput, isolation: DecayIsolation, range: SampleRange) =>
  isolateResonance({
    samples: input.signal.subarray(range.start, range.end),
    frequency: input.peak.frequency,
    halfLength: isolation.halfLength,
  });

export const measureDecayQ = (input: DecayInput): PeakDecay => {
  const isolation = chooseIsolation(input.peak, input.others);
  if (!isIsolated(isolation)) {
    return { reason: "MODE_NOT_ISOLATED", isolation, noise: null, taps: [] };
  }
  const length = input.signal.length;
  const stretches = quietStretches({ onsets: input.onsets, length });
  const taps = input.used.map((onset) =>
    envelopeIn(input, isolation, tapSegment({ onset, onsets: input.onsets, length })),
  );
  const noise = estimateNoise({
    quiet: stretches.map((stretch) => envelopeIn(input, isolation, stretch).envelope),
    quietSamples: stretches.reduce((total, stretch) => total + stretch.end - stretch.start, 0),
    tails: taps.map((tap) => tap.envelope),
    kernelLength: isolation.kernelLength,
  });
  if (noise === null) return { reason: "NO_QUIET_REFERENCE", isolation, noise, taps: [] };
  const fits = taps.map((isolated, i) => ({
    onset: input.used[i] ?? 0,
    ...fitTapDecay({ isolated, noise, frequency: input.peak.frequency }),
  }));
  return { reason: null, isolation, noise, taps: fits };
};
