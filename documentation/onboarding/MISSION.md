# Mission: Understand the Fish Auction House codebase

## Why
The user built this entire project using AI and now wants to genuinely understand
the code they own — to read it, navigate it confidently, and review/architect it
without relying on AI to explain each file from scratch.

## Success looks like
- Can trace any user action (e.g. placing a bid) end-to-end through the real files.
- Can open any folder in `src/` and explain what it is responsible for and why it exists.
- Comfortable reading the less-familiar parts: TanStack Start/Router, Drizzle ORM, Zod, and SSE.
- Can answer "where would I change X?" for a given feature without searching blindly.

## Constraints
- Depth target: **orientation** — enough to navigate and review, not necessarily to write every feature.
- Role: **review / architect**, not day-to-day feature work (for now).
- Already comfortable with: TypeScript, React, TanStack Query, Docker Compose, observability/metrics.
- Already knows the architectural decisions (see `documentation/auction-project-decisions.html`).
- Lessons should be grounded in the *actual* code, with citations to real files and line numbers.

## Out of scope
- Production authentication (project uses seeded demo users).
- Deep TanStack Start internals beyond what's needed to read this app.
- Rewriting or refactoring — this is about reading and understanding, not changing.
