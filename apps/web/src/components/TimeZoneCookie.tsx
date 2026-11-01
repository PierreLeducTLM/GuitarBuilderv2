"use client";

import { useEffect } from "react";
import { PREFERENCE_COOKIE_MAX_AGE, TIME_ZONE_COOKIE } from "@/i18n/config";

/** Remembers the browser's time zone so later server renders format dates in it. */
export function TimeZoneCookie({ current }: { current: string }) {
  useEffect(() => {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (zone && zone !== current) {
      // biome-ignore lint/suspicious/noDocumentCookie: a plain preference cookie, read by the server
      document.cookie = `${TIME_ZONE_COOKIE}=${zone}; path=/; max-age=${PREFERENCE_COOKIE_MAX_AGE}; samesite=lax`;
    }
  }, [current]);
  return null;
}
