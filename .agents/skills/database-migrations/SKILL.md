---
name: database-migrations
description: Plan, implement, or review safe changes to persistent database schemas and data, including forward migrations, backfills, compatibility windows, verification, and rollback. Use when adding, changing, renaming, or removing stored data.
compatibility: Requires the repository's migration tooling and a documented current schema when available.
---

# Database Migrations

Treat persistent data changes as deployment work. Preserve compatibility while
old and new application versions may overlap.

## Workflow

1. Inspect the current schema, migration history, application reads/writes, and
   deployment order.
2. Define the target state and classify the change as additive, backfill,
   rewrite, rename, constraint, or destructive.
3. Use expand/contract sequencing when compatibility requires it: add, deploy
   compatible code, backfill safely, verify, then contract.
4. Define batching, locks, transaction limits, idempotency, observability, and
   failure handling for data work.
5. State verification queries/checks, rollback or forward-fix strategy, and
   backup assumptions before applying anything.

## Boundary

Never run a destructive migration or production backfill without explicit
approval and a verified target. Do not promise rollback when data transformation
is irreversible; describe the recovery path instead.
