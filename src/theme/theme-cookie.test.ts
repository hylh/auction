import { describe, expect, it } from "vitest";
import {
  DEFAULT_THEME,
  parseTheme,
  parseThemeFromCookieHeader,
  serializeThemeCookie,
} from "./theme-cookie";

describe("parseTheme", () => {
  it("accepts dark", () => {
    expect(parseTheme("dark")).toBe("dark");
  });

  it("accepts light", () => {
    expect(parseTheme("light")).toBe("light");
  });

  it("returns default for undefined", () => {
    expect(parseTheme(undefined)).toBe(DEFAULT_THEME);
  });

  it("returns default for null", () => {
    expect(parseTheme(null)).toBe(DEFAULT_THEME);
  });

  it("returns default for empty string", () => {
    expect(parseTheme("")).toBe(DEFAULT_THEME);
  });

  it("returns default for unknown value", () => {
    expect(parseTheme("system")).toBe(DEFAULT_THEME);
  });

  it("returns default for injected-looking value", () => {
    expect(parseTheme("dark; Path=/")).toBe(DEFAULT_THEME);
  });
});

describe("parseThemeFromCookieHeader", () => {
  it("reads theme=dark from Cookie header", () => {
    expect(parseThemeFromCookieHeader("theme=dark")).toBe("dark");
  });

  it("reads theme=light from Cookie header", () => {
    expect(parseThemeFromCookieHeader("theme=light")).toBe("light");
  });

  it("reads theme when there are other cookies before it", () => {
    expect(parseThemeFromCookieHeader("session=abc123; theme=light; lang=en")).toBe("light");
  });

  it("reads theme when it appears first", () => {
    expect(parseThemeFromCookieHeader("theme=dark; other=value")).toBe("dark");
  });

  it("returns default when cookie header is null", () => {
    expect(parseThemeFromCookieHeader(null)).toBe(DEFAULT_THEME);
  });

  it("returns default when cookie header is undefined", () => {
    expect(parseThemeFromCookieHeader(undefined)).toBe(DEFAULT_THEME);
  });

  it("returns default when theme cookie is absent", () => {
    expect(parseThemeFromCookieHeader("session=abc; lang=en")).toBe(DEFAULT_THEME);
  });

  it("returns default for invalid theme value in cookie", () => {
    expect(parseThemeFromCookieHeader("theme=rainbow")).toBe(DEFAULT_THEME);
  });
});

describe("serializeThemeCookie", () => {
  it("serializes dark theme with correct attributes", () => {
    const cookie = serializeThemeCookie("dark");
    expect(cookie).toContain("theme=dark");
    expect(cookie).toContain("Path=/");
    expect(cookie).toContain("Max-Age=31536000");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).not.toContain("HttpOnly");
  });

  it("serializes light theme", () => {
    const cookie = serializeThemeCookie("light");
    expect(cookie).toContain("theme=light");
  });
});
