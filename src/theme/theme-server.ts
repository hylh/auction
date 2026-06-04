import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { parseThemeFromCookieHeader } from "./theme-cookie";

export const getThemeFn = createServerFn({ method: "GET" }).handler(() => {
  const cookieHeader = getRequestHeader("cookie");
  return { theme: parseThemeFromCookieHeader(cookieHeader) };
});
