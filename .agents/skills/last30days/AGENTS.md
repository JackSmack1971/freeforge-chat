# last30days

## Purpose

Owns the last-30-days public-signal research workflow and its shareable HTML briefing output. It does not own downstream consumers or unrelated data collection.

## Entry Points

- `scripts/last30days.py` - canonical research pipeline.
- `scripts/briefing.py` - briefing assembly helpers.
- `references/workflow.md` - invocation order and preflight rules.
- `references/output.md` - report shape, citation rules, and footer requirements.
- `references/save-html-brief.md` - HTML export path when requested.

## Contracts & Invariants

- Always run `scripts/last30days.py` for actual research.
- Do not answer from WebSearch alone.
- Keep citations and the final footer aligned with `references/output.md`.
- Treat provider and environment setup as optional inputs, not hard requirements.

## Patterns

- Add shared research behavior in `scripts/lib/`, not in the root runner.
- Keep the trigger surface thin and the pipeline as the single canonical path.

## Anti-patterns

- Do not bypass the pipeline to answer directly.
- Do not place generated artifacts in the skill root.
