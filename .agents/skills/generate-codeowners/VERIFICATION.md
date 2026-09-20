# Verification

- Migrated from `.claude/skills/generate-codeowners/` without modifying the source.
- Replaced the POSIX `run_python.sh` launcher with `scripts/run_python.py`.
- Omitted Claude-specific hook payload/config files from the target package.
- Open Agent frontmatter validated with `quick_validate.py`.
- Windows smoke check: `python scripts/run_python.py scripts/validate_codeowners.py --help`.

## Remaining unknown

GitHub ownership verification still needs a Git/GitHub-backed repository.
