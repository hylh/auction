import { createFileRoute } from "@tanstack/react-router";
import { metricsSnapshot, metricsText, type MetricsSnapshot } from "../domain/metrics";
import { formatMoney } from "../domain/money";
import { themeTokensCss } from "../theme/theme-tokens-css";
import { parseThemeFromCookieHeader } from "../theme/theme-cookie";
import {
  databaseMetricsText,
  loadDatabaseMetrics,
  type DatabaseMetrics,
} from "../server/database-metrics";

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

function renderMetricsPage(
  snapshot: MetricsSnapshot,
  databaseMetrics: DatabaseMetrics,
  theme: "dark" | "light" = "dark",
) {
  const cards = [
    {
      label: "Accepted bids",
      value: snapshot.counters.acceptedBids.toLocaleString("en-GB"),
      hint: "Committed bids broadcast to live auction listeners.",
    },
    {
      label: "Rejected bids",
      value: snapshot.counters.rejectedBids.toLocaleString("en-GB"),
      hint: "Business-rule rejections such as stale or insufficient bids.",
    },
    {
      label: "Auctions created",
      value: snapshot.counters.auctionsCreated.toLocaleString("en-GB"),
      hint: "Auctions created through the application service path.",
    },
    {
      label: "Auctions closed",
      value: snapshot.counters.auctionsClosed.toLocaleString("en-GB"),
      hint: "Manual or lifecycle-driven auction closures.",
    },
    {
      label: "Completed sales",
      value: snapshot.counters.salesCompleted.toLocaleString("en-GB"),
      hint: "Closed auctions with a winning bid and sale record.",
    },
    {
      label: "Total sale value",
      value: formatMoney(snapshot.counters.totalSaleValueCents),
      hint: "Cumulative completed sale value.",
    },
    {
      label: "Validation failures",
      value: snapshot.counters.validationFailures.toLocaleString("en-GB"),
      hint: "Zod input validation failures.",
    },
    {
      label: "Close failures",
      value: snapshot.counters.closeFailures.toLocaleString("en-GB"),
      hint: "Failed close attempts that surfaced as errors.",
    },
    {
      label: "Simulator requests",
      value: snapshot.counters.simulatorRequests.toLocaleString("en-GB"),
      hint: "Requests made to the simulator API.",
    },
  ];
  const databaseCards = [
    {
      label: "Database size",
      value: formatBytes(databaseMetrics.databaseSizeBytes),
      hint: "Total PostgreSQL database footprint.",
    },
    {
      label: "Postgres sessions",
      value: databaseMetrics.connections.total.toLocaleString("en-GB"),
      hint: `${databaseMetrics.connections.active.toLocaleString("en-GB")} active, including this scrape · ${databaseMetrics.connections.idle.toLocaleString("en-GB")} idle from app, tools, and old dev pools.`,
    },
    {
      label: "App DB sessions",
      value: databaseMetrics.connections.appTotal.toLocaleString("en-GB"),
      hint: `${databaseMetrics.connections.appActive.toLocaleString("en-GB")} active · ${databaseMetrics.connections.appIdle.toLocaleString("en-GB")} idle for ${databaseMetrics.connections.applicationName}.`,
    },
    {
      label: "Active auctions",
      value: databaseMetrics.load.activeAuctions.toLocaleString("en-GB"),
      hint: "Open auction rows accepting bids.",
    },
    {
      label: "Bids / min",
      value: databaseMetrics.load.bidsLastMinute.toLocaleString("en-GB"),
      hint: `${databaseMetrics.load.bidsLastFiveMinutes.toLocaleString("en-GB")} bids in the last five minutes.`,
    },
    {
      label: "Auctions / min",
      value: databaseMetrics.load.auctionsCreatedLastMinute.toLocaleString("en-GB"),
      hint: "Recently created auctions; expected load target is about 6/min.",
    },
    {
      label: "Hot auction bids",
      value: databaseMetrics.load.hottestAuctionBidCount.toLocaleString("en-GB"),
      hint: `Average ${databaseMetrics.load.averageBidsPerActiveAuction.toFixed(1)} bids per active auction.`,
    },
    {
      label: "Newest bid age",
      value:
        databaseMetrics.load.newestBidAgeSeconds === null
          ? "none"
          : `${databaseMetrics.load.newestBidAgeSeconds.toLocaleString("en-GB")}s`,
      hint: "Useful for spotting stalled bid ingestion.",
    },
  ];

  return `<!doctype html>
<html lang="en" data-theme="${theme}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta http-equiv="refresh" content="5" />
    <title>Fish Auction Metrics</title>
    <style>
      ${themeTokensCss}
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: "IBM Plex Sans", Inter, ui-sans-serif, system-ui, "Segoe UI", sans-serif;
        line-height: 1.5;
        color: var(--text);
        background: var(--body-bg);
        background-attachment: fixed;
      }
      a { color: inherit; }
      .topbar {
        display: flex; align-items: center; justify-content: space-between; gap: 1rem;
        padding: 0.9rem clamp(1rem, 5vw, 3rem);
        border-bottom: 1px solid var(--line);
        background: var(--topbar-bg);
        backdrop-filter: var(--topbar-backdrop);
        position: sticky; top: 0; z-index: 10;
      }
      .brand {
        font-weight: 800; letter-spacing: -0.03em; text-decoration: none;
        font-size: 1.05rem; display: flex; align-items: center; gap: 0.55rem; color: var(--text);
      }
      .brand .mark {
        width: 1.65rem; height: 1.65rem; border-radius: 9px;
        background: var(--mark-bg); display: grid; place-items: center;
        color: var(--mark-color); font-size: 1rem; box-shadow: var(--mark-shadow); flex: 0 0 auto;
      }
      .nav { display: flex; gap: 0.4rem; flex-wrap: wrap; }
      .nav a {
        border: 1px solid transparent; border-radius: 8px;
        padding: 0.4rem 0.8rem; text-decoration: none; color: var(--muted);
        font-size: 0.9rem; font-weight: 600;
      }
      .nav a:hover { color: var(--text); }
      .theme-form { display: inline; }
      .theme-btn {
        border: 1px solid var(--line); border-radius: 8px; background: transparent;
        color: var(--muted); font-size: 1rem; padding: 0.35rem 0.6rem; cursor: pointer;
      }
      .theme-btn:hover { color: var(--accent); border-color: var(--accent-border); }
      .page { width: min(1240px, calc(100vw - 2rem)); margin: 0 auto; padding: 1.75rem 0 4rem; }
      .hero {
        display: flex; flex-wrap: wrap; align-items: flex-end; gap: 1rem; margin-bottom: 1.5rem;
      }
      .hero h1 { margin: 0.4rem 0 0; font-size: clamp(1.8rem, 4vw, 2.8rem); letter-spacing: -0.04em; }
      .hero p { margin: 0.5rem 0 0; color: var(--muted); max-width: 620px; }
      .pill {
        display: inline-flex; align-items: center; gap: 0.4rem; border-radius: 999px;
        padding: 0.25rem 0.7rem; background: var(--accent-soft); color: var(--accent);
        font-size: 0.8rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em;
      }
      .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1rem; }
      .card {
        position: relative; overflow: hidden;
        border: 1px solid var(--line); border-radius: 16px; background: var(--panel);
        padding: 1.1rem 1.2rem; box-shadow: var(--shadow);
      }
      .card::before { content: ""; position: absolute; top: 0; left: 0; right: 0; height: 4px; }
      .card h2 { margin: 0.15rem 0 0.85rem; font-size: 0.95rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); }
      .card h3 { margin-top: 0; color: var(--text); }
      .metric { font-size: 2rem; font-weight: 800; letter-spacing: -0.04em; font-family: "IBM Plex Mono", ui-monospace, monospace; color: var(--text); }
      .muted { color: var(--muted); }
      .section { margin-top: 1rem; }
      .bar-list { display: grid; gap: 0.85rem; }
      .bar-row { display: grid; gap: 0.35rem; }
      .bar-label { display: flex; justify-content: space-between; gap: 1rem; font-weight: 700; font-size: 0.9rem; color: var(--text); }
      .bar-track { overflow: hidden; height: 0.85rem; border-radius: 999px; background: var(--line); }
      .bar-fill { height: 100%; border-radius: inherit; background: linear-gradient(90deg, var(--teal), var(--blue)); }
      .links { display: flex; gap: 0.75rem; flex-wrap: wrap; margin-top: 1rem; }
      .button {
        border: 1px solid var(--line); border-radius: 10px; padding: 0.75rem 1rem;
        background: var(--panel); color: var(--text); font-weight: 800;
        text-decoration: none; font-size: 0.95rem;
      }
      .button:hover { border-color: var(--accent-border); color: var(--accent); }
    </style>
  </head>
  <body>
    <header class="topbar">
      <a class="brand" href="/"><span class="mark">⚓</span> Fish Auction House</a>
      <nav class="nav" aria-label="Primary">
        <a href="/">Dashboard</a>
        <a href="/inventory/new">Add fish</a>
        <a href="/admin">Admin</a>
        <a href="/metrics">Metrics</a>
      </nav>
      <form class="theme-form" method="get" action="/metrics">
        <input type="hidden" name="set_theme" value="${theme === "dark" ? "light" : "dark"}" />
        <button class="theme-btn" type="submit" title="${theme === "dark" ? "Light mode" : "Dark mode"}">${theme === "dark" ? "☀" : "☽"}</button>
      </form>
    </header>
    <main class="page">
      <section class="hero">
        <div>
          <span class="pill">Live application metrics</span>
          <h1>Fish auction observability.</h1>
          <p>Domain counters and latency buckets refresh every five seconds. Use the Prometheus link for scrape-friendly text output.</p>
          <div class="links">
            <a class="button" href="/metrics?format=prometheus">Prometheus text</a>
            <a class="button" href="/metrics" aria-current="page">Refresh now</a>
          </div>
        </div>
      </section>
      <section class="grid">
        ${cards.map(renderCounterCard).join("")}
      </section>
      <section class="section">
        <h2>Database and load shape</h2>
        <div class="grid">
          ${databaseCards.map(renderCounterCard).join("")}
        </div>
      </section>
      <section class="grid section">
        ${renderTableMetrics(databaseMetrics)}
        ${renderStatusMetrics("Auction statuses", databaseMetrics.auctionStatuses)}
        ${renderStatusMetrics("Inventory statuses", databaseMetrics.inventoryStatuses)}
      </section>
      <section class="grid section">
        ${snapshot.histograms.map(renderHistogramCard).join("")}
      </section>
    </main>
  </body>
</html>`;
}

