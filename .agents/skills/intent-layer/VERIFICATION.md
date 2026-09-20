# Verification

- Migrated from `.claude/skills/intent-layer/` without modifying the source.
- Replaced three POSIX shell helpers with `scripts/intent_tools.py` subcommands.
- Open Agent frontmatter validated with `quick_validate.py`.
- Windows smoke checks run for `detect-state` and `estimate`.

## Remaining unknown

Repository-specific intent generation is not exercised beyond the read-only local scan.
