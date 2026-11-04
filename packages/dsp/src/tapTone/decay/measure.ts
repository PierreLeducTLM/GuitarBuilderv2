import {
  chooseIsolation,
  type DecayIsolation,
  type DecayPeak,
  isIsolated,
  type NeighbourPeak,
} from "./band.ts";
import { type CombinedReason, combineTaps } from "./combine.ts";
import { fitTapDecay, type TapFit } from "./fit.ts";
import { type IsolatedResonance, isolateResonance, type Samples } from "./isolate.ts";
import { type DecayNoise, estimateNoise } from "./noise.ts";
import { quietStretches, type SampleRange, tapSegment } from "./segment.ts";

export type DecayInput = {
  readonly signal: Samples;
  readonly onsets: readonly number[];
  readonly used: readonly number[];
  readonly peak: DecayPeak;
  readonly others: readonly NeighbourPeak[];
};

export type PeakDecayReason = "MODE_NOT_ISOLATED" | "NO_QUIET_REFERENCE" | CombinedReason;

export type TapDecay = TapFit & { readonly onset: number };

type DecayOutcome =
  | { readonly q: number; readonly tau: number; readonly reason: null }
  | { readonly q: null; readonly tau: null; readonly reason: PeakDecayReason };

export type PeakDecay = DecayOutcome & {
  readonly isolation: DecayIsolation;
  readonly noise: DecayNoise | null;
  readonly taps: readonly TapDecay[];
  readonly valid: number;
  readonly used: number;
  readonly spread: number | null;
};

export type MeasuredTap = {
  readonly isolated: IsolatedResonance;
  readonly decay: TapDecay;
};

export type DecayAnalysis =
  | {
      readonly reason: "MODE_NOT_ISOLATED" | "NO_QUIET_REFERENCE";
      readonly isolation: DecayIsolation;
    }
  | {
      readonly reason: null;
      readonly isolation: DecayIsolation;
      readonly noise: DecayNoise;
      readonly taps: readonly MeasuredTap[];
    };

const isolateRange = (input: DecayInput, isolation: DecayIsolation, range: SampleRange) =>
  isolateResonance({
    samples: input.signal.subarray(range.start, range.end),
    frequency: input.peak.frequency,
    halfLength: isolation.halfLength,
  });

export const analyseDecay = (input: DecayInput): DecayAnalysis => {
  const isolation = chooseIsolation(input.peak, input.others);
  if (!isIsolated(isolation)) return { reason: "MODE_NOT_ISOLATED", isolation };
  const length = input.signal.length;
  const stretches = quietStretches({ onsets: input.onsets, length });
  const isolatedTaps = input.used.map((onset) =>
    isolateRange(input, isolation, tapSegment({ onset, onsets: input.onsets, length })),
  );
  const noise = estimateNoise({
    quiet: stretches.map((stretch) => isolateRange(input, isolation, stretch).envelope),
    quietSamples: stretches.reduce((total, stretch) => total + stretch.end - stretch.start, 0),
    tails: isolatedTaps.map((tap) => tap.envelope),
    kernelLength: isolation.kernelLength,
  });
  if (noise === null) return { reason: "NO_QUIET_REFERENCE", isolation };
  const taps = isolatedTaps.map((isolated, i) => ({
    isolated,
    decay: {
      onset: input.used[i] ?? 0,
      ...fitTapDecay({ isolated, noise, frequency: input.peak.frequency }),
    },
  }));
  return { reason: null, isolation, noise, taps };
};

export const measureDecayQ = (input: DecayInput): PeakDecay => {
  const analysis = analyseDecay(input);
  const used = input.used.length;
  if (analysis.reason !== null) {
    const { reason, isolation } = analysis;
    return {
      q: null,
      tau: null,
      reason,
      isolation,
      noise: null,
      taps: [],
      valid: 0,
      used,
      spread: null,
    };
  }
  const taps = analysis.taps.map((tap) => tap.decay);
  const combined = combineTaps(taps);
  const common = {
    isolation: analysis.isolation,
    noise: analysis.noise,
    taps,
    valid: combined.valid,
    used,
    spread: combined.spread,
  };
  if (combined.reason !== null) {
    return { q: null, tau: null, reason: combined.reason, ...common };
  }
  return {
    q: combined.q,
    tau: combined.q / (Math.PI * input.peak.frequency),
    reason: null,
    ...common,
  };
};
