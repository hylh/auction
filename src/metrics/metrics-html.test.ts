import { describe, expect, it } from "vitest";
import type { MetricsSnapshot } from "../domain/metrics";
import type { DatabaseMetrics } from "../server/database-metrics";
import { renderMetricsPage } from "./metrics-html";

const snapshot: MetricsSnapshot = {
  counters: {
    validationFailures: 1,
    closeFailures: 2,
    simulatorRequests: 3,
  },
  histograms: [
    {
      name: "auction_request_latency_seconds",
      help: "Request latency",
      buckets: [
        { le: 0.1, count: 1 },
        { le: 1, count: 2 },
        { le: "+Inf", count: 3 },
      ],
      count: 3,
      sum: 1.25,
      p99Seconds: Number.POSITIVE_INFINITY,
    },
    {
      name: "auction_empty_latency_seconds",
      help: "No samples <yet>",
      buckets: [{ le: "+Inf", count: 0 }],
      count: 0,
      sum: 0,
      p99Seconds: null,
    },
  ],
};

const databaseMetrics: DatabaseMetrics = {
  databaseSizeBytes: 2_048,
  history: {
    acceptedBids: 2,
    rejectedBids: 1,
    auctionsCreated: 4,
    auctionsClosed: 3,
    salesCompleted: 2,
    totalSaleValueCents: 123_45,
  },
  connections: {
    applicationName: "auction-test",
    total: 4,
    active: 1,
    idle: 3,
    appTotal: 2,
    appActive: 1,
    appIdle: 1,
  },
  tables: [
    {
      tableName: "fish_<items>",
      rowCount: 10,
      totalBytes: 2_048,
      heapBytes: 1_024,
      indexBytes: 1_024,
    },
  ],
  auctionStatuses: [{ status: "active", count: 2 }],
  inventoryStatuses: [],
  load: {
    activeAuctions: 2,
    bidsLastMinute: 1,
    bidsLastFiveMinutes: 3,
    auctionsCreatedLastMinute: 0,
    averageBidsPerActiveAuction: 1.5,
    hottestAuctionBidCount: 3,
    newestBidAgeSeconds: null,
  },
};

describe("renderMetricsPage", () => {
  it("renders escaped database, histogram, status, and empty-state metrics", () => {
    const html = renderMetricsPage(snapshot, databaseMetrics, "light");

    expect(html).toContain('data-theme="light"');
    expect(html).toContain("fish_&lt;items&gt;");
    expect(html).toContain("&lt;= 100 ms");
    expect(html).toContain("&gt; 10 s");
    expect(html).toContain("no samples");
    expect(html).toContain("No rows yet.");
  });
});
