# Implementation Plan Specification

## Contents

- [File layout](#file-layout)
- [Plan template](#plan-template)
- [Index template](#index-template)
- [Quality gates](#quality-gates)

## File layout

Use the selected output directory:

```text
plans/
├── README.md
├── 001-short-slug.md
└── 002-short-slug.md
```

Number plans in recommended execution order. Keep numbers monotonic across runs. One plan addresses one independently reviewable outcome.

## Plan template

```markdown
# Plan NNN: <Outcome-oriented title>

> Follow this plan in order. Run every verification gate. Touch only in-scope
> files. Stop on any listed STOP condition instead of broadening scope.

## Status

- **Finding ID**: SEC-001
- **Type**: corrective | investigation | direction-spike
- **Priority**: P0 | P1 | P2 | P3
- **Leverage**: 0.0–100.0
- **Effort**: S | M | L
- **Implementation risk**: LOW | MED | HIGH
- **Depends on**: none | plan paths
- **Planned at**: full 40-character git SHA
- **State**: TODO

## Outcome

State what will be true after completion and why it matters. Preserve the
finding's concrete impact without overstating certainty.

## Evidence and current behavior

- `path/file.ts:84-101` — `symbolName`: verified observation.
- Relevant convention: `path/exemplar.ts:20-55` demonstrates the pattern to match.
- Applicable decision: `docs/adr/0007.md` requires <constraint>.

Use minimal excerpts only when symbol/path anchors are ambiguous. Never include
credentials or large copied source blocks.

## Assumptions

- [ASSUMPTION] <fact established from repository evidence>
- [TODO] <unresolved decision only when the plan is intentionally an investigation>

Corrective plans must not contain unresolved TODOs that change implementation.

## Scope

**In scope**
- `exact/path.ts`
- `exact/new-test.ts` (create)

**Out of scope**
- `related/path.ts` — reason.
- Public API/schema changes unless explicitly listed.

## Implementation constraints

- Preserve <behavior/API/compatibility constraint>.
- Match <named repository convention>.
- Do not add dependencies unless explicitly approved in this plan.

## Steps

### Step 1: <Imperative action>

Exact files, symbols, intended code shape, and bounded decision rules.

**Verify**: `<command>`
**Expected**: exit code and observable result.

### Step 2: <Imperative action>

...

**Verify**: `<command>`
**Expected**: ...

## Test plan

- Test file and cases: happy path, original regression, named boundaries.
- Existing exemplar test to follow.
- Required command and expected result.

## Verification matrix

| Gate | Command | Expected | Required |
|---|---|---|---|
| Focused tests | `<command>` | all pass | yes |
| Typecheck/build | `<command>` | exit 0 | yes |
| Full regression | `<command>` | all pass or documented bounded exception | yes |
| Scope check | `git diff --name-only` | only in-scope paths | yes |

## Rollback or containment

Required for MED/HIGH-risk changes and migrations. State how to revert, disable,
or contain the change without data loss. For LOW-risk plans, state `Not required`
with one-line reasoning.

## Done criteria

- [ ] All required verification gates pass.
- [ ] Tests cover the original failure or decision risk.
- [ ] No file outside scope changed.
- [ ] No unresolved placeholder or corrective-plan TODO remains.
- [ ] Plan status is updated by the executor/reviewer.

## STOP conditions

- The live code no longer matches the evidence anchors or has uncommitted in-scope changes.
- A required verification command fails twice after one bounded correction.
- The solution requires an out-of-scope path, schema, dependency, or product decision.
- <plan-specific false assumption or risk threshold>.

## Review focus

Name the invariants, security properties, migration concerns, or test quality a
reviewer must scrutinize.

## Deferred work

List deliberately excluded follow-ups and why they do not block this outcome.
```

Drift preflight for an executor:

```bash
git cat-file -e <planned-sha>^{commit}
git diff --stat <planned-sha>..HEAD -- <in-scope-paths>
git diff --stat -- <in-scope-paths>
git status --short -- <in-scope-paths>
```

Any unreviewed in-scope change is a STOP condition.

## Index template

```markdown
# Implementation Plans

Generated from a verified audit at commit `<full SHA>`. Execute in dependency
order. Status values: TODO | IN_PROGRESS | DONE | BLOCKED | REJECTED | SUPERSEDED.

## Audit coverage

- Effort and categories:
- Packages/paths audited:
- Explicit exclusions:
- Verification commands run/skipped:

## Execution order

| Plan | Finding | Title | Priority | Leverage | Effort | Depends on | Status |
|---|---|---|---|---:|---|---|---|
| 001 | SEC-001 | ... | P0 | 82.5 | M | — | TODO |

## Dependency notes

- `002` follows `001` because ...

## Considered and rejected

- `ARCH-004` — rejected because ...

## Superseded plans

- `plans/000-old.md` → superseded by `plans/003-new.md` because ...
```

## Quality gates

Before finishing each plan:

- The plan can be executed from the repository plus this file alone.
- Every step names exact paths/symbols and has a command plus expected result.
- Scope is narrow enough for one reviewable change.
- Corrective plans have no implementation-changing TODOs.
- STOP conditions are specific, not boilerplate only.
- MED/HIGH-risk work has rollback or containment.
- Evidence was re-opened by the primary advisor.
- `validate_plan.py` and `scan_sensitive_output.py` pass.
