/**
 * Theme preference (app-shell: Theme Selection and Persistence, System Theme Follows
 * Device Preference, Theme Applies To All Screens). Stored per browser in
 * localStorage; nothing stored means System.
 */

export const THEME_STORAGE_KEY = "gb-theme";
export const themePreferences = ["light", "system", "dark"] as const;
export type ThemePreference = (typeof themePreferences)[number];
export type ResolvedTheme = "light" | "dark";
export const DARK_SCHEME_QUERY = "(prefers-color-scheme: dark)";

export function parseThemePreference(stored: unknown): ThemePreference {
  return typeof stored === "string" && (themePreferences as readonly string[]).includes(stored)
    ? (stored as ThemePreference)
    : "system";
}

export function resolveTheme(
  preference: ThemePreference,
  systemPrefersDark: boolean,
): ResolvedTheme {
  if (preference === "system") return systemPrefersDark ? "dark" : "light";
  return preference;
}

/**
 * Runs in <head> before first paint on every page (root layout). It must stay
 * self-contained and match `parseThemePreference` + `resolveTheme`; theme.test.ts
 * runs it against those functions.
 */
export const themeInitScript = `(function(){try{var p=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)});if(p!=="light"&&p!=="dark"&&p!=="system")p="system";var d=p==="dark"||(p==="system"&&window.matchMedia(${JSON.stringify(
  DARK_SCHEME_QUERY,
)}).matches);var r=document.documentElement;r.setAttribute("data-theme",d?"dark":"light");r.style.colorScheme=d?"dark":"light";}catch(e){}})();`;
