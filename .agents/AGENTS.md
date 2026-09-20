# `.agents/` — cross-tool, project-level control-plane content

This directory holds control-plane content shared across coding-agent
runtimes (Codex CLI and others), not product source. See `AGENTS.md` (root)
for the repository-wide contract this directory operates under, and
`docs/control-plane/CURRENT_STATE.md` / `docs/control-plane/MIGRATION_CONTRACT.md`
for the verified migration record and target topology.

`skills/` holds invokable procedures available to agents working in this
repository. A Skill never grants permission by itself — see
`MIGRATION_CONTRACT.md` section 3.3.
