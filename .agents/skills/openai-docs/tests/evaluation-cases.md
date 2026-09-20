# Evaluation cases

1. Run `python scripts/resolve-latest-model-info --help`; assert the cross-platform wrapper reaches the Node resolver and returns JSON.
2. Run `node --check scripts/fetch-codex-manual.mjs` and `node --check scripts/resolve-latest-model-info.cjs`; assert both pass.
3. Confirm documentation answers use official OpenAI sources and do not claim current behavior from an unopened reference.
