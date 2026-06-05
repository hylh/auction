---
name: demo-data
description: Add or modify seed data and the auction simulator for the auction project. Use when the user asks about seed data, demo users, the simulator, seeding the database, or running simulated auctions.
---

# Demo Data & Simulator

## Seed data — `src/scripts/seed.ts`

Run with `pnpm db:seed`. Inserts deterministic demo data via the ORM (not raw SQL):

- **Demo users** — defined in `src/domain/constants.ts` as `DEMO_USERS`. Roles: `seller`, `buyer`, `admin`.
- **Fish items** — one or more items per species across the MVP list (salmon, cod, tuna, halibut, mackerel, trout, herring).
- **Auctions** — mix of active, closed/sold, and unsold to exercise all dashboard states.
- **Bids and sales** — enough history for statistics to be meaningful (species rankings, average bid, total sales).

Seed is idempotent: re-running it should not duplicate records (use upsert or truncate-then-insert).

## Simulator — `src/scripts/simulate.ts`

Run with `pnpm simulate`. Places bids and creates auctions through the **same server/API path used by the application** — not direct DB inserts — so it exercises validation, persistence, metrics, and SSE updates end-to-end.

### Configuration (all optional, sensible defaults)

| Option            | Default  | Description                          |
| ----------------- | -------- | ------------------------------------ |
| `auctionCount`    | 1        | Auctions to create per run           |
| `bidCount`        | 1        | Bids per auction per cycle           |
| `intervalMs`      | 0        | Delay between bid rounds             |
| `durationMinutes` | 30       | How long auctions run                |
| `rejectionRate`   | 0.25     | Fraction of bids intentionally stale |
| `seed`            | 20260604 | RNG seed for deterministic runs      |
| `closeAuctions`   | true     | Close auctions at end of run         |

### Simulator contract

- Use `simulatorInputSchema` (Zod) to validate input.
- All bids go through `placeBidFn` — never bypass the command layer.
- Log accepted and rejected bids via the structured logger.
- Increment the `simulatorRequests` counter on each run.
