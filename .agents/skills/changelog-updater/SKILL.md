---
name: changelog-updater
description: Analyzes Git commit history for full CHANGELOG.md reconstruction, incremental updates since a tag, date or revision ranges, and release-note preparation. Semantically infers user-facing Added, Changed, Deprecated, Removed, Fixed, and Security entries from clean or messy commit messages; inspects diffs when intent is ambiguous; filters merges, tests, refactors, dependency churn, CI, and other internal noise unless impact is user-visible; follows Keep a Changelog conventions; and safely plans, validates, previews, writes, or updates CHANGELOG.md.
---

# Changelog Updater

Turn repository history into a concise, user-facing `CHANGELOG.md`. Codex performs semantic synthesis; bundled scripts perform deterministic collection, validation, mutation, and verification.

## Contents

- [Operating rules](#operating-rules)
- [Workflow](#workflow)
- [Mode selection](#mode-selection)
- [Semantic classification](#semantic-classification)
- [Commands](#commands)
- [Completion gate](#completion-gate)
- [Resources](#resources)

## Operating rules

1. Work from the repository root. Never invent commits, versions, dates, links, or impact.
2. Treat commit messages as evidence, not truth. Use file paths, stats, nearby commits, tags, and selective `git show` inspection to recover intent.
3. Write for users, operators, integrators, and maintainers—not for the author of the commit.
4. Prefer one outcome-oriented entry over several implementation-level entries for the same change.
5. Omit internal-only noise unless it changes supported behavior, security, compatibility, performance, packaging, deployment, or documented usage.
6. Do not modify `CHANGELOG.md` until a plan validates and a dry run has been reviewed.
7. Preserve existing released history during incremental operations. Full replacement requires explicit reconstruction mode and `--allow-replace`.
8. Use ISO dates (`YYYY-MM-DD`) and Keep a Changelog section names.
9. When evidence is insufficient, inspect the diff. If ambiguity remains, use conservative wording or omit the entry and record the reason.
10. Do not claim completion until post-write verification passes.

## Workflow

Copy and maintain this checklist:

- [ ] Resolve repository root and requested mode
- [ ] Read existing `CHANGELOG.md`, `README*`, release/version files, and relevant style guidance
- [ ] Collect bounded history into `.changelog/history.json`
- [ ] Inspect ambiguous, breaking, security-sensitive, or high-impact commits
- [ ] Create `.changelog/plan.json` using the plan schema
- [ ] Validate the plan; fix and repeat until valid
- [ ] Run a dry-run update and review the rendered diff
- [ ] Apply only after the preview matches intent
- [ ] Verify the resulting changelog; fix and repeat until valid
- [ ] Report included range, included/omitted counts, assumptions, and verification evidence

### 1. Establish context

Run `git status --short`, identify the repository root, and inspect existing changelog conventions. Detect the project version source when preparing a release. Respect user-supplied date, revision, version, and voice constraints.

Stop if the directory is not a Git worktree. Do not silently initialize a repository.

### 2. Collect history

Create a workspace and run the collector. It does not decide what belongs in the changelog; its hints are only triage aids.

```bash
mkdir -p .changelog
python3 <skill-dir>/scripts/collect_history.py \
  --repo . \
  --mode since-tag \
  --output .changelog/history.json
```

Read the JSON summary first, then analyze release segments and commits. For ambiguous entries, inspect only the necessary commits:

```bash
git show --stat --summary <commit>
git show --format=fuller --find-renames --find-copies <commit> -- <relevant-paths>
```

Do not load large patches indiscriminately. Inspect likely public API, configuration, schema, migration, CLI, authentication, dependency-security, and user-interface changes first.

### 3. Build the semantic plan

Read [resources/semantic-rules.md](resources/semantic-rules.md) and [resources/plan-schema.md](resources/plan-schema.md). Create `.changelog/plan.json` with:

- the requested action;
- source range and target version/date;
- release sections and synthesized entries;
- source commit IDs for traceability;
- omitted commits with short reasons;
- optional comparison links.

Entry text must be release-ready: imperative fragments are discouraged; implementation trivia, commit prefixes, ticket-only labels, and raw filenames are usually removed.

### 4. Validate, preview, and apply

```bash
python3 <skill-dir>/scripts/validate_plan.py .changelog/plan.json
python3 <skill-dir>/scripts/apply_changelog.py \
  --repo . \
  --plan .changelog/plan.json \
  --dry-run
```

Review the preview. Fix the plan rather than hand-editing generated output whenever possible.

Apply incrementally:

```bash
python3 <skill-dir>/scripts/apply_changelog.py \
  --repo . \
  --plan .changelog/plan.json \
  --write
```

Full reconstruction is destructive and requires the explicit gate:

```bash
python3 <skill-dir>/scripts/apply_changelog.py \
  --repo . \
  --plan .changelog/plan.json \
  --write \
  --allow-replace
```

The writer uses an atomic replacement and creates `CHANGELOG.md.bak` by default when replacing an existing file.

### 5. Verify

```bash
python3 <skill-dir>/scripts/verify_changelog.py CHANGELOG.md

git diff --check -- CHANGELOG.md
git diff -- CHANGELOG.md
```

If verification fails, repair the plan or changelog and rerun all relevant checks. Stop after repeated failure and report the exact errors; do not claim success.

## Mode selection

Use the narrowest mode that satisfies the request:

| User intent | Collector mode | Plan action |
| --- | --- | --- |
| Reconstruct missing/stale history | `full` | `reconstruct` |
| Update after recent work | `since-tag` or `range` | `update_unreleased` |
| Weekly/monthly summary | `dates` | `update_unreleased` or render-only summary |
| Prepare release `vX.Y.Z` | `since-tag` or `range` | `release` |
| Generate release body without editing | any bounded mode | validate plan, then render dry-run only |

Defaults:

- “Since last tag” means the latest tag reachable from `HEAD`; if none exists, collect full history and state the fallback.
- Revision ranges are `FROM..TO`: `FROM` is exclusive and `TO` is inclusive.
- Date bounds use Git semantics and should be reported explicitly.
- Full mode creates tag-bounded release segments plus an Unreleased segment.
- Merge commits are excluded by default but their non-merge commits remain available. Include merges only when the merge message carries unique release intent.

## Semantic classification

Use official Keep a Changelog headings in this order:

1. `Added` — new user-visible capabilities
2. `Changed` — behavior, performance, UX, compatibility, or operational improvements
3. `Deprecated` — supported features scheduled for removal
4. `Removed` — removed behavior, APIs, options, or compatibility
5. `Fixed` — corrected defects or regressions
6. `Security` — vulnerability fixes, hardening with user impact, or security advisories

Represent breaking changes under the relevant section and prefix the entry with `**Breaking:**`. Do not create a nonstandard top-level category unless the user explicitly requires it.

Common mappings:

- Features → `Added`
- Improvements/refactors with external effect → `Changed`
- Bug fixes → `Fixed`
- Breaking removals → `Removed`; breaking behavior changes → `Changed`
- Security patches → `Security`
- Documentation → include only when it materially changes user guidance, migration, setup, or supported behavior
- Chores/tests/CI/dependencies → omit by default; include only when they alter shipped behavior, compatibility, security, packaging, or operator workflow

## Commands

```text
collect_history.py
  --mode full|since-tag|range|dates
  --from-ref REF --to-ref REF
  --since DATE --until DATE
  --include-merges --first-parent --no-files
  --max-commits N --output PATH

validate_plan.py PLAN.json

apply_changelog.py
  --plan PLAN.json --repo PATH
  --dry-run | --write
  [--allow-replace] [--no-backup]

verify_changelog.py CHANGELOG.md
```

All scripts use only Python 3 standard-library modules plus the installed `git` executable. They emit machine-readable JSON status and nonzero exit codes on failure. See [resources/cli-contracts.md](resources/cli-contracts.md).

## Completion gate

Completion requires all of the following:

- [ ] The analyzed range is explicit and reproducible
- [ ] Every included entry is supported by repository evidence
- [ ] Internal noise is omitted or justified
- [ ] Breaking and security changes received diff-level inspection
- [ ] `validate_plan.py` exits `0`
- [ ] Dry-run output was reviewed before mutation
- [ ] `verify_changelog.py` exits `0`
- [ ] `git diff --check -- CHANGELOG.md` exits `0`
- [ ] Final report states action, version/range, entry count, omission count, backup path, and any warnings

## Resources

Read only what the task needs; all references are one level from this file.

- [resources/semantic-rules.md](resources/semantic-rules.md) — evidence hierarchy, categorization, noise filtering, synthesis, and style
- [resources/plan-schema.md](resources/plan-schema.md) — strict plan structure and action semantics
- [resources/cli-contracts.md](resources/cli-contracts.md) — script arguments, outputs, and exit codes
- [resources/portability-security.md](resources/portability-security.md) — Codex desktop/API/Code deployment and safety notes
- [resources/evaluations.md](resources/evaluations.md) — representative acceptance tests and failure cases
- [templates/plan.example.json](templates/plan.example.json) — editable plan example

