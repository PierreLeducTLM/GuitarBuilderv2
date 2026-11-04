"use client";

import { analyzeTake, type TakeMode } from "@gb/dsp";
import { useCallback, useEffect, useRef } from "react";
import type { DialogEvent, TakeAudio } from "@/lib/tap-tone/machine";

type Job = { cancelled: boolean };

/** Runs the take analysis in small steps so the page stays responsive; a newer run or closing abandons it. */
export function useTakeAnalysis(dispatch: (event: DialogEvent) => void) {
  const job = useRef<Job | null>(null);

  const analyse = useCallback(
    (options: { run: number; audio: TakeAudio; mode: TakeMode; mobile: boolean }) => {
      const { run, audio, mode, mobile } = options;
      if (job.current) job.current.cancelled = true;
      const current: Job = { cancelled: false };
      job.current = current;
      const signal = audio.filtered[0];
      if (!signal || signal.length < 2) {
        setTimeout(() => {
          if (!current.cancelled) dispatch({ type: "analysisFailed", run });
        }, 0);
        return;
      }
      const steps = analyzeTake({
        filtered: signal,
        raw: audio.raw,
        sampleRate: audio.sampleRate,
        mode,
        mobile,
      });
      const step = () => {
        if (current.cancelled) return;
        try {
          const next = steps.next();
          if (next.done) dispatch({ type: "analysisDone", run, analysis: next.value, audio });
          else setTimeout(step, 0);
        } catch {
          dispatch({ type: "analysisFailed", run });
        }
      };
      setTimeout(step, 0);
    },
    [dispatch],
  );

  useEffect(
    () => () => {
      if (job.current) job.current.cancelled = true;
    },
    [],
  );

  return { analyse };
}
