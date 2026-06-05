---
name: observability
description: Add or extend observability in the auction project: OpenTelemetry instrumentation, structured logging, and the Prometheus-style metrics endpoint. Use when the user asks about metrics, logging, tracing, instrumentation, or the /metrics route.
---

# Observability

## Stack

- **OpenTelemetry** — instrumentation via `@opentelemetry/api`.
- **Structured server logging** — JSON log lines emitted to stdout.
- **Prometheus-style metrics endpoint** — `/metrics` route, human-readable and scrapeable.

## Required counters and histograms

| Metric                   | Type      |
| ------------------------ | --------- |
| Accepted bids            | Counter   |
| Rejected bids            | Counter   |
| Auctions created         | Counter   |
| Auctions closed          | Counter   |
| Sales completed          | Counter   |
| Total sale value (cents) | Counter   |
| Request latency          | Histogram |
| Bid mutation duration    | Histogram |

## Where things live

- Metric counters: `src/server/metrics.ts` (in-process singleton).
- Metrics route: `src/routes/metrics.ts` — renders counters + histograms as HTML with embedded Prometheus text.
- Structured logs: emitted inline in command handlers (`src/server/auction-commands.ts`) using the shared logger.

## Adding a new metric

1. Add the counter/histogram field to the `MetricsSnapshot` type in `src/server/metrics.ts`.
2. Increment it at the relevant command or query site.
3. Add a row to the metrics route renderer.
4. Add a unit test asserting the counter increments on the happy path.

## Log format

Each log line is a JSON object: `{ level, message, ...contextFields }`. Use `"info"` for domain events and `"warn"` for rejected bids and recoverable errors.
