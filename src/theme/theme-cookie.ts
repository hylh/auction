/** Valid theme values. */
export type Theme = "dark" | "light";

export const DEFAULT_THEME: Theme = "dark";

const COOKIE_NAME = "theme";

/**
 * Strictly parse a raw cookie value: only accept "dark" or "light".
 * Anything else (undefined, null, empty, "system", unknown) falls back
 * to the configured default so we never store a bad value.
 */
export function parseTheme(value: string | null | undefined): Theme {
  if (value === "dark" || value === "light") return value;
  return DEFAULT_THEME;
}

/**
 * Build the Set-Cookie string for persisting the theme.
 * Non-HttpOnly so the inline no-flash script can read document.cookie.
 */
export function serializeThemeCookie(theme: Theme): string {
  return `${COOKIE_NAME}=${theme}; Path=/; Max-Age=31536000; SameSite=Lax`;
}

/**
 * Parse a Cookie header string and return the validated theme.
 * Safe to call with undefined (first-visit / no cookie).
 */
export function parseThemeFromCookieHeader(cookieHeader: string | null | undefined): Theme {
  if (!cookieHeader) return DEFAULT_THEME;
  const match = /(?:^|;\s*)theme=([^;]+)/.exec(cookieHeader);
  return parseTheme(match ? decodeURIComponent(match[1]) : undefined);
}
