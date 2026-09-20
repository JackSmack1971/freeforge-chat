# Verification

- Migrated from `.claude/skills/last30days/` without modifying the source.
- Removed source-only shell/keychain helpers from the target package.
- Updated runtime paths and manifest lookup for Codex/Open Agent installs.
- Source media and the distribution archive are retained as unreferenced assets; the Codex runner does not load them.
- Open Agent frontmatter validated with `quick_validate.py`.
- Windows smoke check: `python scripts/last30days.py --help`.

## Remaining unknown

Provider/network behavior and credential loading are intentionally not exercised.
