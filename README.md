# Fish Auction House

Full-stack TypeScript POC for a fish auction house using TanStack Start, TanStack Router, TanStack Query, PostgreSQL, Drizzle, Zod, SSE, oxlint/oxfmt, and Vitest.

## Local setup

1. Install dependencies with `pnpm install`.
2. Start PostgreSQL with `docker compose up -d`.
3. Copy `.env.example` to `.env` if you want to customize `DATABASE_URL`.
4. Run `pnpm db:migrate`.
5. Run `pnpm db:seed`.
6. Start the app with `pnpm dev`.
7. Open the visual metrics page at `http://localhost:3015/metrics` or scrape Prometheus text from `http://localhost:3015/metrics?format=prometheus`.

Routes:

- `/` live operational dashboard.
- `/auctions/$auctionId` live bid detail with SSE updates.
- `/inventory/new` fish inventory form.
- `/admin` history/admin/statistics dashboard.
- `/metrics` visual metrics dashboard with Prometheus-style text available via `?format=prometheus`.

## Scripts

| Script                              | Purpose                                                                        |
| ----------------------------------- | ------------------------------------------------------------------------------ |
| `pnpm dev`                          | Run the TanStack Start app                                                     |
| `pnpm build`                        | Build the app                                                                  |
| `pnpm lint`                         | Run oxlint                                                                     |
| `pnpm format`                       | Format with oxfmt                                                              |
| `pnpm format:check`                 | Check formatting                                                               |
| `pnpm test`                         | Run Vitest                                                                     |
| `pnpm db:generate`                  | Generate Drizzle migrations                                                    |
| `pnpm db:migrate`                   | Apply migrations                                                               |
| `pnpm db:seed`                      | Seed deterministic demo users, fish, auctions, bids, and sales                 |
| `pnpm db:studio`                    | Open Drizzle Studio                                                            |
| `pnpm simulate -- --run-seconds 60` | Run load: create an auction every 10s, bid every 1s, and report metrics deltas |

## Observability

The `/metrics` route shows a visual dashboard for accepted/rejected bids, auction and sale lifecycle counters, validation and close failures, simulator requests, request latency buckets, p99 latency, and bid mutation duration buckets. It also shows database scaling signals: database size, table row counts and table/index sizes, connection counts, active auctions, bids per minute, auctions per minute, bid concentration on the hottest active auction, and newest bid age. Postgres session counts include the current metrics scrape, which is collected on one database connection; app DB sessions are separately tagged with the `auction-app` application name so local tools and old dev pools are distinguishable. Scrapers can request `Accept: text/plain` or use `/metrics?format=prometheus` for Prometheus text.

OpenTelemetry spans are emitted with the `fish-auction` tracer around bid mutations. Configure your Node OpenTelemetry provider/exporter with standard environment variables such as `OTEL_SERVICE_NAME`, `OTEL_EXPORTER_OTLP_ENDPOINT`, and `OTEL_TRACES_EXPORTER` when running the app under an SDK-enabled runtime.

## Simulator

Run `pnpm simulate` against a running app to create fish inventory and auctions through the same service path as the UI, place accepted and intentionally rejected bids, and print metrics deltas. By default it runs for 60 seconds, creates one new fish and auction every 10 seconds, and submits one bid every second. Useful options are `--run-seconds`, `--auction-interval-ms`, `--bid-interval-ms`, `--auction-count`, `--bid-count`, `--duration-minutes`, `--rejection-rate`, `--buyer-mix all|oslo|bergen`, `--seed`, and `--close`. Bid pacing happens in the CLI so each simulator API request remains a short single-step operation for the request-latency SLO.
