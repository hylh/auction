import { createFileRoute } from "@tanstack/react-router";
import { metricsSnapshot, metricsText } from "../domain/metrics";
import { parseThemeFromCookieHeader } from "../theme/theme-cookie";
import { databaseMetricsText, loadDatabaseMetrics } from "../server/database-metrics";
import { renderMetricsPage } from "../metrics/metrics-html";

export const Route = createFileRoute("/metrics")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const databaseMetrics = await loadDatabaseMetrics();
        if (url.searchParams.get("format") === "prometheus" || wantsPrometheusText(request)) {
          return new Response(`${metricsText()}${databaseMetricsText(databaseMetrics)}`, {
            headers: {
              "Content-Type": "text/plain; version=0.0.4",
            },
          });
        }

        const cookieHeader = request.headers.get("cookie");
        const setTheme = url.searchParams.get("set_theme");
        const theme =
          setTheme === "dark" || setTheme === "light"
            ? setTheme
            : parseThemeFromCookieHeader(cookieHeader);

        // If theme is being set via GET param, redirect so the cookie is written
        // (form submission → set cookie in response header → redirect to clean URL)
        if (setTheme === "dark" || setTheme === "light") {
          return new Response(null, {
            status: 302,
            headers: {
              Location: "/metrics",
              "Set-Cookie": `theme=${setTheme}; Path=/; Max-Age=31536000; SameSite=Lax`,
            },
          });
        }

        return new Response(renderMetricsPage(metricsSnapshot(), databaseMetrics, theme), {
          headers: {
            "Content-Type": "text/html; charset=utf-8",
          },
        });
      },
    },
  },
});

function wantsPrometheusText(request: Request) {
  const accept = request.headers.get("accept") ?? "";
  return !accept.includes("text/html");
}
