# Evaluation cases

1. Scaffold a temporary plugin with `scripts/create_basic_plugin.py`; assert `.codex-plugin/plugin.json` exists and has no TODO placeholders.
2. Run `scripts/validate_plugin.py` against that temporary plugin; assert exit 0.
3. Confirm a normal scaffold without `--with-marketplace` does not mutate a marketplace file.
