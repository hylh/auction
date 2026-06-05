---
name: testing
description: Write and extend Vitest tests for the auction project: domain unit tests, server integration tests, and SSE broadcaster tests. Use when the user asks to add tests, write test cases, improve coverage, or debug a failing test.
---

# Testing

## Stack

Vitest

## Test layers

### Unit — `src/domain/*.test.ts`

Cover pure domain rules with no I/O:

- Money: `centsFromMajor` rejects decimals, formats correctly.
- Weight: `gramsFromKilograms` round-trips.
- Bid rules: increment enforcement, stale bid rejection, seller-own-auction, auction-not-active, invalid amount.
- Auction state transitions: valid and invalid status moves.
- Permission rules: buyer/seller/admin role checks.

### Integration — `src/server/*.integration.test.ts`

Test server functions and commands against a real PostgreSQL instance (Docker Compose must be running):

- Fish item creation persists with correct field mapping.
- Bid placement is transactional: concurrent stale bids are rejected, accepted bids are persisted in order.
- Auction close transitions inventory status correctly.
- Admin commands require admin role.

### SSE / broadcaster — `src/server/events.test.ts` or similar

- Multiple subscribers receive the same ordered `bid.accepted` event after a bid is accepted.
- `bid.rejected` is only sent to the acting subscriber.
- `auction.closed` and `sale.completed` are broadcast to all subscribers.

## Conventions

- Use `describe` blocks that match the module name.
- Keep test data inline — no shared fixtures files unless reuse is high.
- Integration tests that need the database should skip cleanly if `DATABASE_URL` is not set.
- Assert the shape of returned objects, not just that they don't throw.
