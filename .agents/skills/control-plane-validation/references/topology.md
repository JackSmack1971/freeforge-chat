# Control-plane topology and plane ownership

This is reference material for the `control-plane-validation` skill. Load it
when you need to know *which plane a changed path belongs to* or *why that
distinction matters*. It restates and condenses
`docs/control-plane/MIGRATION_CONTRACT.md` §1–2 — that document is the
source of truth; this file exists so the skill does not require re-reading
the full contract on every invocation. If the two disagree, re-derive from
`docs/control-plane/MIGRATION_CONTRACT.md` and the live tree, not from this
file's memory of it.

## Why plane separation matters

The migration contract identifies nine dimensions that must stay visibly
separate: behavioral policy, execution policy, capabilities/tool
availability, runtime execution, approvals, skills, subagents, hooks, and
source-control authority — plus Netlify production publication and
verification/evidence as their own concerns. Collapsing two of these into
one artifact (a rule file that also executes, a Skill that also grants
permission) recreates the ambiguity the control plane exists to prevent.
Step 2 of this skill's workflow — "identify owning plane for each change" —
exists to catch that collapse before it lands, not to file paths for their
own sake.

## Plane → path ownership map

This table is the prose form of `PLANE_RULES` in
[`../scripts/run-checks.mjs`](../scripts/run-checks.mjs), which is the
executable source of truth. Keep both in sync by hand; if you add a path
pattern here, add the matching regex there too (and vice versa).

| Plane | Paths | What it governs |
| --- | --- | --- |
| `behavioral-policy` | `AGENTS.md`, `tests/AGENTS.md`, `.agents/AGENTS.md` | What an agent should decide to do — style, roles, definition-of-done. Text-only; carries no enforcement power by itself. |
| `skills` | `.agents/skills/**` | Reusable, invokable procedures. Must never be the thing that grants a permission — see "Skills are workflow knowledge, not permission grants" below. |
| `codex-runtime` | `.codex/config.toml`, `.codex/hooks.json`, `.codex/rules/**`, `.codex/agents/**`, `.codex/hooks/**`, `.codex/workflows/**`, `.codex/skills/**` | Codex CLI-native execution policy and runtime-execution mechanisms — real only if Codex CLI's runtime actually interprets that file format. |
| `legacy-claude-runtime` | `.claude/**` (removed from disk) | Formerly Claude-Code-native runtime execution (hooks, subagents, slash commands, settings). Disposition is resolved: `.claude/**` was deleted as part of this migration and is not part of the target topology. `.codex/hooks/**` and `.codex/agents/**` are the Codex-native replacements (see `docs/control-plane/hooks-policy-map.md`); `CLAUDE.md` remains only as a thin adapter pointing at `AGENTS.md`. A path under `.claude/` appearing in a diff again is itself a finding, not routine control-plane maintenance. |
| `ci-governance` | `.github/workflows/**` | The only automated, independent verification boundary in this repository. Treat edits with the same scrutiny as any other control-plane change. |
| `security-invariants` | `security/constitution.md` | Machine-readable must/must-not rules (CWE/OWASP-tagged). `AGENTS.md`'s "Repository invariants" section restates these in prose — the two must keep agreeing. |
| `control-plane-evidence` | `docs/control-plane/**` | What proves a change is correct, distinct from what authorizes shipping it. Baseline/contract documents live here. |
| `production-publication` | `netlify.toml` | The one place a Git operation (merge to `main`) has a direct, automatic, irreversible external effect with no separate gate. |
| `control-plane-tooling` | `tools/control-plane/**` | The deterministic, cross-runtime verifier (`verify.mjs`) this skill's step 4 runs. Read-only by construction; changes here change what "PASS" means, so review them at least as carefully as the planes they check. |

A changed path that matches none of these rows is outside this skill's
trigger scope — do not force a plane assignment onto it.

## Target topology (from `MIGRATION_CONTRACT.md` §2)

```
.codex/                      Codex CLI runtime-native mechanisms only
  rules/                     Codex-native behavioral/execution-scoped rules
  skills/                    Codex-native skills only, once ported
  workflows/                 Only if/when Codex CLI has a matching native
                              primitive for what a workflow script does
.agents/                     Cross-tool / project-level control-plane content
  AGENTS.md                  Scope statement for this directory
  skills/**                  Codex/cross-tool skill set (this skill included)
AGENTS.md                    Root behavioral-policy document
tests/AGENTS.md               Local behavioral policy for tests/
security/constitution.md      Machine-readable security invariants
docs/control-plane/           Baseline + migration contract (source of truth
                              for the migration itself)
```

`.claude/**` is not part of the target topology. Its disposition (previously
an open question per `MIGRATION_CONTRACT.md` §5 item 4) is resolved: it has
been deleted from disk. Do not re-add content under `.claude/**` as a side
effect of running this skill — new control-plane content belongs under
`.codex/` or `.agents/`, per the target topology above.

## Authority statement (restated from `MIGRATION_CONTRACT.md` §3, non-negotiable)

- **Skills are workflow knowledge, not permission grants.** A Skill (this one
  included) is a packaged procedure invoked once a tool call is already
  permitted. If a skill appears to expand what an agent may do — e.g. by
  instructing it to bypass an `ask` gate, or by embedding credentials/scopes
  — that skill is malformed under the migration contract regardless of
  intent.
- **Hooks are guardrails, not complete authorization.** Hooks
  (`.codex/hooks/**`) are runtime-triggered side effects with a specific
  trigger model. They can block an obviously bad action; their absence,
  silence, or a green run through them is not itself authorization for
  anything downstream.
- **Tests passing does not authorize push, merge, or deploy.** Per migration
  invariant 3.7: `node --test tests/security/*.test.mjs`, Biome, and this
  skill's own checks are evidence, not approval. Nothing in this
  repository's tooling auto-commits or auto-merges on a green run, and this
  skill must never be used to imply otherwise.
- **`main` publication triggers Netlify production.** `netlify.toml`
  configures `publish = "freeforge"` with no branch/context restriction, and
  the repository's Netlify git-integration default is to auto-deploy the
  linked production branch. A merge to `main` is not a neutral Git
  operation — treat it with the same weight as a manual deploy/release
  action under `AGENTS.md`'s Release-operator role, requiring explicit human
  authorization each time, never implicit authorization from this skill's
  checks passing.
