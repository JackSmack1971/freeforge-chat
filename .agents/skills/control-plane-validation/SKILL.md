---
name: control-plane-validation
description: Canonical workflow for validating changes to this repository's control plane — establishes Git baseline, classifies each changed path by owning plane, checks current official Codex docs for format drift, runs tools/control-plane/verify.mjs and syntax/unit tests for changed scripts, inspects git diff --check, and reports exact diff scope while distinguishing tested evidence from assumptions. Use whenever work touches AGENTS.md, .codex/**, .agents/**, .claude/**, control-plane tooling (tools/control-plane/**), source-control governance, CI governance (.github/workflows/**), or production-policy documentation (docs/control-plane/**, netlify.toml).
---

# Control Plane Validation

## Contents

1. Objective
2. Authority statement (non-negotiable)
3. Trigger scope
4. Workflow
5. Owning-plane classification
6. Evidence and status vocabulary
7. Failure handling
8. Resources

## 1. Objective

Prove — with fresh, on-disk evidence — that a change touching this
repository's control plane is structurally sound and correctly scoped,
without ever implying that a passing check authorizes shipping it. This
skill produces a validation report; it does not implement fixes, and it
never pushes, merges, or deploys.

The default deliverable is:

- a Git baseline (branch, HEAD, dirty-state inventory);
- a per-path plane classification for every changed file;
- a Codex-docs drift check for any changed Codex-native file format;
- a `tools/control-plane/verify.mjs` run;
- syntax/unit-test evidence for changed scripts;
- a `git diff --check` inspection;
- an exact diff-scope report;
- an explicit evidence-vs-assumption breakdown;
- a release-readiness statement that is blocked, not guessed, when
  required checks are unavailable.

## 2. Authority statement (non-negotiable)

State these explicitly in every report this skill produces, not just once
at skill-authoring time:

- **Skills are workflow knowledge, not permission grants.** This skill
  tells you *how* to validate a control-plane change once you are already
  permitted to look at and edit those files. It does not itself authorize
  any tool call, write, commit, or publication.
- **Hooks are guardrails, not complete authorization.** A hook firing (or
  not firing) is not proof that an action is safe or approved.
- **Tests passing does not authorize push, merge, or deploy.** A green
  `tools/control-plane/verify.mjs` run, a green Biome check, or a green
  `node --test` run is evidence (§1.11 of the migration contract), not
  approval (§1.5). Approval is a separate, human act.
- **`main` publication triggers Netlify production.** Merging to `main` is
  an automatic, public production deploy with no separate gate
  (`netlify.toml` has no branch/context restriction). Treat it with
  release-action weight every time, regardless of what this skill reports.

Full rationale: [references/topology.md](references/topology.md), "Authority
statement" section.

## 3. Trigger scope

Run this skill when a task touches any of:

- `AGENTS.md`, `.agents/**`, `.codex/**`, `.claude/**`;
- `tools/control-plane/**` (the verifier itself);
- CI governance: `.github/workflows/**`;
- production-policy documentation: `docs/control-plane/**`, `netlify.toml`;
- `security/constitution.md` (machine-readable security invariants that
  `AGENTS.md` restates in prose).

If the task touches none of these, this skill does not apply — do not run
it defensively on unrelated product-code changes.

## 4. Workflow

Copy and maintain this checklist for the current change:

```text
Control Plane Validation Progress
- [ ] 1. Establish Git baseline and dirty state
- [ ] 2. Identify owning plane for each changed path
- [ ] 3. Check current official Codex docs for format drift (if applicable)
- [ ] 4. Run tools/control-plane/verify.mjs
- [ ] 5. Run syntax/unit tests for changed scripts
- [ ] 6. Inspect git diff --check
- [ ] 7. Report exact diff scope
- [ ] 8. Distinguish tested evidence from assumptions
- [ ] 9. State release-readiness honestly (block the claim if unverifiable)
```

### Step 1: Git baseline and dirty state

Do not trust a prior summary, `.planning/**` artifact, or this skill's own
reference files for current state — re-derive it:

```bash
git status --porcelain=v1
git rev-parse HEAD
git rev-parse --abbrev-ref HEAD
```

Or let the bundled script do it (see Step 4 — it captures the same baseline
as part of one evidence object).

### Step 2: Identify owning plane for each changed path

Classify every changed path against
[references/topology.md](references/topology.md)'s plane map. A path that
matches no row is out of this skill's scope — note it, do not force-fit a
plane onto it. Watch specifically for a single diff that touches two planes
in a way that collapses their separation (e.g. a rule file edit that also
adds executable logic, or a skill edit that also changes a permission
allowlist) — that is exactly the failure mode
`docs/control-plane/MIGRATION_CONTRACT.md` §3.3 calls out, and it is a
finding to surface, not silently pass through.

`scripts/run-checks.mjs` (Step 4) performs this classification
automatically and includes it in its JSON output under `diffScope`.

### Step 3: Check current official Codex docs for format drift

Only required when the diff touches a Codex-native file format:
`.codex/config.toml`, `.codex/hooks.json`, `.codex/rules/*.rules`,
`.codex/agents/*.toml`, or `.codex/workflows/**`. `tools/control-plane/verify.mjs`
validates these files against this repository's *current understanding* of
their grammar (see its embedded TOML/execpolicy parsers) — it cannot detect
that Codex CLI's actual contract for one of these formats changed upstream.

When applicable, fetch the current official Codex CLI documentation for the
specific format(s) touched and compare against what
`tools/control-plane/verify.mjs` currently enforces. If network access is
unavailable, do not silently skip this — record it as **UNVERIFIED** (see
[references/evidence-schema.md](references/evidence-schema.md)) and carry
that into Step 9's release-readiness statement.

