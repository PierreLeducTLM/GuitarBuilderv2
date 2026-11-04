import { type SpectralQ, spectralQ } from "./bandwidthQ.ts";
import {
  AIR_RANGE_HZ,
  BACK_MAX_HZ,
  BACK_MIN_ABOVE_TOP_HZ,
  BODY_BAND_HZ,
  BODY_LOCAL_MAX_POINTS,
  BODY_PROMINENCE_DB,
  BODY_PROMINENCE_POINTS,
  BODY_RANGE_DB,
  BODY_SPLIT_HZ,
  ROLE_REATTACH_HZ,
  TOP_MAX_HZ,
  TOP_MIN_AIR_RATIO,
  TOP_MIN_HZ,
} from "./constants.ts";
import { nearestPeak, type Peak, refinePeak } from "./peaks.ts";
import type { SpectrumPoint } from "./spectrum.ts";

type Candidate = Peak & { readonly spectralQ: SpectralQ | null };

export type BodyResonance = Peak & { readonly spectralQ: SpectralQ };

export type BodyResonances = {
  readonly air: BodyResonance | null;
  readonly top: BodyResonance | null;
  readonly back: BodyResonance | null;
};

const levelAt = (points: readonly SpectrumPoint[], i: number) =>
  points[i]?.db ?? Number.NEGATIVE_INFINITY;

const offsets = (count: number) => Array.from({ length: count }, (_, j) => j + 1);

const isLocalMaximum = (points: readonly SpectrumPoint[], i: number) =>
  offsets(BODY_LOCAL_MAX_POINTS).every(
    (j) =>
      levelAt(points, i) > levelAt(points, i - j) && levelAt(points, i) > levelAt(points, i + j),
  );

const isProminent = (points: readonly SpectrumPoint[], i: number) => {
  const here = levelAt(points, i);
  const lowest = (direction: 1 | -1) =>
    Math.min(
      here,
      ...offsets(BODY_PROMINENCE_POINTS).map((j) => levelAt(points, i + direction * j)),
    );
  return here - Math.max(lowest(-1), lowest(1)) >= BODY_PROMINENCE_DB;
};

const candidates = (points: readonly SpectrumPoint[]): readonly Candidate[] => {
  const maxima = points
    .map((point, i) => ({ point, i }))
    .filter(
      ({ point, i }) =>
        point.frequency >= BODY_BAND_HZ.from &&
        point.frequency <= BODY_BAND_HZ.to &&
        isLocalMaximum(points, i),
    );
  const strongest = Math.max(...maxima.map(({ point }) => point.db));
  return maxima
    .filter(({ point, i }) => point.db >= strongest - BODY_RANGE_DB && isProminent(points, i))
    .map(({ i }) => {
      const peak = refinePeak(points, i);
      return { ...peak, spectralQ: spectralQ(points, peak) };
    });
};

const lowestIn = (all: readonly Candidate[], from: number, to: number) =>
  all.find((c) => c.frequency >= from && c.frequency <= to);

const reliable = (
  all: readonly Candidate[],
  chosen: Candidate | undefined,
): BodyResonance | null => {
  if (!chosen) return null;
  const { spectralQ: q } = chosen;
  if (q === null) return null;
  const split = all.some(
    (other) => other !== chosen && Math.abs(other.frequency - chosen.frequency) <= BODY_SPLIT_HZ,
  );
  return split ? null : { ...chosen, spectralQ: q };
};

export const identifyBodyResonances = (points: readonly SpectrumPoint[]): BodyResonances => {
  const all = candidates(points);
  const air = reliable(all, lowestIn(all, AIR_RANGE_HZ.from, AIR_RANGE_HZ.to));
  const top = air
    ? reliable(
        all,
        lowestIn(all, Math.max(TOP_MIN_HZ, TOP_MIN_AIR_RATIO * air.frequency), TOP_MAX_HZ),
      )
    : null;
  const back = top
    ? reliable(all, lowestIn(all, top.frequency + BACK_MIN_ABOVE_TOP_HZ, BACK_MAX_HZ))
    : null;
  return { air, top, back };
};

export const reattachRole = (frequency: number, peaks: readonly Peak[]): Peak | null => {
  const nearest = nearestPeak(peaks, frequency);
  return nearest && Math.abs(nearest.frequency - frequency) <= ROLE_REATTACH_HZ ? nearest : null;
};
