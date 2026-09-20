# Codex Project Config Policy Map: `.codex/config.toml`

Companion to `CURRENT_STATE.md` and `MIGRATION_CONTRACT.md`. Those documents
describe the broader control-plane migration; this one is scoped narrowly to
one artifact — `.codex/config.toml` — and answers, key by key: what it does,
who owns that concern, and whether it authorizes any effect by itself.

Source verified against the official Codex CLI configuration reference
(`developers.openai.com/codex/config-reference`, `config-basic`,
`config-advanced`, fetched 2026-09-20) before this file and `config.toml`
were written, specifically to avoid copying retired keys — see "Retired /
avoided settings" below.

## Trust and scope, stated explicitly

- **Project config loads only for a trusted project.** Codex CLI marks a
  workspace trusted or untrusted via `projects.<path>.trust_level` in the
  *user's own* `~/.codex/config.toml` (machine-specific, deliberately not
  something this repository can set for itself). If this workspace is not
  marked trusted, Codex skips all project-scoped `.codex/` layers entirely —
  this file, project hooks, and project rules included. Nothing in this
  repository can force itself to be trusted.
- **Project config is not an enterprise/admin enforcement substitute.** An
  organization's managed constraints live in `requirements.toml` on managed
  machines and in cloud-managed defaults, both of which sit outside this
  repository and outside this file's reach. `.codex/config.toml` cannot
  create, widen, or stand in for that enforcement layer. Where this document
  says a setting "does not authorize an effect," that holds regardless of
  what any admin-managed layer separately permits or denies.
- **Precedence, highest to lowest:** CLI flags/`--config` → project config
  files (closest wins; trusted projects only) → `--profile` files → user
  config (`~/.codex/config.toml`) → cloud-managed defaults → system config →
  built-in defaults. Because project config outranks the user's own config,
  every key below was chosen so that setting it here can only **narrow**
  behavior (or leave it unset to inherit), never **widen** it past what an
  operator's own user/admin config already allows. That is the design rule
  this whole file follows, not just a note on individual keys.

## Setting → purpose → owning plane → authorizes an effect?

| Setting | Purpose | Owning plane | Authorizes an effect? |
|---|---|---|---|
| `allow_login_shell = false` | Rejects login-shell semantics for shell-based tools in this project. | Execution policy (shell invocation mode) | No — this only restricts. It cannot turn login-shell access on; it can only forbid it, and only if the operator's own config would otherwise have allowed it. |
| `[agents] enabled = true` | Declares that Codex's multi-agent tools (spawning/coordinating subagent threads) may be used in this project. | Capability/tool availability | No, by itself. Every tool call a spawned subagent makes is still gated by the same sandbox and approval policy as the primary thread — this flag only makes the *capability* available; it does not pre-approve anything a subagent does. If an operator's own config has `agents.enabled = false`, note that our `true` here would override it (project config outranks user config) — this is the one key in this file where "true" is a widening default rather than a restriction, which is why it is limited to enabling the capability only, with concurrency immediately bounded below and no other agent behavior configured (no `default_subagent_model`, no reasoning-effort override, left to inherit). |
| `[agents] max_concurrent_threads_per_session = 3` | Caps how many spawned-agent threads (excluding the primary thread) may be open at once in this session. | Resource/concurrency policy | No — a lower bound than the built-in default is only ever a restriction, never a grant. |
| `[sandbox_workspace_write] network_access = false` | Denies outbound network access inside the workspace-write sandbox, if and when `sandbox_mode = "workspace-write"` is already in force from another layer. | Execution policy (sandbox) | No — this only restricts network reachability. It does not turn workspace-write mode on; that decision is left to normal sandbox/policy resolution (CLI flag, profile, user/admin config), which is exactly the "workspace edits allowed only through normal sandbox/policy resolution" requirement this file follows. |
| `[sandbox_workspace_write] exclude_slash_tmp = true` | Excludes `/tmp` from the writable roots granted in workspace-write mode. | Execution policy (sandbox) | No — restriction only, narrows the default writable surface. |
| `[sandbox_workspace_write] exclude_tmpdir_env_var = true` | Excludes `$TMPDIR` from the writable roots granted in workspace-write mode. | Execution policy (sandbox) | No — restriction only, same reasoning as above. |

## Deliberately left unset (inherited, not duplicated)

These are the keys that decide the most security-relevant behavior
(`approval_policy`, `sandbox_mode`, `model`, `model_providers`,
`mcp_servers`, `projects.*.trust_level`, `shell_environment_policy`). None
of them appear in `.codex/config.toml`, on purpose:

- Because project config outranks user config in precedence, setting any of
  these here could silently override a *stricter* choice an operator or
  admin already made in their own config — the opposite of "no implicit
  production authority." Leaving them unset means this project can only
  ever be as permissive as whatever layer below it (user config, cloud
  defaults, admin requirements) already allows, never more.
- This also satisfies "inheritance rather than unnecessary duplication":
  there is no reason to restate a value here that would just repeat, or
  worse silently drift from, the operator's own config over time.
- `mcp_servers` specifically: FreeForge is a zero-build, zero-install,
  static browser app (`AGENTS.md`, "Repository routing" — source is
  `freeforge/index.html`, `freeforge/src/`, `freeforge/styles/`; runtime
  libraries are CDN-loaded with SRI, no server/bundler/required
  dependencies). No external tool/service capability is documented as
  required for interactive development on this repository, so no MCP
  server is declared. This is a documented absence, not an oversight.
- `projects.<path>.trust_level` specifically cannot live in a
  repository-tracked file at all: it is keyed by absolute filesystem path
  in the *user's own* `~/.codex/config.toml`, which is exactly the kind of
  user-specific absolute path this configuration must not contain.

## Retired / avoided settings

Verified directly against the current official config reference before
writing `config.toml`, so the following are known and intentionally not
used:

- `approval_policy = "untrusted"` — retired. The current reference
  documents a migration note for exactly this value and does not accept it.
- `approval_policy = "on-failure"` — deprecated in the current reference.
- Any bypass/"yolo"-style full-auto posture (e.g. an unconditional
  `sandbox_mode = "danger-full-access"` paired with a non-interactive
  `approval_policy`) — not configured here at all; this file never sets
  `sandbox_mode`, and the one thing it does set for the workspace-write
  sandbox (`network_access = false` plus the two `exclude_*` flags) only
  removes capability, it does not grant `danger-full-access` or anything
  resembling it.

## Verification

- `.codex/config.toml` parses as valid TOML and none of the
  retired/dangerous values above are present: covered by
  `tests/security/codex-config.test.mjs`, run via the repository's existing
  `node --test tests/security/*.test.mjs` entry point — no new dependency
  or build step was added to satisfy this (the test file implements a
  minimal TOML reader sufficient for this specific file's grammar, since
  the repository is zero-install and has no TOML parser dependency
  available).
- Config semantics (key names, valid values, precedence order, trust
  behavior) verified against `developers.openai.com/codex/config-reference`,
  `config-basic`, and `config-advanced` on 2026-09-20, not from prior
  knowledge of older Codex CLI versions.
- This document and `.codex/config.toml` do not modify `freeforge/**`,
  `tests/security/*.test.mjs` (pre-existing files), `netlify.toml`, CI
  workflows, or any application behavior.
