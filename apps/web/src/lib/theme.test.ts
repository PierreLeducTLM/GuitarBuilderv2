import { describe, expect, it } from "vitest";
import {
  DARK_SCHEME_QUERY,
  parseThemePreference,
  resolveTheme,
  THEME_STORAGE_KEY,
  themeInitScript,
  themePreferences,
} from "./theme";

describe("parseThemePreference", () => {
  it("keeps a valid stored preference", () => {
    for (const preference of themePreferences) {
      expect(parseThemePreference(preference)).toBe(preference);
    }
  });

  it("treats nothing stored or anything unexpected as System", () => {
    expect(parseThemePreference(null)).toBe("system");
    expect(parseThemePreference(undefined)).toBe("system");
    expect(parseThemePreference("Dark")).toBe("system");
    expect(parseThemePreference("")).toBe("system");
  });
});

describe("resolveTheme", () => {
  it("follows the device preference only when System is selected", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
    expect(resolveTheme("light", true)).toBe("light");
  });
});

/** Runs the pre-paint script against a fake document and returns what it applied. */
function runInitScript(stored: string | null, prefersDark: boolean, storageThrows = false) {
  const attributes: Record<string, string> = {};
  const style: Record<string, string> = {};
  const queries: string[] = [];
  const localStorage = {
    getItem(key: string) {
      if (storageThrows) throw new Error("blocked");
      return key === THEME_STORAGE_KEY ? stored : null;
    },
  };
  const window = {
    matchMedia(query: string) {
      queries.push(query);
      return { matches: prefersDark };
    },
  };
  const document = {
    documentElement: {
      setAttribute(name: string, value: string) {
        attributes[name] = value;
      },
      style,
    },
  };
  new Function("localStorage", "window", "document", themeInitScript)(
    localStorage,
    window,
    document,
  );
  return { theme: attributes["data-theme"], colorScheme: style.colorScheme, queries };
}

describe("themeInitScript", () => {
  const cases: Array<[string | null, boolean]> = [
    [null, true],
    [null, false],
    ["system", true],
    ["system", false],
    ["dark", false],
    ["light", true],
    ["bogus", true],
  ];

  it.each(cases)("stored %s with dark device %s matches resolveTheme", (stored, prefersDark) => {
    const expected = resolveTheme(parseThemePreference(stored), prefersDark);
    const applied = runInitScript(stored, prefersDark);
    expect(applied.theme).toBe(expected);
    expect(applied.colorScheme).toBe(expected);
  });

  it("asks the device preference with the shared media query", () => {
    expect(runInitScript(null, true).queries).toEqual([DARK_SCHEME_QUERY]);
  });

  it("never throws when storage is blocked", () => {
    expect(() => runInitScript(null, true, true)).not.toThrow();
  });
});
