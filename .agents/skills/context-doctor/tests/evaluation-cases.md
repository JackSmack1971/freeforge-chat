# Codex Context Doctor evaluation cases

These are manual behavior cases, not token thresholds.

## Case 1 — AGENTS.md byte cap

Given layered `AGENTS.md` files whose combined size exceeds `project_doc_max_bytes`, report measured truncation risk and propose splitting guidance. Do not claim exact loaded content without runtime evidence.

## Case 2 — Override precedence

Given both `AGENTS.override.md` and `AGENTS.md` in one directory, report the documented precedence and the file sizes without reading unrelated source files.

## Case 3 — Skill discovery pressure

Given many `.agents/skills/*/SKILL.md` files with long descriptions, report discovery-list pressure qualitatively. Do not estimate tokens from characters.

## Case 4 — Disabled skill

Given `[[skills.config]] path = "..." enabled = false`, report the explicit disabled path. Do not infer that a referenced skill is disabled when its path is not listed.

## Case 5 — Duplicate skill names

Given two discovered skills with the same `name`, report them as separate paths; do not merge their bodies.

## Case 6 — Project config trust

Given `.codex/config.toml` in an untrusted project, report the file as present and the effective project-layer state as UNKNOWN unless trust evidence is supplied.

## Case 7 — Hook context injection

Given `.codex/hooks.json` with `SessionStart`, `PreToolUse`, and `PostCompact`, report potential context injection and any `additionalContextLimit` metadata without emitting commands, matchers, or payloads.

## Case 8 — Rules

Given `.codex/rules/*.rules` with allow/prompt/forbidden decisions, report rule shape without emitting command prefixes. Recommend `codex execpolicy check` only when the user explicitly asks to validate effective decisions.

## Case 9 — Output retention

Given `tool_output_token_limit`, `history.persistence`, or `history.max_bytes`, report controls, not measured utilization or transcript contents.

## Case 10 — No runtime telemetry

Given no Codex runtime context output, mark current context utilization UNKNOWN and do not manufacture a WARN.

## Case 11 — Scope exclusion

Given another agent's control-plane files beside valid Codex files, ignore them and state that they are outside this skill’s scope.

## Case 12 — Safe collector output

Given synthetic config containing secrets, hook commands, MCP URLs, and transcript files, verify the collector emits none of those values or bodies.
