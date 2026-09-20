# CLI Contracts

All tools require Python 3.9+ and use only the standard library. `collect_history.py` also requires `git` on `PATH`.

## Status format

Successful commands print one JSON object to stdout:

```json
{"ok": true, "operation": "validate-plan", "warnings": []}
```

Failures print a JSON object to stderr and exit nonzero:

```json
{"ok": false, "operation": "collect-history", "error": "...", "details": []}
```

Collector data is written to `--output`; it is not mixed with the status stream.

## `collect_history.py`

```text
python3 scripts/collect_history.py --repo PATH --mode MODE --output PATH [options]
```

Modes:

- `full`: creates tag-bounded segments through `HEAD`.
- `since-tag`: latest reachable tag (exclusive) through `HEAD`; falls back to full history when no tag exists.
- `range`: requires `--from-ref`; defaults `--to-ref HEAD`.
- `dates`: accepts `--since` and/or `--until`.

Options:

- `--include-merges`: retain merge commits.
- `--first-parent`: traverse only the first-parent chain.
- `--no-files`: omit per-file numstat data.
- `--max-commits N`: fail before writing if total collected commits exceeds the limit; default `10000`.

Output includes repository metadata, warnings, release segments, commit messages, parents, author date, tags, file stats, and mechanical hints. Hints never authorize omission.

## `validate_plan.py`

```text
python3 scripts/validate_plan.py PLAN.json
```

Exit `0` only when the plan is safe and structurally valid.

## `apply_changelog.py`

```text
python3 scripts/apply_changelog.py --repo PATH --plan PLAN.json (--dry-run | --write)
```

- `--dry-run`: prints a unified diff and does not write.
- `--write`: atomically replaces the target.
- `--allow-replace`: mandatory for `reconstruct`.
- `--no-backup`: disables the default `.bak` copy.

The target must remain inside the repository and must match a safe relative path from the plan.

## `verify_changelog.py`

```text
python3 scripts/verify_changelog.py CHANGELOG.md
```

Checks title, Unreleased placement, duplicate versions, ISO dates, allowed section names and order, one-line bullets, duplicate entries, placeholders, and final newline.

## Exit codes

| Code | Meaning |
| ---: | --- |
| 0 | Success |
| 2 | CLI usage error |
| 3 | Git/repository error |
| 4 | Plan or changelog validation error |
| 5 | File I/O error |
| 6 | Unsafe/destructive operation blocked |
| 7 | Commit limit exceeded |
