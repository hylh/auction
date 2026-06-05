import { renderPrometheusText, type MetricFamily } from "./metric-exposition";

type MetricName = "validationFailures" | "closeFailures" | "simulatorRequests";

export type MetricsSnapshot = {
  counters: Record<MetricName, number>;
  histograms: Array<{
    name: string;
    help: string;
    buckets: Array<{
      le: number | "+Inf";
      count: number;
    }>;
    p99Seconds: number | null;
    sum: number;
    count: number;
  }>;
};

const counters: Record<MetricName, number> = {
  validationFailures: 0,
  closeFailures: 0,
  simulatorRequests: 0,
};

const durationBucketsSeconds = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.3, 0.5, 1, 2.5, 5, 10];

type Histogram = {
  buckets: Array<number>;
  counts: Array<number>;
  sum: number;
  count: number;
};

const bidMutationDuration = createHistogram(durationBucketsSeconds);
const requestLatency = createHistogram(durationBucketsSeconds);

export function incrementMetric(name: MetricName, amount = 1) {
  counters[name] += amount;
}

export function observeBidMutationDuration(ms: number) {
  observeHistogram(bidMutationDuration, ms / 1000);
}

export function observeRequestLatency(ms: number) {
  observeHistogram(requestLatency, ms / 1000);
}

export async function measureRequest<T>(operation: () => Promise<T>) {
  const started = performance.now();
  try {
    return await operation();
  } finally {
    observeRequestLatency(performance.now() - started);
  }
}

export function metricsText() {
  return renderPrometheusText(metricsFamilies());
}

function metricsFamilies(): Array<MetricFamily> {
  return [
    counterFamily(
      "auction_validation_failures_total",
      "Zod validation failure count",
      counters.validationFailures,
    ),
    counterFamily(
      "auction_close_failures_total",
      "Auction close failure count",
      counters.closeFailures,
    ),
    counterFamily(
      "auction_simulator_requests_total",
      "Simulator API request count",
      counters.simulatorRequests,
    ),
    histogramFamily(
      "auction_bid_mutation_duration_seconds",
      "Bid mutation duration in seconds",
      bidMutationDuration,
    ),
    histogramFamily(
      "auction_request_latency_seconds",
      "Server function and API request latency in seconds",
      requestLatency,
    ),
  ];
}

export function metricsSnapshot(): MetricsSnapshot {
  return {
    counters: { ...counters },
    histograms: [
      histogramSnapshot(
        "auction_bid_mutation_duration_seconds",
        "Bid mutation duration in seconds",
        bidMutationDuration,
      ),
      histogramSnapshot(
        "auction_request_latency_seconds",
        "Server function and API request latency in seconds",
        requestLatency,
      ),
    ],
  };
}

export function resetMetrics() {
  for (const name of Object.keys(counters) as Array<MetricName>) {
    counters[name] = 0;
  }
  resetHistogram(bidMutationDuration);
  resetHistogram(requestLatency);
}

function histogramSnapshot(name: string, help: string, histogram: Histogram) {
  return {
    name,
    help,
    buckets: [
      ...histogram.buckets.map((bucket, index) => ({
        le: bucket,
        count: histogram.counts[index],
      })),
      {
        le: "+Inf" as const,
        count: histogram.count,
      },
    ],
    p99Seconds: percentileUpperBound(histogram, 0.99),
    sum: histogram.sum,
    count: histogram.count,
  };
}

function createHistogram(buckets: Array<number>): Histogram {
  return {
    buckets,
    counts: Array.from({ length: buckets.length }, () => 0),
    sum: 0,
    count: 0,
  };
}

function observeHistogram(histogram: Histogram, value: number) {
  histogram.sum += value;
  histogram.count += 1;

  for (let index = 0; index < histogram.buckets.length; index += 1) {
    if (value <= histogram.buckets[index]) {
      histogram.counts[index] += 1;
    }
  }
}

function resetHistogram(histogram: Histogram) {
  histogram.counts.fill(0);
  histogram.sum = 0;
  histogram.count = 0;
}

function percentileUpperBound(histogram: Histogram, percentile: number) {
  if (histogram.count === 0) {
    return null;
  }

  const target = Math.ceil(histogram.count * percentile);
  const bucketIndex = histogram.counts.findIndex((count) => count >= target);
  return bucketIndex === -1 ? Number.POSITIVE_INFINITY : histogram.buckets[bucketIndex];
}

function counterFamily(name: string, help: string, value: number): MetricFamily {
  return {
    name,
    help,
    type: "counter",
    samples: [{ value }],
  };
}

function histogramFamily(name: string, help: string, histogram: Histogram): MetricFamily {
  return {
    name,
    help,
    type: "histogram",
    buckets: [
      ...histogram.buckets.map((bucket, index) => ({
        le: bucket,
        count: histogram.counts[index],
      })),
      {
        le: "+Inf" as const,
        count: histogram.count,
      },
    ],
    sum: histogram.sum,
    count: histogram.count,
  };
}
