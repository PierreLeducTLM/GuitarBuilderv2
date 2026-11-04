import {
  DECAY_KERNEL_SECONDS,
  DECAY_KERNEL_SPACING_FACTOR,
  DECAY_NEIGHBOUR_RANGE_DB,
  DECAY_PRECHECK_DB_PER_HZ_SECOND,
  DECAY_PRECHECK_GUARD_SECONDS,
  DECAY_PRECHECK_MAX_DB,
  DECAY_PRECHECK_SMOOTHER_SECONDS,
  DECAY_RATE,
} from "../constants.ts";

export type DecayPeak = {
  readonly frequency: number;
  readonly level: number;
  readonly bandwidth: number | null;
};

export type NeighbourPeak = {
  readonly frequency: number;
  readonly level: number;
};

export type DecayIsolation = {
  readonly neighbour: number | null;
  readonly spacing: number;
  readonly kernelSeconds: number;
  readonly kernelLength: number;
  readonly halfLength: number;
  readonly precheckDb: number | null;
};

const nearestRelevant = (peak: DecayPeak, others: readonly NeighbourPeak[]) => {
  const distance = (other: NeighbourPeak) => Math.abs(other.frequency - peak.frequency);
  return others
    .filter(
      (other) =>
        other.frequency !== peak.frequency && other.level >= peak.level - DECAY_NEIGHBOUR_RANGE_DB,
    )
    .reduce<NeighbourPeak | undefined>(
      (best, other) => (best === undefined || distance(other) < distance(best) ? other : best),
      undefined,
    );
};

const precheck = (bandwidth: number | null, kernelSeconds: number) =>
  bandwidth === null
    ? null
    : DECAY_PRECHECK_DB_PER_HZ_SECOND *
      bandwidth *
      (DECAY_PRECHECK_GUARD_SECONDS + kernelSeconds / 2 + DECAY_PRECHECK_SMOOTHER_SECONDS);

export const chooseIsolation = (
  peak: DecayPeak,
  others: readonly NeighbourPeak[],
): DecayIsolation => {
  const image = 2 * peak.frequency;
  const nearest = nearestRelevant(peak, others);
  const neighbour =
    nearest !== undefined && Math.abs(nearest.frequency - peak.frequency) <= image
      ? nearest.frequency
      : null;
  const spacing = neighbour === null ? image : Math.abs(neighbour - peak.frequency);
  const kernelSeconds = Math.max(DECAY_KERNEL_SECONDS.min, DECAY_KERNEL_SPACING_FACTOR / spacing);
  const halfLength = Math.round((kernelSeconds * DECAY_RATE) / 2);
  return {
    neighbour,
    spacing,
    kernelSeconds,
    kernelLength: 2 * halfLength + 1,
    halfLength,
    precheckDb: precheck(peak.bandwidth, kernelSeconds),
  };
};

export const isIsolated = (isolation: DecayIsolation) =>
  isolation.kernelSeconds <= DECAY_KERNEL_SECONDS.max &&
  (isolation.precheckDb ?? 0) <= DECAY_PRECHECK_MAX_DB;
