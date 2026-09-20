# Verification

- Source package: `.claude/skills/systematic-debugging/`.
- Target package: `.agents/skills/systematic-debugging/`.
- Preserved the debugging workflow, reference documents, TypeScript example, and pressure tests.
- Omitted `CREATION-LOG.md` because it is provenance about the source runtime, not operational skill behavior.
- Replaced Bash `find-polluter.sh` with standard-library Python `scripts/find_polluter.py`.

Validation commands and results are recorded after the Windows/Codex smoke checks.

Observed in this environment on 2026-08-09:

- Python 3.14.3 compiled the migrated helper successfully.
- `--help` completed and the no-match fixture completed without Bash/shell errors.
- The repository validator returned `{"status":"ok","errors":[]}`.
- Context inventory reported 112 discovered skills with bounded truncation.
- `codex-cli 0.147.0` headless JSONL discovery returned both
  `tailwind-design-system` and `systematic-debugging`.
- The repository TDD runner reports no supported project test runner; direct
  Python helper smoke checks were used instead.
