# Codex Context Doctor audit playbook

## Evidence labels

- **DIRECT** — observed in a documented Codex control-plane file or user-supplied runtime output.
- **MEASURED** — deterministic file size, line count, count, or truncation result.
- **INFERRED** — conclusion from direct evidence plus documented Codex behavior.
- **UNKNOWN** — required evidence is unavailable, redacted, profile-dependent, or runtime-only.

## Phase 0 — Resolve the active layers

Record the repository root, current working directory, `CODEX_HOME`, active profile if supplied, project trust state if supplied, and collector truncation. Distinguish user `CODEX_HOME` files from project `.codex` files. Do not assume a project layer is active merely because it exists.

## Phase 1 — AGENTS.md instruction chain

Audit `AGENTS.override.md` and `AGENTS.md` files in the Codex home and from the project root to the current directory. Report measured bytes/lines, empty files, duplicate guidance, nested overrides, fallback filenames configured by `project_doc_fallback_filenames`, and the combined `project_doc_max_bytes` limit. Do not call a file “loaded” unless runtime evidence or the documented path chain supports it.

## Phase 2 — Skills and discovery budget

Audit `.agents/skills` directories discovered from the current directory toward the repository root and the user skill directory `$HOME/.agents/skills`. For each shown skill, collect only name, description characteristics, path, file sizes, and optional directory presence. Codex starts discovery with name, description, and path, caps the initial list at 2% of context or 8,000 characters when unknown, and loads the full `SKILL.md` only after selection. Do not estimate token cost from bytes.

Inspect `[[skills.config]]` entries in active config layers. If a path is disabled, report the explicit path and status; do not infer the state of unlisted skills. Duplicate names are separate skills, not a merged skill.

## Phase 3 — `.codex/config.toml`

Audit documented context-affecting keys only: `project_doc_max_bytes`, `project_doc_fallback_filenames`, `model_instructions_file`, `model_context_window`, `history.persistence`, `history.max_bytes`, `tool_output_token_limit`, `skills.config`, `agents`, `hooks`, `mcp_servers`, `sandbox_mode`, `approval_policy`, and model/reasoning selectors. Emit presence and safe classifications, never raw provider values, commands, paths that may contain secrets, or arbitrary TOML values.

## Phase 4 — Rules, sandbox, approvals, and MCP

Inventory `.codex/rules/*.rules` and user-layer rules. Report rule counts, file sizes, and whether rules contain `allow`, `prompt`, or `forbidden` decisions without emitting command prefixes. Report configured sandbox/approval/MCP presence and documented mode names only. Do not claim effective permission behavior without the active profile, trust state, and runtime result.

## Phase 5 — Hooks and context injection

Inventory `hooks.json` and inline `[hooks]` tables in active config layers. Report event names, handler counts/types, `additionalContextLimit` presence, and trust/review status when supplied. Codex documents `SessionStart`, `SubagentStart`, `PreToolUse`, `PostToolUse`, `UserPromptSubmit`, `PreCompact`, `PostCompact`, `Stop`, and related lifecycle events; configured is not the same as injected. Never emit matcher strings, commands, inputs, outputs, or hook payloads.

## Phase 6 — Subagents and agents

Audit documented `agents` configuration and any project/user agent files that the installed Codex version explicitly supports. Report role count, model/reasoning overrides, skill configuration presence, and MCP/tool configuration presence without emitting custom model IDs or instructions. Do not claim isolation or inherited context without runtime evidence.

## Phase 7 — Context, output, and compaction controls

Use only Codex-provided runtime telemetry for current context usage. Report configured `model_context_window`, `tool_output_token_limit`, and history settings as controls, not measured utilization. Treat `PreCompact`, `PostCompact`, and `SessionStart` hooks as possible reinjection surfaces. Never invent a fixed compaction percentage.

## Phase 8 — History, logs, and durable state

Inventory only metadata for configured Codex history/log directories and persistence settings. Do not inspect `history.jsonl`, rollout files, transcripts, or log bodies. A configured path is not evidence that a session contains a particular payload.

## Phase 9 — Findings and migrations

Rank only actionable, evidence-backed burden. Use the smallest Codex-native destination: split `AGENTS.md`, move task-specific guidance into a skill reference, disable a duplicate skill through documented `skills.config`, reduce hook `additionalContext`, narrow rule scope, or reduce output/history retention. State rollback and approval boundary.

## Phase 10 — Report and stop

Follow `report-contract.md` exactly. Stop after reporting. No remediation is performed by this skill.
