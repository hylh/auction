# Copilot instructions for the auction project

This repository is a greenfield fullstack TypeScript showcase for a fish auction house. Build it as a production-minded demo: clear domain modeling, type-safe client/server boundaries, real-time bid updates, observability, repeatable local setup, and tests for the important business rules.

For a fuller decision log, see `documentation/auction-project-decisions.html`.

All documentation must be written as HTML files in the `documentation/` directory. Do not add documentation as Markdown or other formats.

## Product goal

Create an auction house where users can list fish inventory, run auctions, place bids, complete sales, and inspect live and historical auction activity.

Core product surfaces:

- A live operational dashboard for active auctions, latest bids, recent sales, and inventory requiring action.
- An auction detail page with live bid history.
- A form for adding fish inventory.
- A history/admin dashboard for completed and unsold auctions, sale records, bid history, inventory status changes, admin actions, and statistics.
- A metrics endpoint for application and domain metrics.

Fish is the domain. The UI should speak in kilograms, species, catch region, freshness/grade, sellers, buyers, bids, auctions, and sales.

## Required stack

- Use TanStack Start as the application base.
- Use TanStack Router, TanStack CLI, and TanStack Query.
- Use pnpm for package management.
- Use PostgreSQL for persistence.
- Use Drizzle ORM and Drizzle Kit for schema, migrations, and database tooling.
- Use Zod for shared validation between server functions, API handlers, and UI forms.
- Use Server-Sent Events for real-time auction updates.
- Use oxlint and oxfmt for linting and formatting, configured according to TanStack recommendations.
- Use Vitest for unit and integration tests.
- Do not add Playwright for now.

## Local development expectations

- Use Docker Compose for PostgreSQL.
- Run the app and project scripts with pnpm.
- Provide scripts for database generation, migration, seeding, and Drizzle Studio, such as `db:generate`, `db:migrate`, `db:seed`, and `db:studio`.
- Provide required validation scripts for linting, formatting checks, and tests.
- Keep setup repeatable for a fresh clone.

## Domain model decisions

Separate fish inventory from auction lifecycle:

- `fish_items` represents inventory.
- `auctions` represents auction state and timing.
- `bids` represents accepted bid history.
- `sales` represents completed auction outcomes.
- Users are seeded demo users for now, not full production authentication.

Fish inventory should include:

- Species.
- Display name.
- Weight entered/displayed in kilograms and stored as integer grams.
- Catch region.
- Freshness or grade.
- Starting price.
- Seller.
- Optional description.
- Optional external image URL.

Use a curated MVP species list so statistics group cleanly: salmon, cod, tuna, halibut, mackerel, trout, and herring.

Store monetary values as integer cents with one configured currency. Do not use JavaScript floating-point numbers for persisted money.

Inventory statuses:

- `draft`
- `listed`
- `in_auction`
- `sold`
- `withdrawn`

Auction records should not be hard-deleted in the MVP. Preserve history for admin review and statistics.

## Auction behavior

Use ascending English auctions.

Rules:

- Each auction has `startsAt` and `endsAt`.
- Only active auctions accept bids.
- Each accepted bid must be higher than the current highest bid by at least the configured minimum increment.
- Sellers cannot bid on their own auctions.
- Buyers can bid on other sellers' active auctions.
- Admins can view all records and close or withdraw auctions/items.
- Auctions can close manually or when their end time has passed.
- The highest valid bid becomes the completed sale.
- Auctions with no bids close as unsold.

Bid writes must be transactional. Reject stale bids based on the committed current highest bid, persist accepted bids in order, and broadcast real-time events only after the transaction commits.

Return explicit typed bid errors for:

- Stale bid.
- Auction not active.
- Seller bidding on their own auction.
- Insufficient increment.
- Invalid amount.

Do not silently swallow invalid bid attempts or hide them behind a generic refresh.

## Real-time updates

Use Server-Sent Events per auction for live updates. "The chain" means the visible real-time bid history, not blockchain.

Use typed auction events, including:

- `bid.accepted`
- `bid.rejected` for the acting user only
- `auction.closed`
- `sale.completed`

Accepted bid event payloads should include the auction id, bid id, amount in cents, bidder display name, timestamp, and current highest-bid snapshot.

On the client:

- Patch the TanStack Query cache for the auction detail bid list/highest bid immediately from accepted bid events.
- Invalidate aggregate dashboard and statistics queries instead of trying to manually recompute every aggregate in the browser.

## Data access pattern

Prefer TanStack Start server functions for core queries and mutations. Use TanStack Query for client-side caching and invalidation.

Keep direct HTTP endpoints focused on cases that need them, especially SSE streaming and simulator access.

Do not duplicate validation logic between client and server. Share Zod schemas for fish input, auction timing, bid amounts, bid increments, and sale completion rules.

## Dashboards and routes

Recommended route structure:

- `/` - live operational dashboard.
- `/auctions/$auctionId` - auction detail page with live bids.
- `/inventory/new` - add fish inventory.
- `/admin` - history/admin/statistics dashboard.
- `/metrics` - scrapeable metrics endpoint.

The live dashboard should focus on what is happening now: active auctions, latest bids, recent completed sales, and inventory needing action.

The admin dashboard should focus on audit, history, management, and statistics: completed auctions, unsold auctions, sale records, bid history, inventory status changes, admin actions, total sales, average bid price, and popular fish species.

Statistics should be computed with live PostgreSQL aggregate queries and appropriate indexes. Do not introduce a separate analytics store or materialized views unless a later requirement justifies them.

Definitions:

- Total sales: aggregate completed sale value from winning bids.
- Average bid price: average accepted bid amount.
- Most popular fish: rank species by bid count, while also showing total kilograms sold and total sales value.