function renderTableMetrics(databaseMetrics: DatabaseMetrics) {
  const maxRows = Math.max(...databaseMetrics.tables.map((table) => table.rowCount), 1);
  return `<article class="card">
  <h2>Table rows and size</h2>
  <div class="bar-list">
    ${databaseMetrics.tables.map((table) => renderTableRow(table, maxRows)).join("")}
  </div>
</article>`;
}

function renderTableRow(table: DatabaseMetrics["tables"][number], maxRows: number) {
  const percent = Math.round((table.rowCount / maxRows) * 100);
  return `<div class="bar-row">
  <div class="bar-label">
    <span>${escapeHtml(table.tableName)}</span>
    <span>${table.rowCount.toLocaleString("en-GB")} · ${formatBytes(table.totalBytes)}</span>
  </div>
  <div class="bar-track"><div class="bar-fill" style="width: ${percent}%"></div></div>
  <p class="muted">heap ${formatBytes(table.heapBytes)} · indexes ${formatBytes(table.indexBytes)}</p>
</div>`;
}

function renderStatusMetrics(title: string, statuses: Array<{ status: string; count: number }>) {
  const maxCount = Math.max(...statuses.map((status) => status.count), 1);
  return `<article class="card">
  <h2>${escapeHtml(title)}</h2>
  <div class="bar-list">
    ${
      statuses.length === 0
        ? '<p class="muted">No rows yet.</p>'
        : statuses
            .map((status) =>
              renderBucket({ le: status.status, count: status.count }, maxCount, "status"),
            )
            .join("")
    }
  </div>
</article>`;
}

