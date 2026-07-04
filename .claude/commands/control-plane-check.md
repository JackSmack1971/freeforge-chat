---
description: "Structurally verify Claude control-plane files after framework edits."
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash(node .claude/hooks/validators/control-plane-check.js*)
---
# Control Plane Check

Run the structural verifier after editing `.claude/**`, `.mcp.json`, `managed-settings.json`, `CLAUDE.md`, or `AGENTS.md`.

1. Execute `node .claude/hooks/validators/control-plane-check.js`.
2. Treat any missing file, JSON parse failure, invalid `.mcp.json` or `managed-settings.json` shape, or JavaScript syntax error as blocking.
3. Return the raw verifier stdout plus any remaining manual checks still required.
