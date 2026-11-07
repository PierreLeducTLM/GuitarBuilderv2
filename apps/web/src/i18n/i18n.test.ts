import { createFormatter } from "next-intl";
import { describe, expect, it } from "vitest";
import en from "../../messages/en.json";
import fr from "../../messages/fr.json";
import { knownAuthErrorCodes } from "../lib/auth/errors";
import { formats, type MessageTree, mergeMessages, resolveLocale, resolveTimeZone } from "./config";
import { loadMessages } from "./messages";

function keys(tree: MessageTree, prefix = ""): string[] {
  return Object.entries(tree).flatMap(([key, value]) =>
    typeof value === "string" ? [`${prefix}${key}`] : keys(value, `${prefix}${key}.`),
  );
}

describe("resolveLocale", () => {
  it("defaults to English and accepts only supported languages", () => {
    expect(resolveLocale(undefined)).toBe("en");
    expect(resolveLocale(null)).toBe("en");
    expect(resolveLocale("fr")).toBe("fr");
    expect(resolveLocale("en")).toBe("en");
    expect(resolveLocale("de")).toBe("en");
    expect(resolveLocale("FR")).toBe("en");
  });
});

describe("resolveTimeZone", () => {
  it("keeps a valid IANA zone and falls back to UTC", () => {
    expect(resolveTimeZone("America/Toronto")).toBe("America/Toronto");
    expect(resolveTimeZone("Not/AZone")).toBe("UTC");
    expect(resolveTimeZone(undefined)).toBe("UTC");
  });
});

describe("message catalogs", () => {
  it("French has exactly the English keys", () => {
    expect(keys(fr).sort()).toEqual(keys(en).sort());
  });

  it("has no empty message", () => {
    for (const catalog of [en, fr]) {
      for (const key of keys(catalog)) {
        const value = key
          .split(".")
          .reduce<unknown>((node, part) => (node as MessageTree)[part], catalog);
        expect(typeof value === "string" && value.trim().length > 0, key).toBe(true);
      }
    }
  });

  it("translates every known auth-service error code", () => {
    for (const code of knownAuthErrorCodes) {
      expect(en.auth.errors.service[code], code).toBeTruthy();
    }
  });

  it("uses the spec's English and French labels", () => {
    expect([en.nav.builds, fr.nav.builds]).toEqual(["Builds", "Constructions"]);
    expect([en.shell.signOut, fr.shell.signOut]).toEqual(["Sign Out", "Déconnexion"]);
    expect([en.nav.tools, fr.nav.tools]).toEqual(["Tools", "Outils"]);
    expect([en.nav.assistant, fr.nav.assistant]).toEqual(["Assistant", "Assistant"]);
    expect([en.nav.you, fr.nav.you]).toEqual(["You", "Vous"]);
    expect([en.nav.woodPanels, fr.nav.woodPanels]).toEqual(["Wood panels", "Panneaux de bois"]);
    expect([en.nav.simulator, fr.nav.simulator]).toEqual(["Simulator", "Simulateur"]);
    expect([en.nav.references, fr.nav.references]).toEqual(["References", "Références"]);
    expect([en.dialog.cancel, fr.dialog.cancel]).toEqual(["Cancel", "Annuler"]);
    expect(en.app.documentTitle).toBe("Guitar Build Tracking App");
  });
});

describe("mergeMessages", () => {
  it("shows English for text without a French translation", () => {
    const merged = mergeMessages(
      { nav: { builds: "Builds", chat: "Chat" }, app: { title: "Guitar Builder" } },
      { nav: { builds: "Constructions" } },
    );
    expect(merged).toEqual({
      nav: { builds: "Constructions", chat: "Chat" },
      app: { title: "Guitar Builder" },
    });
  });

  it("ignores keys that do not exist in English or change shape", () => {
    const merged = mergeMessages({ a: "A", b: { c: "C" } }, { a: { x: "X" }, b: "B", z: "Z" });
    expect(merged).toEqual({ a: "A", b: { c: "C" }, z: "Z" });
  });

  it("loads French over English at runtime", async () => {
    const messages = await loadMessages("fr");
    expect(messages.nav.builds).toBe("Constructions");
    expect(Object.keys(messages).sort()).toEqual(Object.keys(en).sort());
  });
});

describe("formats", () => {
  const date = new Date("2025-03-02T15:30:00Z");

  it("formats numbers per locale", () => {
    const enFormat = createFormatter({ locale: "en", formats, timeZone: "UTC" });
    const frFormat = createFormatter({ locale: "fr", formats, timeZone: "UTC" });
    expect(enFormat.number(1234.5, "decimal2")).toBe("1,234.50");
    expect(frFormat.number(1234.5, "decimal2")).toBe("1 234,50");
    expect(enFormat.number(0.25, "percent")).toBe("25%");
    expect(frFormat.number(0.25, "percent")).toBe("25 %");
  });

  it("formats dates per locale and time zone", () => {
    const enFormat = createFormatter({ locale: "en", formats, timeZone: "UTC" });
    const frFormat = createFormatter({ locale: "fr", formats, timeZone: "America/Montreal" });
    expect(enFormat.dateTime(date, "short")).toBe("Mar 2, 2025");
    expect(frFormat.dateTime(date, "short")).toBe("2 mars 2025");
    expect(frFormat.dateTime(date, "long")).toBe("2 mars 2025 à 10:30");
  });

  it("writes a story's start date in full, without the time", () => {
    const started = new Date("2025-12-06T15:30:00Z");
    const enFormat = createFormatter({ locale: "en", formats, timeZone: "UTC" });
    const frFormat = createFormatter({ locale: "fr", formats, timeZone: "UTC" });
    expect(enFormat.dateTime(started, "dateLong")).toBe("December 6, 2025");
    expect(frFormat.dateTime(started, "dateLong")).toBe("6 décembre 2025");
  });
});
