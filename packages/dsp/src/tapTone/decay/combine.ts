import { DECAY_MAX_SPREAD, DECAY_MIN_VALID_TAPS } from "../constants.ts";
import type { TapDecayReason, TapFit } from "./fit.ts";
import { median } from "./stats.ts";

export type CombinedReason = TapDecayReason | "TOO_FEW_VALID_TAPS" | "TAPS_INCONSISTENT";

export type CombinedDecay = (
  | { readonly q: number; readonly reason: null }
  | { readonly q: null; readonly reason: CombinedReason }
) & {
  readonly valid: number;
  readonly spread: number | null;
};

const TIE_ORDER: readonly TapDecayReason[] = [
  "NO_QUIET_REFERENCE",
  "DECAY_CUT_OFF",
  "NOT_EXPONENTIAL",
  "NOT_ENOUGH_DECAY",
  "NO_DECAY",
];

const mostFrequentReason = (taps: readonly TapFit[]): TapDecayReason => {
  const count = (reason: TapDecayReason) => taps.filter((tap) => tap.reason === reason).length;
  return TIE_ORDER.reduce((best, reason) => (count(reason) > count(best) ? reason : best));
};

export const combineTaps = (taps: readonly TapFit[]): CombinedDecay => {
  const qs = taps.flatMap((tap) => (tap.q === null ? [] : [tap.q]));
  const valid = qs.length;
  if (taps.length < DECAY_MIN_VALID_TAPS) {
    return { q: null, reason: "TOO_FEW_VALID_TAPS", valid, spread: null };
  }
  if (valid < DECAY_MIN_VALID_TAPS) {
    return { q: null, reason: mostFrequentReason(taps), valid, spread: null };
  }
  const centre = median(qs);
  const spread = median(qs.map((q) => Math.abs(q - centre))) / centre;
  if (spread > DECAY_MAX_SPREAD) return { q: null, reason: "TAPS_INCONSISTENT", valid, spread };
  return { q: centre, reason: null, valid, spread };
};
