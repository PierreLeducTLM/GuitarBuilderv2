import {
  DECAY_DECIMATION,
  DECAY_END_MARGIN,
  DECAY_NOISE_FLOOR_MIN,
  DECAY_QUIET_KERNEL_FACTOR,
  DECAY_QUIET_MIN_SECONDS,
  DECAY_TAIL_KERNEL_FACTOR,
  DECAY_TAIL_MIN_SAMPLES,
  DECAY_TAIL_WINDOWS_NEEDED,
  SAMPLE_RATE,
} from "../constants.ts";
import { median } from "./stats.ts";

export type NoiseSource = "quiet" | "tapTail";

export type DecayNoise = {
  readonly floor: number;
  readonly effective: number;
  readonly threshold: number;
  readonly source: NoiseSource;
};

const floorOf = (envelope: Iterable<number>) => {
  const squares = Array.from(envelope, (e) => e * e);
  return Math.sqrt(median(squares) / Math.LN2);
};

const noiseFrom = (floor: number, source: NoiseSource): DecayNoise => {
  const effective = Math.max(floor, DECAY_NOISE_FLOOR_MIN);
  return { floor, effective, threshold: DECAY_END_MARGIN * effective, source };
};

export const estimateNoise = (input: {
  quiet: readonly Float64Array[];
  quietSamples: number;
  tails: readonly Float64Array[];
  kernelLength: number;
}): DecayNoise | null => {
  const kernelSpan = input.kernelLength - 1;
  const quietNeeded = Math.max(
    DECAY_QUIET_MIN_SECONDS * SAMPLE_RATE,
    DECAY_QUIET_KERNEL_FACTOR * kernelSpan * DECAY_DECIMATION,
  );
  if (input.quietSamples >= quietNeeded) {
    return noiseFrom(floorOf(input.quiet.flatMap((envelope) => [...envelope])), "quiet");
  }
  const window = Math.max(DECAY_TAIL_MIN_SAMPLES, DECAY_TAIL_KERNEL_FACTOR * kernelSpan);
  const tailFloors = input.tails
    .filter((envelope) => envelope.length >= DECAY_TAIL_WINDOWS_NEEDED * window)
    .map((envelope) => floorOf(envelope.subarray(envelope.length - window)));
  if (tailFloors.length === 0) return null;
  return noiseFrom(Math.min(...tailFloors), "tapTail");
};
