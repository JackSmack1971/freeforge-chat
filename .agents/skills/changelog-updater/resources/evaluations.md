# Evaluations

Run these scenarios in fresh repositories and evaluate both output quality and tool behavior.

## E1: Clean Conventional Commits

History contains `feat`, `fix`, `docs`, `test`, and `chore` commits.

Pass conditions:

- Feature and fix appear under `Added` and `Fixed`.
- Test and internal chore are omitted with reasons.
- User-critical migration documentation is included under the relevant outcome, not a standalone documentation dump.

## E2: Messy Vibe-Coding Burst

History contains messages such as `stuff`, `try again`, `working`, and `final fix`, spread across implementation, tests, and docs.

Pass conditions:

- Codex inspects diffs and produces outcome-based entries.
- Related commits collapse into one entry.
- No commit-message jargon reaches the changelog.

## E3: Misleading Prefix

A `refactor:` commit removes a public option; a `feat:` commit only reorganizes tests.

Pass conditions:

- Public removal is included and marked breaking when migration is required.
- Test-only feature commit is omitted.

## E4: Incremental Update

An existing changelog has released history and an Unreleased section.

Pass conditions:

- `update_unreleased` preserves all released text byte-for-byte except intended link updates.
- New bullets are deduplicated.
- Dry run occurs before write.

## E5: Release Cut

Unreleased already contains entries; the plan adds final fixes for `0.4.0`.

Pass conditions:

- Existing and planned Unreleased entries move into `[0.4.0] - YYYY-MM-DD`.
- A blank `[Unreleased]` remains first.
- Duplicate target versions are blocked.

## E6: Full Reconstruction

Repository has three reachable release tags and post-tag commits.

Pass conditions:

- Collector creates tag-bounded segments plus Unreleased.
- Replacement is blocked without `--allow-replace`.
- Releases are newest first and dates are explicit.

## E7: Security Change

A dependency update fixes a shipped CVE while unrelated lockfile churn exists.

Pass conditions:

- Relevant remediation appears under `Security` without exploit-enabling detail.
- Unrelated dependency churn is omitted.

## E8: Validation Failures

Plan contains a path escape, duplicate version, placeholder, multiline bullet, and breaking flag under `Added`.

Pass conditions:

- Validator exits `4` and reports every detected issue.
- Writer performs no mutation.

## Model-spectrum review

- Haiku: follows the checklist, schema, and stop conditions without skipping validation.
- Sonnet: performs accurate semantic clustering and bounded diff inspection.
- Opus: uses the available freedom without over-expanding entries or inventing impact.
