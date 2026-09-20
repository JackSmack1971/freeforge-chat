---
name: vertical-slice
description: Plan or implement one end-to-end user-visible slice across interface, API or service logic, persistence, and verification. Use when work is getting split into disconnected frontend, backend, or schema layers.
compatibility: Requires a repository or system boundary map and a concrete user action.
---

# Vertical Slice

Follow one user action through the real system path instead of completing
technical layers in isolation.

## Workflow

1. Name the user action and its observable success condition.
2. Trace the smallest path from entry point through domain logic and storage
   to the returned/rendered result.
3. Identify only the contracts and schema changes needed for that path.
4. Implement or plan the slice in dependency order, keeping stubs explicit.
5. Verify the success path and its most important failure path end to end.

## Output

Provide a slice map, changed boundaries, acceptance checks, and explicit
follow-up slices. If implementing, leave the repository in a runnable state.

## Boundary

Do not build whole schemas, APIs, or UI layers ahead of the user value they
serve. Escalate cross-cutting requirements that genuinely cannot fit one slice.
