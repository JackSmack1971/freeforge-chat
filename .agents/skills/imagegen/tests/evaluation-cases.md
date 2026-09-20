# Evaluation cases

1. Run `python scripts/image_gen.py generate --prompt test --dry-run`; assert exit 0, JSON output, and no API key requirement.
2. Run `python scripts/image_gen.py --help`; assert the `generate`, `generate-batch`, and `edit` commands are listed.
3. Confirm project-bound output guidance keeps generated files in the workspace rather than only under `$CODEX_HOME`.
