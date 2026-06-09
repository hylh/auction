# Prior knowledge & starting point established

The user authored this codebase via AI and already understands the architectural
decisions (per `documentation/auction-project-decisions.html`). They are comfortable with
TypeScript, React, TanStack Query, Docker Compose, and observability/metrics, so those
need not be taught from first principles.

They did **not** claim comfort with TanStack Start, TanStack Router, Drizzle ORM, Zod,
or Server-Sent Events — these are the highest-value targets for orientation lessons.

Goal/depth: orientation for a review/architect role — be able to navigate the real code
and explain each part, rather than build features. This sets the zone of proximal
development: tours of real files that connect known architecture to concrete code, weighted
toward the unfamiliar stack pieces.
