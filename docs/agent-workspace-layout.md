# Agent Workspace Layout

This repository keeps a few agent-facing workspace directories at the root. The table below is the single index for their purpose, canonical status, and retention policy.

| Path | Purpose | Status | Retention |
|---|---|---|---|
| `.claude/audit-runs/` | Canonical audit-run output, contracts, checkpoints, and trace artifacts for current and future agent sessions. | Canonical | Keep as long-lived audit history. Do not delete unless an archive policy explicitly calls for it. |
| `.audit-runs/` | Legacy root audit-run history from earlier sessions. | Legacy, local-only | Keep only for local continuity; it is ignored in the shared repo config so new work should not add more data here. |
| `.planning/` | Active roadmap, milestone, phase, and codebase context for the current project cycle. | Canonical planning workspace | Keep while the project is active; prune only through the repo’s planning cleanup flow. |
| `.session-feedback/` | Session-level feedback and recap artifacts from agent runs. | Supporting workspace | Retain as useful historical context; do not treat as application source. |
| `.worktrees/` | Local Git worktrees for isolated branch work. | Local developer workspace | Safe to prune when a branch is merged or the worktree is no longer needed. |
| `pending_rules/` | Draft rule candidates waiting on review or consolidation. | Working area | Retain until a rule is either merged into `.claude/rules/` or explicitly discarded. |
| `plans/` | Prototype and planning artifacts that are not part of the shipped app. | Supporting workspace | Keep only the plans that are still useful; archive or delete stale drafts during cleanup. |
| `.repository-hygiene/` | Generated hygiene reports and repository audit artifacts. | Generated workspace | Retain only while the reports are still useful; it may be regenerated. |
| `coverage/` | Generated coverage output. | Generated workspace | Safe to regenerate or remove after inspection. |
| `docs/` | Human-readable repository documentation and indexes like this file. | Canonical documentation workspace | Keep tracked documentation current; remove only when it is superseded. |

## Canonical Rule

For audit-run history, `.claude/audit-runs/` is canonical. The root `.audit-runs/` directory is legacy and should not be expanded with new content.
