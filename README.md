# Fish Auction House

Full-stack TypeScript POC for a fish auction house using TanStack Start, TanStack Router, TanStack Query, PostgreSQL, Drizzle, Zod, SSE, oxlint/oxfmt, and Vitest.

## Local setup

1. Install dependencies with `pnpm install`.
2. Start PostgreSQL with `docker compose up -d`.
3. Copy `.env.example` to `.env` if you want to customize `DATABASE_URL`.
4. Run `pnpm db:migrate`.
5. Run `pnpm db:seed`.
6. Start the app with `pnpm dev`.
7. Scrape local metrics from `http://localhost:3000/metrics`.

Routes:

- `/` live operational dashboard.
- `/auctions/$auctionId` live bid detail with SSE updates.
- `/inventory/new` fish inventory form.
- `/admin` history/admin/statistics dashboard.
- `/metrics` Prometheus-style metrics endpoint.

## Scripts

| Script                                                                | Purpose                                                          |
| --------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `pnpm dev`                                                            | Run the TanStack Start app                                       |
| `pnpm build`                                                          | Build the app                                                    |
| `pnpm lint`                                                           | Run oxlint                                                       |
| `pnpm format`                                                         | Format with oxfmt                                                |
| `pnpm format:check`                                                   | Check formatting                                                 |
| `pnpm test`                                                           | Run Vitest                                                       |
| `pnpm db:generate`                                                    | Generate Drizzle migrations                                      |
| `pnpm db:migrate`                                                     | Apply migrations                                                 |
| `pnpm db:seed`                                                        | Seed deterministic demo users, fish, auctions, bids, and sales   |
| `pnpm db:studio`                                                      | Open Drizzle Studio                                              |
| `pnpm simulate -- --auction-count 2 --bid-count 5 --interval-ms 1000` | Create demo auctions, bid, close them, and report metrics deltas |

## Observability

The `/metrics` route exposes Prometheus text metrics for accepted/rejected bids, auction and sale lifecycle counters, validation and close failures, simulator requests, request latency buckets, and bid mutation duration buckets.

OpenTelemetry spans are emitted with the `fish-auction` tracer around bid mutations. Configure your Node OpenTelemetry provider/exporter with standard environment variables such as `OTEL_SERVICE_NAME`, `OTEL_EXPORTER_OTLP_ENDPOINT`, and `OTEL_TRACES_EXPORTER` when running the app under an SDK-enabled runtime.

## Simulator

Run `pnpm simulate` against a running app to create fish inventory and auctions through the same service path as the UI, place accepted and intentionally rejected bids, close the created auctions, and print metrics deltas. Useful options are `--auction-count`, `--bid-count`, `--interval-ms`, `--duration-minutes`, `--rejection-rate`, `--buyer-mix all|oslo|bergen`, `--seed`, and `--no-close`.