When not applicable (the diff doesn't touch a Codex-native format), record
that this step was correctly skipped and why — do not spend a network call
proving a negative.

### Step 4: Run `tools/control-plane/verify.mjs`

Run the bundled deterministic script, which wraps `verify.mjs` and adds
Steps 1, 2, 6, and 7 of this workflow in one evidence object:

```bash
node .agents/skills/control-plane-validation/scripts/run-checks.mjs
```

Or run the verifier directly if you only need its own checks:

```bash
node tools/control-plane/verify.mjs
```

Read every FAIL, including non-authoritative/informational ones (the
Claude-compatibility check is informational by design — see
`tools/control-plane/verify.mjs`'s own comments — but still worth reporting
if it fails). Never treat a SKIPPED check as a PASS.

### Step 5: Run syntax/unit tests for changed scripts

`scripts/run-checks.mjs` syntax-checks (`node --check`) every changed
`.js`/`.mjs`/`.cjs` file inside a recognized control-plane plane and reports
the results under `syntaxCheck`. This proves the file parses — it is not a
substitute for running its actual tests. Separately:

- if the change touches `tools/control-plane/verify.mjs` or anything it
  imports, also run whatever test suite currently covers it (check
  `tests/AGENTS.md` and `tests/security/` for a matching file — e.g.
  `tests/security/codex-config.test.mjs` covers `.codex/config.toml`
  parseability);
- if no test currently covers a changed control-plane script, say so
  explicitly rather than reporting untested code as verified.

### Step 6: Inspect `git diff --check`

```bash
git diff --check
git diff --cached --check
```

`scripts/run-checks.mjs` runs both and classifies the result: real conflict
markers (`<<<<<<<`, `=======`, `>>>>>>>` at line start) are an authoritative
failure; trailing-whitespace-only findings are informational (this
repository has a known pre-existing trailing-whitespace finding in
`.repository-hygiene/report.md` — do not treat that class of finding as
blocking by default, but do report it).

### Step 7: Report exact diff scope

State precisely which paths changed, their Git status code, and their
plane — not a paraphrase ("some control-plane files changed"). Use
`diffScope.byPlane` from the script output directly; it is already grouped
correctly. Call out `outOfScopeCount` if non-zero so the reader knows the
report is deliberately narrowed to control-plane paths, not silently
incomplete.

### Step 8: Distinguish tested evidence from assumptions

Apply [references/evidence-schema.md](references/evidence-schema.md)'s
evidence-vs-assumption rule to every claim in the report: a claim is
**evidence** only if it is backed by this session's own script/tool output
or a freshly fetched doc; anything sourced from
`docs/control-plane/CURRENT_STATE.md`, `MIGRATION_CONTRACT.md`, a prior
summary, or this skill's own reference files is a **hypothesis** until
re-confirmed in this session.

### Step 9: State release-readiness honestly

Follow [references/evidence-schema.md](references/evidence-schema.md)'s
"Blocking a release-ready claim" section. In particular: if Step 3 was
required and could not be performed, or `tools/control-plane/verify.mjs`
could not run at all, do not say the change is "ready" — say what is
unverified and why, plainly, in the same report.

## 5. Owning-plane classification

Full plane map, target topology, and authority statement:
[references/topology.md](references/topology.md).

## 6. Evidence and status vocabulary

Full JSON shape for `scripts/run-checks.mjs`, the PASS/FAIL/SKIPPED/UNVERIFIED
vocabulary, and the evidence-vs-assumption rule:
[references/evidence-schema.md](references/evidence-schema.md).

## 7. Failure handling

- `tools/control-plane/verify.mjs` fails to load or throws: report it as a
  tool failure (not a SKIPPED sub-check) and block any release-readiness
  claim — do not fall back to reasoning about control-plane correctness
  from memory.
- Codex docs are unreachable for Step 3: mark that specific claim
  UNVERIFIED, do not treat the rest of the report as invalidated, and do
  not silently drop the step from the checklist.
- A changed path does not match any plane rule: report it explicitly as
  unclassified rather than guessing a plane or omitting it from the diff
  scope.
- `git diff --check` reports real conflict markers: stop and resolve them
  before any further validation — a diff with conflict markers is not in a
  reviewable state.
- No test currently covers a changed control-plane script: report that gap
  by name; do not report the script as verified because it parses.

## 8. Resources

Load only what the current step requires:

- Plane ownership map, target topology, authority statement:
  [references/topology.md](references/topology.md)
- Evidence JSON shape, status vocabulary, evidence-vs-assumption rule,
  release-readiness gating: [references/evidence-schema.md](references/evidence-schema.md)
- Deterministic evidence collector (wraps `tools/control-plane/verify.mjs`):
  [scripts/run-checks.mjs](scripts/run-checks.mjs)
- Underlying cross-runtime verifier (not owned by this skill — read, don't
  fork it): `tools/control-plane/verify.mjs`
- Full migration contract this skill operationalizes:
  `docs/control-plane/MIGRATION_CONTRACT.md`
- Point-in-time baseline the contract was derived from:
  `docs/control-plane/CURRENT_STATE.md`

Before treating this skill itself as validated after an edit, run:

```bash
node .agents/skills/control-plane-validation/scripts/run-checks.mjs
node tools/control-plane/verify.mjs
```

and confirm the `agents-skills:control-plane-validation` check reports
PASS (valid `name`/`description` frontmatter) and that neither run reports
this skill's own files as `.gitignore`-hidden. Only report **Done &
Verified** when that fresh run backs the claim — not this file's own
memory of a prior run.
