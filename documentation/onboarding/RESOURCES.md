# Resources

Trusted resources to ground lessons. Internal references come first (highest trust —
they ARE the system); external docs back up framework claims.

## Internal (this repo)
- `README.md` — setup, scripts, routes, observability, simulator overview.
- `documentation/auction-project-decisions.html` — the architectural decision log.
- `documentation/bid-flow-visualization.html` — existing visual of the bid flow.
- `documentation/seeded-data-and-bid-creation.html` — how seed data and bids are built.
- `.github/copilot-instructions.md` (custom instructions) — product goal, stack, domain rules.

### Key source files (the "source of truth")
- `src/routes/` — pages + API endpoints (file-based routing).
- `src/server/functions.ts` — TanStack Start server-function boundary.
- `src/server/auction-commands.ts` — write/business logic (createAuction, placeBid, closeAuction...).
- `src/server/auction-queries.ts` / `auction-admin-queries.ts` — read models.
- `src/domain/` — pure domain logic: bid-rules, events (event bus), validation (Zod), money, weight, metrics.
- `src/db/schema.ts` — Drizzle schema (tables, enums, indexes, relations).
- `src/db/client.ts` — Postgres connection + Drizzle client.

## External (framework docs — verify before citing)
- TanStack Start: https://tanstack.com/start/latest
- TanStack Router (file-based routing): https://tanstack.com/router/latest/docs/framework/react/routing/file-based-routing
- TanStack Query: https://tanstack.com/query/latest
- Drizzle ORM: https://orm.drizzle.team/docs/overview
- Drizzle Kit (migrations): https://orm.drizzle.team/docs/kit-overview
- Zod: https://zod.dev
- MDN — Server-Sent Events / EventSource: https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events
- PostgreSQL `SELECT ... FOR UPDATE` (row locks): https://www.postgresql.org/docs/current/explicit-locking.html#LOCKING-ROWS

## Communities (for wisdom / real-world questions)
- TanStack Discord: https://tlinz.com/discord
- r/PostgreSQL: https://www.reddit.com/r/PostgreSQL/
- Drizzle Discord (linked from https://orm.drizzle.team).
