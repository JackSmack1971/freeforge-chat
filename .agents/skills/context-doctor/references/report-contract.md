# Context Doctor report contract

Produce this structure unless the user explicitly requests another format.

## Context Doctor

### Evidence Scope

State repository root, current directory, `CODEX_HOME`, active profile if known, project trust state if known, Codex config layers inspected, runtime telemetry availability, and collector truncation.

### Scorecard

Use `PASS`, `WARN`, or `UNKNOWN` for:

- AGENTS.md instruction loading and byte cap
- Skill discovery and activation cost
- `.codex/config.toml` context controls
- Rules, sandbox, approvals, and MCP
- Hook context injection and reinjection risk
- Subagent/model/skill configuration
- History, logs, and durable state

Every grade needs evidence. Missing runtime telemetry is UNKNOWN, not WARN.

### Always-Loaded and Discovery Context

Report measured instruction bytes/lines and skill discovery metadata. Describe the documented `project_doc_max_bytes` and 2%/8,000-character skill-list cap without converting bytes to tokens.

### Highest-Impact Findings

Rank only non-zero-cost, actionable findings. For each include evidence label, cost class, affected layer, impact direction, risk, and rollback.

### Proposed Codex Migrations

For each proposal include:

1. source path/key;
2. Codex-native destination;
3. behavior preserved;
4. expected context effect, qualitative unless runtime telemetry measures it;
5. approval required;
6. rollback.

### Runtime Context and Cache Evidence

Report supplied Codex runtime telemetry only. If absent, say UNKNOWN. Never infer current context utilization or cache behavior from file size.

### Recommended Order

Order by evidence-backed impact, reversibility, and low risk.

### Approval Boundary

State clearly that the audit made no changes and that proposals require explicit approval.

Required closing sentence:

> No changes have been made. Tell me which proposed remediations to apply.
