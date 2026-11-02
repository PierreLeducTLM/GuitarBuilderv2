"use client";

import type { Json, StepChange, StepEntry } from "@gb/db";
import { useToast } from "@gb/ui";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { mergeStepState } from "@/lib/sequence/state";
import { StepStore } from "@/lib/sequence/store";
import type { StepKey } from "@/lib/sequence/template";
import { createClient } from "@/lib/supabase/client";

/** Sends one step change through update_build_step; rejects when it was not saved. */
async function saveStepChange(buildId: string, key: StepKey, change: StepChange) {
  const { data, error } = await createClient().rpc("update_build_step", {
    p_build_id: buildId,
    p_step_key: key,
    p_change: change as unknown as Json,
  });
  if (error || !data) throw error ?? new Error("Step change not saved");
  return data as unknown as StepEntry;
}

/**
 * The build's step store, created once per build: shows changes at once, saves them in
 * order, and shows "Failed to save changes" when a save fails. Pending notes are saved
 * when the page is hidden or left.
 */
export function useStepStore(buildId: string, storedState: unknown) {
  const t = useTranslations("builds");
  const toast = useToast();
  const report = useRef(() => {});
  report.current = () => toast.show({ type: "error", message: t("saveFailed") });

  const [store] = useState(
    () =>
      new StepStore({
        initial: mergeStepState(storedState),
        save: (key, change) => saveStepChange(buildId, key, change),
        onSaveFailed: () => report.current(),
      }),
  );
  const states = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);

  useEffect(() => {
    const flushWhenHidden = () => {
      if (document.visibilityState === "hidden") store.flushNotes();
    };
    const flush = () => store.flushNotes();
    document.addEventListener("visibilitychange", flushWhenHidden);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", flushWhenHidden);
      window.removeEventListener("pagehide", flush);
      store.flushNotes();
    };
  }, [store]);

  return { store, states };
}
