"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useSyncExternalStore,
} from "react";
import {
  DARK_SCHEME_QUERY,
  parseThemePreference,
  type ResolvedTheme,
  resolveTheme,
  THEME_STORAGE_KEY,
  type ThemePreference,
} from "@/lib/theme";

const listeners = new Set<() => void>();

function readPreference(): ThemePreference {
  try {
    return parseThemePreference(window.localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return "system";
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === THEME_STORAGE_KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function applyTheme(theme: ResolvedTheme) {
  const root = document.documentElement;
  root.setAttribute("data-theme", theme);
  root.style.colorScheme = theme;
}

interface ThemeContextValue {
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * Applies the chosen theme immediately, persists it per browser, and while System is
 * selected follows live changes of the device preference. The first paint is handled
 * by the inline script in the root layout.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  // The server cannot know the stored preference; React re-renders after hydration.
  const preference = useSyncExternalStore(subscribe, readPreference, () => "system" as const);

  const setPreference = useCallback((next: ThemePreference) => {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Storage blocked: the choice still applies for this page view.
    }
    applyTheme(resolveTheme(next, window.matchMedia(DARK_SCHEME_QUERY).matches));
    for (const listener of listeners) listener();
  }, []);

  useEffect(() => {
    const media = window.matchMedia(DARK_SCHEME_QUERY);
    applyTheme(resolveTheme(preference, media.matches));
    if (preference !== "system") return;
    const onChange = () => applyTheme(resolveTheme("system", media.matches));
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [preference]);

  return (
    <ThemeContext.Provider value={{ preference, setPreference }}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("useTheme must be used inside <ThemeProvider>");
  return value;
}
