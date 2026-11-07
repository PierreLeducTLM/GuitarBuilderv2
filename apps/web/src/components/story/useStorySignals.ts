"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

/** Changes arriving within this time of the first one lead to a single refresh. */
export const SIGNAL_COALESCE_MS = 1000;

/**
 * Follows a shared build's "changed" signals on its private Realtime topic while
 * `enabled` (build-story-sharing: Live Story Updates). Signals carry nothing; a burst of
 * them, such as notes saved while the owner types, calls `onSignal` once.
 */
export function useStorySignals(token: string, enabled: boolean, onSignal: () => void) {
  const latest = useRef(onSignal);
  latest.current = onSignal;

  useEffect(() => {
    if (!enabled) return;
    const client = createClient();
    let pending: ReturnType<typeof setTimeout> | null = null;
    const channel = client
      .channel(`story:${token}`, { config: { private: true } })
      .on("broadcast", { event: "changed" }, () => {
        if (pending !== null) return;
        pending = setTimeout(() => {
          pending = null;
          latest.current();
        }, SIGNAL_COALESCE_MS);
      })
      .subscribe();
    return () => {
      if (pending !== null) clearTimeout(pending);
      void client.removeChannel(channel);
    };
  }, [token, enabled]);
}
