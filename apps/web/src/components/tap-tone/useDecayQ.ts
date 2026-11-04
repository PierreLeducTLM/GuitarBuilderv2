"use client";

import { type DecayTarget, type PeakDecay, type TakeCache, takeDecayQ } from "@gb/dsp";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Take } from "@/lib/tap-tone/machine";
import type { DecayQView } from "./panels";

export type DecayLookup = (target: DecayTarget) => {
  view: DecayQView | "pending";
  decay: PeakDecay | null;
};

const keyOf = (used: readonly number[], frequency: number) =>
  `${used.join(",")}|${frequency.toFixed(2)}`;

const viewOf = (decay: PeakDecay): DecayQView =>
  decay.reason === null ? { value: decay.q } : { value: null, reason: decay.reason };

/** Decay Q for the peaks the dialog shows, measured lazily one at a time and remembered per take. */
export function useDecayQ(take: Take | undefined, targets: readonly DecayTarget[]): DecayLookup {
  const memo = useRef(new WeakMap<TakeCache, Map<string, PeakDecay>>());
  const [, setVersion] = useState(0);
  const results = take?.status === "results" ? take : null;
  const cache = results?.cache ?? null;
  const used = results?.result.used ?? [];

  const known = useCallback(
    (frequency: number) =>
      cache ? memo.current.get(cache)?.get(keyOf(used, frequency)) : undefined,
    [cache, used],
  );

  const missing = targets.find((target) => cache && !known(target.frequency));

  useEffect(() => {
    if (!cache || !results || !missing) return;
    const timer = setTimeout(() => {
      const decay = takeDecayQ(cache, results.result, missing);
      const entries = memo.current.get(cache) ?? new Map<string, PeakDecay>();
      entries.set(keyOf(results.result.used, missing.frequency), decay);
      memo.current.set(cache, entries);
      setVersion((version) => version + 1);
    }, 0);
    return () => clearTimeout(timer);
  }, [cache, results, missing]);

  return (target) => {
    if (results && !cache) return { view: { value: null, reason: "noRecording" }, decay: null };
    const decay = known(target.frequency);
    return decay ? { view: viewOf(decay), decay } : { view: "pending", decay: null };
  };
}