function renderCounterCard(card: { label: string; value: string; hint: string }) {
  return `<article class="card">
  <h2>${escapeHtml(card.label)}</h2>
  <p class="metric">${escapeHtml(card.value)}</p>
  <p class="muted">${escapeHtml(card.hint)}</p>
</article>`;
}

function renderHistogramCard(histogram: MetricsSnapshot["histograms"][number]) {
  const ranges = histogramBucketRanges(histogram.buckets);
  const maxCount = Math.max(...ranges.map((range) => range.count), 1);
  const average = histogram.count === 0 ? 0 : histogram.sum / histogram.count;
  const p99 =
    histogram.p99Seconds === null
      ? "no samples"
      : histogram.p99Seconds === Number.POSITIVE_INFINITY
        ? "> 10 s"
        : formatSeconds(histogram.p99Seconds);

  return `<article class="card">
  <h2>${escapeHtml(histogram.name.replace("auction_", "").replaceAll("_", " "))}</h2>
  <p class="muted">${escapeHtml(histogram.help)} · total ${histogram.count.toLocaleString("en-GB")} · avg ${formatSeconds(average)} · p99 ${escapeHtml(p99)}</p>
  <div class="bar-list">
    ${ranges.map((range) => renderBucket(range, maxCount)).join("")}
  </div>
</article>`;
}

