import { describe, expect, it } from "vitest";
import { parseThemeFromCookieHeader, serializeThemeCookie } from "./theme-cookie";

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
    expect(parseThemeFromCookieHeader(null)).toBe("dark");
  });

  it("returns default when cookie header is undefined", () => {
    expect(parseThemeFromCookieHeader(undefined)).toBe("dark");
  });

  it("returns default when theme cookie is absent", () => {
    expect(parseThemeFromCookieHeader("session=abc; lang=en")).toBe("dark");
  });

  it("returns default for invalid theme value in cookie", () => {
    expect(parseThemeFromCookieHeader("theme=rainbow")).toBe("dark");
  });

  it("returns default for empty and injected-looking theme cookie values", () => {
    expect(parseThemeFromCookieHeader("theme=")).toBe("dark");
    expect(parseThemeFromCookieHeader("theme=dark%3B%20Path%3D%2F")).toBe("dark");
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
