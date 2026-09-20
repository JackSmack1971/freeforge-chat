# Verification

## Migration evidence

- Source: `.claude/skills/simplification-cascades/`
- Target: `.agents/skills/simplification-cascades/`
- Preserved: JSON scan fields, score calculation, duplicate/special-case/config heuristics, and verify-mode field.
- Changed: Bash runner became `scripts/scan_cascade_signals.py`; Claude-only frontmatter and `run_command` wording were removed.
- Omitted: no source runtime metadata had a Codex equivalent.

## Checks

Run from the repository root:

```text
python -m py_compile .agents/skills/simplification-cascades/scripts/scan_cascade_signals.py
python .agents/skills/simplification-cascades/scripts/scan_cascade_signals.py --path .agents/skills/simplification-cascades
python .agents/skills/simplification-cascades/scripts/scan_cascade_signals.py --path .agents/skills/simplification-cascades --verify
```

The scanner is read-only. Results are environment-dependent because the
heuristic scans the selected path.

Observed in this environment on 2026-08-09:

- Python 3.14.3 compiled the helper successfully.
- Normal and `--verify` scans completed with valid JSON and a zero score on
  the package itself.
- A missing target returned a bounded error and nonzero exit status.
- `codex-cli 0.147.0` headless JSONL execution selected
  `simplification-cascades` by its discovery metadata and returned usage
  telemetry.
- The existing Context Doctor validator returned `{"status":"ok","errors":[]}`.
- The repository TDD runner reports no supported project test runner; direct
  helper smoke checks were used instead.
