"use client";

import { useCallback, useState } from "react";
import { type Theme, serializeThemeCookie } from "./theme-cookie";

/**
 * Hydration-safe theme hook.
 *
 * Initializes from document.documentElement.dataset.theme (the value the
 * no-flash inline script already set) rather than a hardcoded default.
 * This prevents a SSR -> client mismatch when the server rendered a
 * theme from the cookie and the inline script has already applied it.
 */
export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof document === "undefined") return "dark";
    const current = document.documentElement.dataset.theme;
    return current === "dark" || current === "light" ? current : "dark";
  });

  const setTheme = useCallback((next: Theme) => {
    document.documentElement.dataset.theme = next;
    document.cookie = serializeThemeCookie(next);
    setThemeState(next);
  }, []);

  return { theme, setTheme };
}
