# Codex portability and security

This package targets Codex CLI only. Its audit scope is the Codex control plane: `AGENTS.md`, `.agents/skills`, `.codex`, and the active `CODEX_HOME`. It does not inspect other agent control-plane formats.

The collector is standard-library-only and read-only. It emits bounded metadata, frontmatter characteristics, configuration-key presence, safe scalar classifications, hook event/handler shape, and file sizes. It never emits file bodies, shell commands, URLs, headers, credentials, raw environment values, hook payloads, transcripts, or token estimates.

Project `.codex` configuration and hooks are trusted only when Codex trusts the project layer. The skill reports trust-sensitive configuration as observed or UNKNOWN; it does not change trust, approvals, sandbox mode, rules, or hooks.

No MCP connector, plugin manifest, UI file, or external service is required by this skill. If a future change adds one, its exact Codex schema must be documented first and the collector must preserve the same redaction boundary.
