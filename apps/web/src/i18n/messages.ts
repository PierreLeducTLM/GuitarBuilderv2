import type en from "../../messages/en.json";
import { type AppLocale, type MessageTree, mergeMessages } from "./config";

export type Messages = typeof en;

/** Loads a catalog at runtime; French falls back to English key by key. */
export async function loadMessages(locale: AppLocale): Promise<Messages> {
  const english = (await import("../../messages/en.json")).default;
  if (locale === "en") return english;
  const localized = (await import(`../../messages/${locale}.json`)).default as MessageTree;
  return mergeMessages(english, localized);
}
