# CLAUDE.md

This file is a Claude Code runtime adapter, not a source of policy. **`AGENTS.md`
(root) and the nested `AGENTS.md` files it points to are the canonical,
runtime-agnostic repository contract** — for Claude Code, Codex CLI, or any
other agent. Read `AGENTS.md` first; everything normative lives there.

This file exists only to carry Claude-Code-specific runtime notes that
`AGENTS.md` deliberately does not, since `AGENTS.md` must stay usable by
other runtimes.

## What's Claude-Code-specific here

- Default commands, engineering standards, invariants, and definition-of-done
  are the ones in `AGENTS.md` — do not duplicate or fork them here. If this
  file and `AGENTS.md` ever disagree, `AGENTS.md` wins.
- Historical `.claude/` control-plane content (subagent personas, slash
  commands, hooks, permission settings) is mid-migration toward a
  Codex-native/tool-agnostic control plane. See
  `docs/control-plane/CURRENT_STATE.md` and
  `docs/control-plane/MIGRATION_CONTRACT.md` for the current, verified state
  of that migration before relying on anything under `.claude/`. Do not
  treat any file under `.claude/` as authoritative until that migration
  resolves it.
- Claude Code plugin/tool configuration (e.g. `managed-settings.example.json`)
  is Claude-Code-only and has no bearing on other runtimes reading
  `AGENTS.md`.

## Precedence

Scope and precedence between this file, `AGENTS.md`, and any nested
`AGENTS.md` follow `AGENTS.md`'s own "Scope and precedence" section. This
file never overrides it.
