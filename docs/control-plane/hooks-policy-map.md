# Codex Hooks Policy Map: `.codex/hooks.json` and `.codex/hooks/*.js`

Companion to `CURRENT_STATE.md`, `MIGRATION_CONTRACT.md` (dimension 1.8,
"Hooks"), and `policy-map.md`. Scoped narrowly to the Codex-native hook
layer this migration step adds: what schema it was verified against, what
each hook does, its blocking behavior and failure mode, and — per migration
invariant 3.4 ("one implementation owner for overlapping edits") — exactly
where it overlaps `.codex/rules/default.rules` and why it does not
duplicate that ownership.

## What this is a semantic port of

`.claude/hooks/validators/*.js` and `.claude/hooks/workflow/*.js` (Claude
Code hook scripts, deleted from disk, still in HEAD — see
`CURRENT_STATE.md`). This is **not** a rename of those files: Claude Code's
hook payload shape, tool names (`Bash`, `WebFetch`, `Write`, `Edit`,
`MultiEdit`), `$CLAUDE_PROJECT_DIR`, and `permissionDecision: "ask"` do not
carry over to Codex CLI's runtime unchanged. Each Codex hook below was
rewritten against Codex's own schema (see "Schema verified against" below),
keeping only the *behavioral intent* of the Claude-era hook it replaces.

| Claude-era hook | Codex-native replacement | What changed and why |
|---|---|---|
| `hooks/validators/protect-files.js` | `hooks/guard-protected-writes.js` | Rewritten for Codex's `apply_patch` tool (patch-body path extraction) instead of `Write`/`Edit`/`MultiEdit` `file_path`; `permissionDecision: "ask"` downgraded to advisory `additionalContext` because Codex's `"ask"` is parsed but not yet supported (verified live, see below) — hard-protected paths still `"deny"`. |
| `hooks/validators/analyze-command.js` | `hooks/guard-production-signal.js` | Narrowed to an advisory-only production-operation flag. The command-allow/forbid/prompt decision this Claude hook used to make is now Codex's own native execpolicy (`.codex/rules/default.rules`), not a hook's job — see "Overlap with `.codex/rules/default.rules`" below. |
| `hooks/validators/control-plane-check.js` | *(not ported as a hook)* | This is a structural linter over `.claude/**`-shaped artifacts (frontmatter schemas, agent personas, slash commands) that no longer exist in the target topology (`MIGRATION_CONTRACT.md` section 2). Porting it 1:1 would mechanically rename Claude-shaped checks for artifacts Codex doesn't have. A Codex-native structural check, if needed, is future work tracked by `MIGRATION_CONTRACT.md` section 5, item 3 — out of scope for this hook-layer step. |
| `hooks/validators/web-access-guard.js` | *(not ported)* | Codex CLI's own capability/network model (`[sandbox_workspace_write] network_access = false` in `.codex/config.toml`, plus MCP server allowlisting) already governs outbound network reachability at the execution-policy layer (`policy-map.md`), not via a hook keyed to a Claude-specific `WebFetch` tool name. Re-implementing a URL allowlist as a hook here would duplicate a concern `config.toml` already owns more natively. |
| `hooks/workflow/session-start.js` | `hooks/session-start.js` | Repo-root/branch/SHA/dirty-state resolved via `git` from the session's own `cwd`, not `$CLAUDE_PROJECT_DIR`. Drops the `.claude/handoff/current-task.json` reference (that mechanism is not part of the target topology) and adds the Netlify production-branch warning explicitly. |
| `hooks/workflow/format-touched-file.js` | `hooks/record-touched-files.js` | Deliberately does **not** run Prettier or any other formatter. The task instruction for this hook layer is explicit: "do not silently run broad formatters." The Claude-era hook already scoped itself to "cheap, best-effort formatting only," but even that silently rewrites a file the agent just produced before a human reviews the diff; the Codex-native version instead records what was touched as evidence context and leaves formatting to an explicit, visible step. |
| `hooks/workflow/stop-summary.js` | `hooks/stop-reminder.js` | Same intent (remind before claiming done), reworded to explicitly forbid claiming a check passed that was not actually run this turn, matching this repository's verification-floor rule, and to cite the real evidence-vs-authorization boundary (`MIGRATION_CONTRACT.md` section 3.7) instead of Claude-specific slash commands (`/quality-gate`, `/control-plane-check`, `/handoff`) that do not exist in this runtime. |

