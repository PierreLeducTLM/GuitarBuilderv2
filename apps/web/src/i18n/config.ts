import type { Formats } from "next-intl";

/** Interface languages. English is the default and the fallback for missing text. */
export const locales = ["en", "fr"] as const;
export type AppLocale = (typeof locales)[number];
export const defaultLocale: AppLocale = "en";

/** Cookie holding the language chosen in this browser (app-shell: Language Switching). */
export const LOCALE_COOKIE = "gb-locale";
/** Cookie holding the browser's IANA time zone, so the server formats dates in it. */
export const TIME_ZONE_COOKIE = "gb-tz";
export const PREFERENCE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
export const DEFAULT_TIME_ZONE = "UTC";

export function isAppLocale(value: unknown): value is AppLocale {
  return typeof value === "string" && (locales as readonly string[]).includes(value);
}

/** The stored language if it is supported, otherwise English. */
export function resolveLocale(stored: string | null | undefined): AppLocale {
  return isAppLocale(stored) ? stored : defaultLocale;
}

export function isValidTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export function resolveTimeZone(stored: string | null | undefined): string {
  return stored && isValidTimeZone(stored) ? stored : DEFAULT_TIME_ZONE;
}

/** Named date and number formats shared by every screen. */
export const formats = {
  dateTime: {
    short: { day: "numeric", month: "short", year: "numeric" },
    long: { day: "numeric", month: "long", year: "numeric", hour: "numeric", minute: "2-digit" },
    dateTimeShort: {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    },
  },
  number: {
    integer: { maximumFractionDigits: 0 },
    decimal1: { minimumFractionDigits: 1, maximumFractionDigits: 1 },
    decimal2: { minimumFractionDigits: 2, maximumFractionDigits: 2 },
    percent: { style: "percent", maximumFractionDigits: 0 },
  },
} satisfies Formats;

/** A JSON message catalog: nested objects whose leaves are ICU message strings. */
export type MessageTree = { [key: string]: string | MessageTree };

/**
 * Deep-merges `override` onto `base`: every key of `base` is kept, and replaced by the
 * override's value where it has one. Used to show English for missing French text.
 */
export function mergeMessages<T extends MessageTree>(base: T, override: MessageTree): T {
  const result: MessageTree = { ...base };
  for (const [key, value] of Object.entries(override)) {
    const current = result[key];
    if (typeof value === "string") {
      if (typeof current !== "object") result[key] = value;
    } else if (typeof current === "object") {
      result[key] = mergeMessages(current, value);
    }
  }
  return result as T;
}
