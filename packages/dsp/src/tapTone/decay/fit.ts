import {
  DECAY_CONTACT_GUARD_SAMPLES,
  DECAY_DB_PER_NEPER,
  DECAY_HALF_RATIO,
  DECAY_MAX_RESIDUAL_DB,
  DECAY_MIN_FIT_SAMPLES,
  DECAY_MIN_RANGE_DB,
} from "../constants.ts";
import type { IsolatedResonance } from "./isolate.ts";
import type { DecayNoise } from "./noise.ts";

export type TapDecayReason =
  | "NO_QUIET_REFERENCE"
  | "NOT_ENOUGH_DECAY"
  | "DECAY_CUT_OFF"
  | "NO_DECAY"
  | "NOT_EXPONENTIAL";

export type FitEnd = "noise" | "recordingEnd";

export type DecayInterval = {
  readonly start: number;
  readonly end: number;
  readonly samples: number;
  readonly endedBy: FitEnd;
};

export type DecayLine = {
  readonly intercept: number;
  readonly slope: number;
  readonly tau: number;
  readonly range: number;
  readonly residual: number;
  readonly firstTau: number;
  readonly secondTau: number;
  readonly ratio: number;
};

export type TapFit =
  | {
      readonly q: number;
      readonly tau: number;
      readonly reason: null;
      readonly interval: DecayInterval;
      readonly fit: DecayLine;
    }
  | {
      readonly q: null;
      readonly tau: null;
      readonly reason: TapDecayReason;
      readonly interval: DecayInterval | null;
      readonly fit: DecayLine | null;
    };

type Line = {
  readonly intercept: number;
  readonly slope: number;
  readonly residual: number;
};

const leastSquares = (times: Float64Array, levels: Float64Array): Line => {
  const n = times.length;
  const meanT = times.reduce((total, t) => total + t, 0) / n;
  const meanL = levels.reduce((total, l) => total + l, 0) / n;
  let sxx = 0;
  let sxy = 0;
  for (let i = 0; i < n; i += 1) {
    const dt = (times[i] ?? 0) - meanT;
    sxx += dt * dt;
    sxy += dt * ((levels[i] ?? 0) - meanL);
  }
  const slope = sxy / sxx;
  const intercept = meanL - slope * meanT;
  let squares = 0;
  for (let i = 0; i < n; i += 1) {
    const error = (levels[i] ?? 0) - intercept - slope * (times[i] ?? 0);
    squares += error * error;
  }
  return { intercept, slope, residual: Math.sqrt(squares / n) };
};

const tauOf = (slope: number) => -DECAY_DB_PER_NEPER / slope;

type Halves = { readonly first: Line; readonly second: Line };

const fitLine = (times: Float64Array, levels: Float64Array) => {
  const line = leastSquares(times, levels);
  const half = times.length >> 1;
  const halves: Halves = {
    first: leastSquares(times.subarray(0, half), levels.subarray(0, half)),
    second: leastSquares(times.subarray(half), levels.subarray(half)),
  };
  const span = (times[times.length - 1] ?? 0) - (times[0] ?? 0);
  const decay: DecayLine = {
    intercept: line.intercept,
    slope: line.slope,
    tau: tauOf(line.slope),
    range: -line.slope * span,
    residual: line.residual,
    firstTau: tauOf(halves.first.slope),
    secondTau: tauOf(halves.second.slope),
    ratio: halves.first.slope / halves.second.slope,
  };
  return { decay, halves };
};

const fitInterval = (isolated: IsolatedResonance, threshold: number) => {
  const start = DECAY_CONTACT_GUARD_SAMPLES;
  const below = isolated.envelope.findIndex((e, i) => i >= start && e < threshold);
  const endedBy: FitEnd = below === -1 ? "recordingEnd" : "noise";
  const end = below === -1 ? isolated.envelope.length - 1 : below - 1;
  const interval: DecayInterval = {
    start: isolated.times[start] ?? 0,
    end: isolated.times[end] ?? 0,
    samples: end - start + 1,
    endedBy,
  };
  return { interval, first: start, last: end };
};

const refused = (
  reason: TapDecayReason,
  interval: DecayInterval | null,
  fit: DecayLine | null,
): TapFit => ({ q: null, tau: null, reason, interval, fit });

const isExponential = (decay: DecayLine, halves: Halves) =>
  decay.residual <= DECAY_MAX_RESIDUAL_DB &&
  halves.first.slope < 0 &&
  halves.second.slope < 0 &&
  decay.ratio >= DECAY_HALF_RATIO.min &&
  decay.ratio <= DECAY_HALF_RATIO.max;

export const fitTapDecay = (input: {
  isolated: IsolatedResonance;
  noise: DecayNoise;
  frequency: number;
}): TapFit => {
  const { isolated, noise } = input;
  const notEnough: TapDecayReason =
    noise.source === "tapTail" ? "NO_QUIET_REFERENCE" : "NOT_ENOUGH_DECAY";
  if (isolated.envelope.length - DECAY_CONTACT_GUARD_SAMPLES < DECAY_MIN_FIT_SAMPLES) {
    return refused("DECAY_CUT_OFF", null, null);
  }
  const { interval, first, last } = fitInterval(isolated, noise.threshold);
  if (interval.samples < DECAY_MIN_FIT_SAMPLES) return refused(notEnough, interval, null);
  const levels = isolated.envelope.slice(first, last + 1).map((e) => 20 * Math.log10(e));
  const { decay, halves } = fitLine(isolated.times.subarray(first, last + 1), levels);
  if (decay.slope >= 0) return refused("NO_DECAY", interval, decay);
  if (decay.range < DECAY_MIN_RANGE_DB) {
    return refused(
      interval.endedBy === "recordingEnd" ? "DECAY_CUT_OFF" : notEnough,
      interval,
      decay,
    );
  }
  if (!isExponential(decay, halves)) return refused("NOT_EXPONENTIAL", interval, decay);
  return {
    q: Math.PI * input.frequency * decay.tau,
    tau: decay.tau,
    reason: null,
    interval,
    fit: decay,
  };
};
