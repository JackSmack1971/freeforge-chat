# last30days workflow

Load this for the invocation flow and preflight.

## Flow

1. Identify the topic and classify it.
2. Resolve person handles, GitHub repos, and communities when relevant.
3. Build a query plan to a tmpfile and pass it with `--plan`.
4. Resolve a Python 3.12+ interpreter and run `scripts/last30days.py` from the skill directory.
5. Use the engine output as the primary result, then supplement with WebSearch only when it adds new evidence.

## Commands

Prefer the bundled engine:

```bash
LAST30DAYS_PYTHON=python3
"${LAST30DAYS_PYTHON}" "${SKILL_DIR}/scripts/last30days.py" "$TOPIC" --plan "$QUERY_PLAN_FILE" --emit=compact
```

For HTML briefs, read `references/save-html-brief.md` and use `--emit=html`.

## Preflight

- Reframe keyword traps before running the engine.
- For named entities, always include a plan file.
- For people, resolve any known X, GitHub, and subreddit scopes before execution.
- If the user asks for no topic, ask once for the topic and stop.
