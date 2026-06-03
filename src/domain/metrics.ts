type MetricName =
  | "acceptedBids"
  | "rejectedBids"
  | "auctionsCreated"
  | "auctionsClosed"
  | "salesCompleted"
  | "totalSaleValueCents";

const counters: Record<MetricName, number> = {
  acceptedBids: 0,
  rejectedBids: 0,
  auctionsCreated: 0,
  auctionsClosed: 0,
  salesCompleted: 0,
  totalSaleValueCents: 0,
};

const bidMutationDurationsMs: Array<number> = [];
const requestLatenciesMs: Array<number> = [];

export function incrementMetric(name: MetricName, amount = 1) {
  counters[name] += amount;
}

export function observeBidMutationDuration(ms: number) {
  bidMutationDurationsMs.push(ms);
}

export function observeRequestLatency(ms: number) {
  requestLatenciesMs.push(ms);
}

export function measureRequest<T>(operation: () => Promise<T>) {
  const started = performance.now();
  return operation().finally(() => observeRequestLatency(performance.now() - started));
}

export function metricsText() {
  return [
    "# HELP auction_accepted_bids_total Accepted bid count",
    "# TYPE auction_accepted_bids_total counter",
    `auction_accepted_bids_total ${counters.acceptedBids}`,
    "# HELP auction_rejected_bids_total Rejected bid count",
    "# TYPE auction_rejected_bids_total counter",
    `auction_rejected_bids_total ${counters.rejectedBids}`,
    "# HELP auction_auctions_created_total Created auction count",
    "# TYPE auction_auctions_created_total counter",
    `auction_auctions_created_total ${counters.auctionsCreated}`,
    "# HELP auction_auctions_closed_total Closed auction count",
    "# TYPE auction_auctions_closed_total counter",
    `auction_auctions_closed_total ${counters.auctionsClosed}`,
    "# HELP auction_sales_completed_total Completed sale count",
    "# TYPE auction_sales_completed_total counter",
    `auction_sales_completed_total ${counters.salesCompleted}`,
    "# HELP auction_total_sale_value_cents Total completed sale value in cents",
    "# TYPE auction_total_sale_value_cents counter",
    `auction_total_sale_value_cents ${counters.totalSaleValueCents}`,
    "# HELP auction_bid_mutation_duration_ms_last Last bid mutation duration in milliseconds",
    "# TYPE auction_bid_mutation_duration_ms_last gauge",
    `auction_bid_mutation_duration_ms_last ${last(bidMutationDurationsMs)}`,
    "# HELP auction_request_latency_ms_last Last request latency in milliseconds",
    "# TYPE auction_request_latency_ms_last gauge",
    `auction_request_latency_ms_last ${last(requestLatenciesMs)}`,
    "",
  ].join("\n");
}

function last(values: Array<number>) {
  return values.length === 0 ? 0 : values[values.length - 1];
}
