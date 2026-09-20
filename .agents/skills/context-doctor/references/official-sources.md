# Official Codex sources

Use current OpenAI/Codex documentation as the source of truth. These URLs were checked on 2026-08-09.

- Skills: https://developers.openai.com/codex/skills
- AGENTS.md instructions: https://learn.chatgpt.com/docs/agent-configuration/agents-md
- Configuration reference: https://developers.openai.com/codex/config-reference
- Rules: https://learn.chatgpt.com/docs/agent-configuration/rules
- Hooks: https://learn.chatgpt.com/docs/hooks
- Non-interactive mode: https://learn.chatgpt.com/docs/non-interactive-mode
- Subagents: https://learn.chatgpt.com/docs/agent-configuration/subagents
- MCP: https://learn.chatgpt.com/docs/mcp
- Sandboxing and approvals: https://learn.chatgpt.com/docs/agent-configuration/permissions

The docs establish these audit facts:

- Codex loads project-scoped config from trusted `.codex/config.toml`; user config defaults to `~/.codex/config.toml` or the configured `CODEX_HOME`.
- Codex discovers repository skills from `.agents/skills` while walking from the current directory toward the repository root. A skill is a directory containing `SKILL.md`; scripts, references, assets, and `agents/openai.yaml` are optional.
- Codex builds layered instructions from `AGENTS.override.md` or `AGENTS.md`, with a documented `project_doc_max_bytes` limit and optional fallback filenames.
- Codex can load hooks from `hooks.json` or inline `[hooks]` tables in active `config.toml` layers. Project-local hooks require a trusted project layer.
- `[[skills.config]]` can enable or disable a skill by path in `config.toml`.

The sources do not justify universal token ratios, universal saturation percentages, or claims about effective runtime context without runtime evidence.
