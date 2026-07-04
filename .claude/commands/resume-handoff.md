---
description: "Resume work from saved handoff state in .claude/handoff/current-task.json."
allowed-tools:
  - Read
  - Grep
  - Glob
---
# Resume Handoff

1. Read `.claude/handoff/current-task.json`.
2. Extract the saved objective, changed files, validation already run, open risks, and next actions.
3. Start the next work cycle from that saved state instead of re-deriving context from scratch.
4. If the file is missing or stale, say so explicitly and fall back to normal discovery.
