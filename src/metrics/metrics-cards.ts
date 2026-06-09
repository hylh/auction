import type { MetricsSnapshot } from "../domain/metrics";
import { formatMoney } from "../domain/money";
import type { DatabaseMetrics } from "../server/database-metrics";
import { formatBytes } from "./metrics-format";

export type MetricCard = {
  label: string;
  value: string;
  hint: string;
};

// Maps committed PostgreSQL history and process-lifetime counters into the
// labelled cards shown at the top of the metrics page.
export function buildApplicationCards(
  snapshot: MetricsSnapshot,
  databaseMetrics: DatabaseMetrics,
): Array<MetricCard> {
  return [
    {
      label: "Accepted bids",
      value: databaseMetrics.history.acceptedBids.toLocaleString("en-GB"),
      hint: "All-time committed bids recorded in PostgreSQL, including seeded history.",
    },
    {
      label: "Rejected bids",
      value: databaseMetrics.history.rejectedBids.toLocaleString("en-GB"),
      hint: "All-time business-rule rejections such as stale or insufficient bids.",
    },
    {
      label: "Auctions created",
      value: databaseMetrics.history.auctionsCreated.toLocaleString("en-GB"),
      hint: "All-time auctions recorded in PostgreSQL.",
    },
    {
      label: "Auctions closed",
      value: databaseMetrics.history.auctionsClosed.toLocaleString("en-GB"),
      hint: "All-time closed and unsold auctions.",
    },
    {
      label: "Completed sales",
      value: databaseMetrics.history.salesCompleted.toLocaleString("en-GB"),
      hint: "All-time closed auctions with a winning bid and sale record.",
    },
    {
      label: "Total sale value",
      value: formatMoney(databaseMetrics.history.totalSaleValueCents),
      hint: "All-time cumulative completed sale value.",
    },
    {
      label: "Validation failures",
      value: snapshot.counters.validationFailures.toLocaleString("en-GB"),
      hint: "Zod input validation failures since this server started.",
    },
    {
      label: "Close failures",
      value: snapshot.counters.closeFailures.toLocaleString("en-GB"),
      hint: "Failed close attempts since this server started.",
    },
    {
      label: "Simulator requests",
      value: snapshot.counters.simulatorRequests.toLocaleString("en-GB"),
      hint: "Requests made to the simulator API since this server started.",
    },
  ];
}

// Maps the live database footprint and load-shape readings into cards.
export function buildDatabaseCards(databaseMetrics: DatabaseMetrics): Array<MetricCard> {
  return [
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
}

export type HistogramRange = {
  le: string;
  count: number;
};

// Converts cumulative histogram buckets into per-range counts with friendly
// labels for the latency bar charts.
export function histogramBucketRanges(
  buckets: Array<{ le: number | "+Inf"; count: number }>,
  formatSeconds: (seconds: number) => string,
): Array<HistogramRange> {
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
