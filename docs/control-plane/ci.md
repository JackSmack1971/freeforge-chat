# Control-Plane CI Workflow

Companion to `CURRENT_STATE.md`, `MIGRATION_CONTRACT.md`, and `policy-map.md`.
Scoped to `.github/workflows/control-plane.yml`: what it runs, why, and the
branch-protection step this document intentionally does not take.

## What it runs

| Goal requirement | Step | Mechanism |
|---|---|---|
| `node tools/control-plane/verify.mjs` | "Run control-plane verifier (authoritative)" | Runs the script directly; its own exit code (non-zero iff an authoritative check FAILs) fails the step. |
| Control-plane unit/fixture tests | "Run control-plane unit/fixture tests" | `node --test tests/control-plane/*.test.mjs` (verifier fixtures, handoff, snapshot). |
| JSON/TOML/script syntax checks | "Run control-plane verifier" (TOML: `.codex/config.toml`, `.codex/agents/*.toml`) + "Run Codex control-plane security tests" (`tests/security/codex-config.test.mjs`, TOML) + "Check JSON and script syntax under the control plane" (JSON via `JSON.parse`, `.js`/`.mjs` via `node --check`) | Split across three steps rather than reimplementing a second TOML parser — see that step's inline comment. |
| Skill metadata checks | "Run control-plane verifier" | `checkAgentsSkills()` validates every `.agents/skills/<name>/SKILL.md` has non-empty `name`/`description` frontmatter. |
| Custom-agent schema checks | "Run control-plane verifier" | `checkCodexAgentsToml()` validates every `.codex/agents/*.toml` has `name`/`description`/`developer_instructions`, a valid `sandbox_mode` enum value when present, and unique `name` values. |
| Hook fixture tests | "Run Codex control-plane security tests" | `tests/security/codex-hooks.test.mjs` exercises every `.codex/hooks/*.js` script against fixture stdin payloads. |
| Rule validation (installed Codex tooling, or a marked fallback) | "Run control-plane verifier" | `checkCodexRules()` runs live `codex execpolicy check` cases when the Codex CLI binary is present; otherwise it emits an explicit `SKIPPED` check (never a silent `PASS`) with the reason. The human-readable verifier output — including every `SKIPPED` line — is copied into the job's step summary by "Publish control-plane verifier summary", so an unsupported check is visible in the Actions UI without opening raw logs. |
| `git diff --check` where appropriate | "Check diff for conflict markers and whitespace errors" | Runs against the actual change set (PR base SHA, or the pre-push SHA for a direct push), not against a no-op clean checkout; no-ops (does not fail) when no usable base revision exists, e.g. a branch's first push. |

## Why the old `.claude/hooks/validators/control-plane-check.js` step is gone from `node-tests.yml`

That script only understood `.claude/**` shapes (agent frontmatter, slash
commands, output styles) and is not authoritative for this repository's
Codex-native control plane (see `MIGRATION_CONTRACT.md` section 1.8 and
`tools/control-plane/verify.mjs`'s own header comment). `node-tests.yml` no
longer runs it as a gate. `tools/control-plane/verify.mjs` preserves the same
logic, condensed, as `runClaudeCompatibilityCheck()` — informational only,
never affecting this workflow's exit code — so Claude Code compatibility is
still checked when `.claude/**` happens to be present on disk, without being
treated as the authoritative Codex gate.

`node-tests.yml` and `biome-check.yml` are unchanged by this workflow: this
repository's application Node tests and Biome lint remain independent gates,
each in its own workflow file, on the same trigger set.

## No deployment action

This workflow performs no build, publish, or deploy step of any kind, and no
step here can trigger one. Netlify's own git-integration auto-deploys `main`
independently of GitHub Actions (`MIGRATION_CONTRACT.md` section 3.8).

## Required-check name for branch protection (documentation only — not applied)

Workflow name: `Control Plane`. Job id: `control-plane`. GitHub reports a
workflow job's status check as `<workflow name> / <job name>`, so the
required-check name to add to this repository's branch-protection rule for
`main` is:

```
Control Plane / control-plane
```

This is documentation of intent only. Adding it to branch protection requires
repository admin access and a deliberate, explicit action outside this
repository's file tree (GitHub Settings → Branches, or the equivalent API
call); this document does not perform that action and no automation in this
repository is authorized to perform it without explicit human approval.
