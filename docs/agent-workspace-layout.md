# Agent Workspace Layout

This repository keeps a few agent-facing workspace directories at the root. The table below is the single index for their purpose, canonical status, and retention policy.

| Path | Purpose | Status | Retention |
|---|---|---|---|
| `.audit-runs/` | Root audit-run history from earlier sessions. `.claude/audit-runs/` (formerly canonical) no longer exists on disk — `.claude/**` was removed as part of the Codex control-plane migration; see `docs/control-plane/CURRENT_STATE.md` and `MIGRATION_CONTRACT.md`. | Canonical (by default, since the former canonical path is gone) | Keep for local continuity; it is ignored in the shared repo config so new work should not add more data here. |
| `.session-feedback/` | Session-level feedback and recap artifacts from agent runs. | Supporting workspace | Retain as useful historical context; do not treat as application source. |
| `.worktrees/` | Local Git worktrees for isolated branch work. | Local developer workspace | Safe to prune when a branch is merged or the worktree is no longer needed. |
| `pending_rules/` | Draft rule candidates waiting on review or consolidation. | Working area | Retain until a rule is either merged into `.codex/rules/` or `.agents/` or explicitly discarded. |
| `plans/` | Prototype and planning artifacts that are not part of the shipped app. | Supporting workspace | Keep only the plans that are still useful; archive or delete stale drafts during cleanup. |
| `.repository-hygiene/` | Generated hygiene reports and repository audit artifacts. | Generated workspace | Retain only while the reports are still useful; it may be regenerated. |
| `coverage/` | Generated coverage output. | Generated workspace | Safe to regenerate or remove after inspection. |
| `docs/` | Human-readable repository documentation and indexes like this file. | Canonical documentation workspace | Keep tracked documentation current; remove only when it is superseded. |

## Canonical Rule

For audit-run history, `.audit-runs/` is the only such directory left on disk;
the formerly-canonical `.claude/audit-runs/` was removed with the rest of
`.claude/**`. `.planning/**` was likewise removed from disk during the same
migration and is no longer an active workspace directory in this repository.
