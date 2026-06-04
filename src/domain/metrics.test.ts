import { beforeEach, describe, expect, it } from "vitest";
import {
  incrementMetric,
  metricsText,
  observeBidMutationDuration,
  observeRequestLatency,
  resetMetrics,
} from "./metrics";

describe("metrics", () => {
  beforeEach(() => resetMetrics());

  it("renders requested counters", () => {
    incrementMetric("validationFailures");
    incrementMetric("closeFailures", 2);
    incrementMetric("simulatorRequests", 3);

    const text = metricsText();

    expect(text).toContain("auction_validation_failures_total 1");
    expect(text).toContain("auction_close_failures_total 2");
    expect(text).toContain("auction_simulator_requests_total 3");
  });

  it("renders cumulative histogram buckets without retaining raw samples", () => {
    observeBidMutationDuration(4);
    observeBidMutationDuration(100);
    observeRequestLatency(10);

    const text = metricsText();

    expect(text).toContain("# TYPE auction_bid_mutation_duration_seconds histogram");
    expect(text).toContain('auction_bid_mutation_duration_seconds_bucket{le="0.005"} 1');
    expect(text).toContain('auction_bid_mutation_duration_seconds_bucket{le="0.1"} 2');
    expect(text).toContain('auction_bid_mutation_duration_seconds_bucket{le="0.3"} 2');
    expect(text).toContain('auction_bid_mutation_duration_seconds_bucket{le="+Inf"} 2');
    expect(text).toContain("auction_bid_mutation_duration_seconds_count 2");
    expect(text).toContain("auction_request_latency_seconds_count 1");
  });
});
