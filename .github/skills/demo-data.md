---
name: demo-data
description: Add or modify seed data and the auction simulator for the auction project. Use when the user asks about seed data, demo users, the simulator, seeding the database, or running simulated auctions.
---

# Demo Data & Simulator

## Seed data — `src/scripts/seed.ts`

Run with `pnpm db:seed`. Inserts deterministic demo data via the ORM (not raw SQL):

- **Demo users** — defined in `src/domain/constants.ts` as `DEMO_USERS`. Roles: `seller`, `buyer`, `admin`.
- **Fish items** — one or more items per species across the MVP list (salmon, cod, tuna, halibut, mackerel, trout, herring), covering every inventory status (`draft`, `listed`, `in_auction`, `sold`, `withdrawn`), including a fish that walks the full `draft → listed → in_auction → sold` lifecycle.
- **Auctions** — mix of active, closed/sold, and unsold to exercise all dashboard states.
- **Bids and sales** — deterministic multi-round escalating bids (~32 in the default scenario) so statistics are meaningful (species rankings, average bid, total sales). Closed-auction sales reference the actual highest seeded bid.

Seed is idempotent: re-running it should not duplicate records (use upsert or truncate-then-insert).

### Scenario profiles

Choose a scenario with `--scenario <name>` or the `SEED_SCENARIO` env var (defaults to `default`):

| Scenario        | Purpose                                                              |
| --------------- | ------------------------------------------------------------------- |
| `default`       | Rich, audit-complete dataset covering every status and ~32 bids.    |
| `busy-auction`  | One hot active auction with ~24 competing bids.                     |
| `all-expired`   | Active auctions past their end time (one with bids, one without).   |
| `no-bids`       | Active auctions ending soon with no bids placed yet.                |

```bash
pnpm db:seed --scenario busy-auction
SEED_SCENARIO=no-bids pnpm db:seed
```

The scenario list lives in `src/domain/constants.ts` as `SEED_SCENARIOS`.

## Simulator — `src/scripts/simulate.ts`

Run with `pnpm simulate`. Places bids and creates auctions through the **same server/API path used by the application** — not direct DB inserts — so it exercises validation, persistence, metrics, and SSE updates end-to-end.

### Configuration (all optional, sensible defaults)

| Option            | Default  | Description                                      |
| ----------------- | -------- | ------------------------------------------------ |
| `auctionCount`    | 1        | Auctions to create per run                       |
| `bidCount`        | 1        | Bids placed in the flat (single-pass) bid loop   |
| `bidRounds`       | —        | If set, runs multi-round escalation alternating buyers across all targeted auctions |
| `auctionIds`      | —        | Existing auctions to target (no longer capped at one); CLI flag `--auction-ids` accepts a comma/space list and defaults `auctionCount` to 0 |
| `intervalMs`      | 0        | Delay between bid rounds (CLI load-driver only)  |
| `durationMinutes` | 30       | How long auctions run                            |
| `rejectionRate`   | 0.25     | Fraction of bids intentionally stale             |
| `seed`            | 20260604 | RNG seed for deterministic runs                  |
| `closeAuctions`   | true     | Close auctions at end of run                     |

Shared bid math lives in `src/domain/bid-builder.ts` (`nextMinimumBidCents`, `buildValidBidInput`); the simulator and bid-rules floor calculation both use it. For submission-ready context use `getBidSubmissionContext(auctionId)` from `auction-service`.

### Simulator contract

- Use `simulatorInputSchema` (Zod) to validate input.
- All bids go through `placeBidFn` — never bypass the command layer.
- Log accepted and rejected bids via the structured logger.
- Increment the `simulatorRequests` counter on each run.
