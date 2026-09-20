# last30days/scripts

## Purpose

Owns executable pipeline scripts and thin wrappers. Shared logic belongs in `lib/`.

## Entry Points

- `last30days.py` - main research runner.
- `briefing.py` - briefing construction.
- `verify_v3.py` - validation helper.

## Contracts & Invariants

- Keep the main runner as the canonical path.
- Put reusable code in `lib/`, not in duplicate script-local copies.
- Keep Python entry points explicit and predictable.

## Patterns

- Add new orchestration in the runner, then factor shared logic down into `lib/`.
- Keep validation helpers close to the scripts they exercise.

## Anti-patterns

- Do not duplicate provider-specific logic across top-level scripts.
- Do not widen the CLI surface without updating the workflow docs.
