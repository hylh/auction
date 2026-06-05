---
name: planning
description: Plan new features, refactors, and multi-step changes for the auction project using vertical slices and parallelism. Use when the user asks to plan work, design a feature, break down a task, or says "plan this".
---

# Planning New Work

Always shape plans to maximise vertical slicing and parallelism.

## Slicing rules

- **Vertical over horizontal.** Each slice cuts through the full stack (schema → server function → API/SSE → UI → tests) and delivers an independently shippable, end-to-end-verifiable increment. Horizontal layers that only make sense once everything else lands are a last resort.
- **Parallelise phases.** Keep any truly serial prerequisite (shared schema, shared types, shared CSS foundation) as small as possible, land it first, then fan out into independent slices.
- **Disjoint file ownership.** Give each slice a clear file-ownership boundary so multiple developers or sub-agents can work concurrently with minimal merge conflicts. When a shared file must be touched (e.g. `styles.css`), have each slice append to its own clearly labelled section.
- **Explicit dependencies.** Call out which items block which so anything not blocked can start immediately.
- **Many small slices.** Prefer many small, independent, parallelisable slices over one large sequential plan, as long as each still delivers coherent end-to-end value.

## Output format

1. List any serial prerequisites first (phase 0).
2. List parallel slices as a table: Slice | Files owned | Blocks / blocked-by.
3. For each slice, state the acceptance criteria (what does "done" look like end-to-end?).
