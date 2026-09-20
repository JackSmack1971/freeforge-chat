# last30days/scripts/lib

## Purpose

Owns shared Python modules for providers, ranking, dedupe, rendering, and output shaping. It does not own CLI parsing or shell orchestration.

## Contracts & Invariants

- Keep modules small and composable.
- Preserve shared data contracts across providers and renderers.
- Keep any output-shape changes aligned with `references/output.md`.

## Patterns

- Put provider-specific behavior in the matching module.
- Add normalization or ranking logic here only when multiple callers need it.

## Anti-patterns

- Do not import CLI parsing or shell orchestration here.
- Do not duplicate provider adapters across modules.