No new hook was invented that has no Claude-era counterpart or explicit
task requirement; this is a semantic port, not a superset.

## Schema verified against

Fetched 2026-09-20, same day as `policy-map.md`'s Codex config verification:

- `developers.openai.com/codex/hooks` (redirects to `learn.chatgpt.com/docs/hooks`)
- `developers.openai.com/codex/config-advanced` (redirects to
  `learn.chatgpt.com/docs/config-file/config-advanced`), for the
  `[hooks]`/`hooks.json` file-location and project-trust interaction

Key facts this hook layer depends on, as verified:

- **Hook events exist as a real Codex mechanism** (not assumed from Claude
  Code): `SessionStart`, `SessionEnd`, `PreToolUse`, `PostToolUse`,
  `PermissionRequest`, `PreCompact`, `PostCompact`, `UserPromptSubmit`,
  `SubagentStart`, `SubagentStop`, `Stop`, `Interrupt`.
- **`hooks.json` schema**: `{ "description"?, "hooks": { "<Event>": [ { "matcher": <regex-or-empty>, "hooks": [ { "type": "command", "command", "commandWindows"?, "timeout"?, ... } ] } ] } }` — the exact shape `.codex/hooks.json` in this repository uses.
- **Matcher syntax**: a regex string; `"*"`/`""`/omitted matches all
  occurrences of that event. `PreToolUse`/`PostToolUse` matchers filter on
  tool name (`Bash`, `apply_patch`, `Edit`/`Write`, MCP tool names).
  `SessionStart` matches on `startup|resume|clear|compact`.
- **Canonical local tool names**: `Bash` (shell/`exec_command`) and
  `apply_patch` (patch-based file edits) — not Claude Code's `Write`/`Edit`/
  `MultiEdit`. `tool_input` for both is `{ "command": "<string>" }`; for
  `apply_patch` that string is the patch body (`*** Begin Patch` / `*** Add
  File: <path>` / `*** Update File: <path>` / `*** Move to: <path>` /
  `*** Delete File: <path>` / `*** End Patch`), which is why
  `guard-protected-writes.js` and `record-touched-files.js` parse that
  format explicitly instead of reading a Claude-style `file_path` field.
  `Edit`/`Write` tool names are still handled defensively in case a
  non-CLI Codex surface (e.g. an IDE extension) uses them, per the matcher
  example `apply_patch|Edit|Write` shown in the hooks reference itself.
- **Blocking mechanism for `PreToolUse`**: `hookSpecificOutput.permissionDecision`
  set to `"allow"` (optionally with `updatedInput` to rewrite the call) or
  `"deny"` (with `permissionDecisionReason`). **`"ask"` is parsed by Codex
  but not yet supported** — this is why every hook in this layer either
  hard-denies or advisory-allows, never attempts to request approval
  itself. A separate `PermissionRequest` event exists for the pre-approval-
  prompt point, but it likewise only supports `allow`/`deny`, not a
  three-way ask; none of this repository's hooks target it, because the
  actual human-approval gate for the command shapes this project cares
  about (`git commit`, `git push`, `gh pr merge`, `netlify deploy`, ...) is
  already the `"prompt"` decision in `.codex/rules/default.rules`'
  execpolicy engine, which *is* real, enforced Codex-native approval —
  see "Overlap" below.
