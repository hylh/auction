import type { MetricsSnapshot } from "../domain/metrics";
import type { DatabaseMetrics } from "../server/database-metrics";
import {
  buildApplicationCards,
  buildDatabaseCards,
  histogramBucketRanges,
  type MetricCard,
} from "./metrics-cards";
import { escapeHtml, formatBytes, formatSeconds } from "./metrics-format";
import { metricsPageCss } from "./metrics-styles";

export function renderMetricsPage(
  snapshot: MetricsSnapshot,
  databaseMetrics: DatabaseMetrics,
  theme: "dark" | "light" = "dark",
) {
  const cards = buildApplicationCards(snapshot, databaseMetrics);
  const databaseCards = buildDatabaseCards(databaseMetrics);

  return `<!doctype html>
<html lang="en" data-theme="${theme}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta http-equiv="refresh" content="5" />
    <title>Fish Auction Metrics</title>
    <style>
      ${metricsPageCss}
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
    <nav class="bottom-nav" aria-label="Primary navigation">
      <a href="/"><span aria-hidden="true">🏠</span>Dashboard</a>
      <a href="/inventory/new"><span aria-hidden="true">🐟</span>Add fish</a>
      <a href="/admin"><span aria-hidden="true">📋</span>Admin</a>
      <a href="/metrics" class="active"><span aria-hidden="true">📊</span>Metrics</a>
    </nav>
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

function renderCounterCard(card: MetricCard) {
  return `<article class="card">
  <h2>${escapeHtml(card.label)}</h2>
  <p class="metric">${escapeHtml(card.value)}</p>
  <p class="muted">${escapeHtml(card.hint)}</p>
</article>`;
}

function renderHistogramCard(histogram: MetricsSnapshot["histograms"][number]) {
  const ranges = histogramBucketRanges(histogram.buckets, formatSeconds);
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

function renderBucket(
  bucket: { le: number | "+Inf" | string; count: number },
  maxCount: number,
  labelKind: "seconds" | "status" = "seconds",
) {
  const percent = Math.round((bucket.count / maxCount) * 100);
  const label =
    labelKind === "status" || typeof bucket.le === "string"
      ? String(bucket.le)
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
