# Notes & Preferences

- Workspace lives in `documentation/onboarding/` (repo rule: all docs are HTML in `documentation/`,
  except these workspace bookkeeping `.md` files which are teaching-skill state).
- Lessons and reference docs **must be HTML** and should print/read beautifully.
- User built the app with AI; treat them as someone who recognizes the shape but hasn't
  internalized the code. Don't over-explain TypeScript/React/TanStack Query basics.
- Less familiar (teach more here): TanStack Start, TanStack Router, Drizzle ORM, Zod, SSE, raw SQL.
- Ground every lesson in real files with citations. Avoid generic framework tutorials.
- Keep chat replies minimal (repo custom instruction). Confirm actions briefly.

## How to open a lesson
From repo root (PowerShell):
`Start-Process .\documentation\onboarding\lessons\0001-the-bid-lifecycle-tour.html`

---

## SESSION STATE (resume here) — last updated 2026-06-09

**Where we are:** 4 lessons delivered (orientation arc). User responds "next" to advance;
lessons are self-paced HTML with built-in quizzes. No quiz scores reported back yet, so no
mastery learning-records written beyond prior-knowledge (LR-0001).

**Lessons delivered:**
| # | File | Topic | Status |
|---|------|-------|--------|
| 01 | lessons/0001-the-bid-lifecycle-tour.html | Life of a bid (end-to-end path) | delivered |
| 02 | lessons/0002-the-map-of-src.html | The six-layer map of src/ | delivered |
| 03 | lessons/0003-the-database-schema.html | Drizzle schema, 8 tables, 4 decisions | delivered |
| 04 | lessons/0004-routing-and-server-functions.html | File routing + server functions | delivered |

**Reference docs:**
- reference/codebase-map-and-glossary.html — file map + glossary + commands (canonical vocab).

**Planned next (syllabus):**
- 05 — Real-time layer up close (event bus, per-user bid.rejected filtering, SSE wire format, patch-vs-invalidate).
- 06 — Admin statistics queries in depth (aggregate SQL: total sales, avg bid, popular species).
- 07 — Seed + simulator scripts (deterministic demo data, load generation).
- 08 — Zod-shared validation (inventory form ↔ server, one schema).
- (optional) Observability/metrics deep dive — user already comfortable here, lower priority.

**To resume:** open progress.html, or just continue from Lesson 05. Re-read MISSION.md first.
Mission = navigate/review the AI-built codebase; depth = orientation; weight unfamiliar stack
(TanStack Start/Router, Drizzle, Zod, SSE, SQL).