- **Project-trust semantics**: project-level hooks (`<repo>/.codex/hooks.json`
  or `<repo>/.codex/config.toml`'s `[hooks]` table) load **only when the
  project's `.codex/` layer is trusted**. An untrusted workspace skips this
  entire hook layer — same trust gate `.codex/config.toml` and
  `.codex/rules/*.rules` already depend on (`policy-map.md`). Nothing in
  this repository can force its own workspace to be trusted; that is set
  per-machine in the *user's own* `~/.codex/config.toml`.
- **Non-managed hooks require explicit review/trust** (`/hooks` CLI
  command), recorded per-hook-hash; a changed hook script is re-flagged for
  review. This repository's hooks are ordinary project hooks, not
  `requirements.toml`-managed ones, so they go through this same review
  flow — consistent with "hook is defense-in-depth, not sole authorization"
  for every hook in this layer, since a human must trust them before they
  run at all.
- **Windows support**: hooks run via a separate `commandWindows` field
  (JSON) — used for every hook in `.codex/hooks.json` here, even though the
  command text happens to be identical to the POSIX `command` on both
  platforms (`node .codex/hooks/<name>.js`), because Node module resolution
  and the working directory are POSIX-shaped in both cases; this repository
  does not use platform-specific shell syntax in any hook invocation.

## Fail-conservative vs. degrade-safely, by hook

Per this migration step's instruction ("hooks must fail conservatively
where a malformed security decision would otherwise permit a dangerous
write, while non-security advisory hooks should degrade safely"):

| Hook | Role | On malformed/unparseable input or unexpected error |
|---|---|---|
| `guard-protected-writes.js` | Security decision (deny/advisory-allow a file write) | **Fails closed**: denies the call. This is the one hook in this layer where "cannot classify" must not become "allow." |
| `guard-production-signal.js` | Advisory only, never denies | Degrades safely: allows silently, no comment. |
| `session-start.js` | Advisory only | Degrades safely: emits a narrower context message and continues; never blocks session start. |
| `record-touched-files.js` | Advisory only (evidence context) | Degrades safely: emits nothing and exits 0; a tool call has already completed by the time `PostToolUse` fires, so this hook has no enforcement role left to fail out of. |
| `stop-reminder.js` | Advisory only | Degrades safely: emits the same fixed reminder regardless of input, since its content does not depend on parsing the payload. |

## Overlap with `.codex/rules/default.rules`

Per migration invariant 3.4, exactly one layer is authoritative for each
overlapping concern:

- **Command-level allow/forbid/prompt decisions** (`rm -rf`, `git reset
  --hard`, `git clean -f`, force-push, `npm publish`, `netlify deploy
  --prod`, `git commit`, `git push`, `gh pr merge`, `gh release create`,
  ...) are owned by `.codex/rules/default.rules`, Codex's real, enforced,
  load-time-validated execpolicy engine (`tests/security/codex-execpolicy-rules.test.mjs`).
  **No hook in this layer re-implements that decision.**
  `guard-production-signal.js` only ever advisory-allows; it exists purely
  to add visibility for compound command lines execpolicy's ordered-prefix
  matching may not catch (e.g. `npm run build && git push origin main` —
  the interesting token is not a leading prefix) and to restate the
  human-authorization requirement inline in the transcript. If this hook
  and `default.rules` ever appear to disagree, `default.rules` is
  authoritative, because it is the layer that can actually enforce the
  decision. `guard-production-signal.js` also flags local `git tag`
  creation for visibility — `default.rules` does not gate tag creation
  itself (it is locally reversible), but tagging is the usual first step
  toward a `gh release create`, so the advisory layer surfaces it early.
  See `production-boundary.md` for the full production-boundary policy
  this hook and `default.rules` jointly implement, and for the explicit
  statement that neither can prevent every remote merge path to `main`.
- **File-target writes via `apply_patch`/`Edit`/`Write`** have no shell
  command for execpolicy's `prefix_rule()` matcher to see at all — this is
  the genuine gap `guard-protected-writes.js` fills, and it is the only
  hook in this layer that denies anything.
- **Outbound network reachability** is owned by `.codex/config.toml`'s
  `[sandbox_workspace_write] network_access = false` (execution-policy /
  sandbox layer), not a hook — see "not ported" row above.

## Verification

- Every hook script is a plain Node CommonJS module with no external
  dependency (repository is zero-install), reads only `stdin`, and calls
  only `git` via `execFileSync` (never a shell) for repo-root/branch/SHA/
  status resolution — no shell-injection surface from hook input.
- `tests/security/codex-hooks.test.mjs` spawns each hook script directly
  with representative JSON fixtures and asserts on stdout/exit behavior:
  allowed, blocked (hard-deny), malformed-input (fail-closed), a
  Windows-backslash path case, and a production-boundary (advisory, never
  denies) case, per this migration step's explicit fixture requirement.
- `.codex/hooks.json` and `.codex/hooks/*.js` are confirmed not
  gitignored (`.gitignore` narrowed the same way `.codex/rules/*.rules`
  and `.codex/config.toml` already were).
- This document and the hook layer it describes make no application-
  behavior changes: nothing here modifies `freeforge/**`, `tests/**`
  (other than adding the new fixture file), `netlify.toml`, or CI
  workflows, and nothing is deployed.