function histogramBucketRanges(
  buckets: Array<{
    le: number | "+Inf";
    count: number;
  }>,
) {
  let previousLe = 0;
  let previousCount = 0;

  return buckets.map((bucket) => {
    const rangeCount = Math.max(0, bucket.count - previousCount);
    const label =
      bucket.le === "+Inf"
        ? `> ${formatSeconds(previousLe)}`
        : previousLe === 0
          ? `<= ${formatSeconds(bucket.le)}`
          : `${formatSeconds(previousLe)} - ${formatSeconds(bucket.le)}`;

    previousCount = bucket.count;
    if (bucket.le !== "+Inf") {
      previousLe = bucket.le;
    }

    return {
      le: label,
      count: rangeCount,
    };
  });
}

function renderBucket(
  bucket: { le: number | "+Inf" | string; count: number },
  maxCount: number,
  labelKind: "seconds" | "status" = "seconds",
) {
  const percent = Math.round((bucket.count / maxCount) * 100);
  const label =
    labelKind === "status" || typeof bucket.le === "string"
      ? String(bucket.le)
      : bucket.le === "+Inf"
        ? "+Inf"
        : formatSeconds(Number(bucket.le));
  const prefix = labelKind === "seconds" && typeof bucket.le !== "string" ? "&le; " : "";

  return `<div class="bar-row">
  <div class="bar-label">
    <span>${prefix}${escapeHtml(label)}</span>
    <span>${bucket.count.toLocaleString("en-GB")}</span>
  </div>
  <div class="bar-track"><div class="bar-fill" style="width: ${percent}%"></div></div>
</div>`;
}

function formatSeconds(seconds: number) {
  if (seconds < 1) {
    return `${Math.round(seconds * 1000)} ms`;
  }
  return `${seconds.toFixed(2)} s`;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(value >= 10 ? 1 : 2)} ${units[unitIndex]}`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
