---
paths:
  - ".claude/**"
  - ".mcp.json"
  - "managed-settings.json"
  - "CLAUDE.md"
  - "AGENTS.md"
---
# Control Plane Rules

- Treat the versioned control-plane sources in `.claude/`, `.codex/`, and `docs/` as production governance. Runtime-only artifacts such as audit runs, session handoff state, local settings, and the non-versioned managed-settings file stay local.
- Keep control-plane changes narrow. Change one mechanism at a time when possible so regressions are attributable.
- Prefer Node or Python for hooks and workflows instead of shell-specific pipelines or OS-specific command syntax.
- After control-plane edits, run `/control-plane-check` before broader quality or release claims.
- The control-plane check must confirm the tracked governance paths are no longer hidden by `.gitignore`.
- Writer agents must define prerequisites, turn limits, and loop-stop conditions before they are trusted with edits.
- Do not mark control-plane work release-ready until referenced files exist, edited scripts parse cleanly, and the final report includes raw verification stdout.
