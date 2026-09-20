---
name: github-issue-to-pr
description: Systematically convert open GitHub issues into focused pull requests with worktree isolation, planned execution, and state tracking.
---

# GitHub Issue-to-PR Processor

## Purpose

Systematically convert every open GitHub issue into a clean, focused Pull Request (or optimal grouped PR). Maintain strict one-issue-per-PR discipline unless explicit batching is approved.

## Core Rules

- Default: One issue = One PR
- Batching only allowed when issues share files or are part of the same atomic feature and have no conflicts
- Always use git worktree for isolation
- Human approval required at three gates: (1) Prioritization plan, (2) Post-implementation diff, (3) Pre-PR creation
- Every PR must link back to the original issue(s)
- Track all progress in `issue-processing-state.md`

## Workflow Phases

### Phase 1: Scan

Use GitHub MCP (preferred) or `gh issue list --json` to fetch all open issues.
Output a clean structured list with: number, title, labels, summary, dependencies, existing linked PRs.

### Phase 2: Analyze & Plan

Build dependency graph.
Cluster related issues.
Score each by: impact, effort, risk, age, user priority (from labels).
Produce:

- Recommended execution order
- Batching suggestions (with justification)
- Issues to skip and why
- Estimated number of PRs

**STOP HERE and wait for human approval of the plan.**

### Phase 3: Execute (One at a time or small batches)

For each approved item:

1. Create worktree + branch: `git worktree add ../worktrees/issue-XXX -b fix/issue-XXX`
2. Implement minimal, correct fix
3. Verify thoroughly (run tests, lint, reproduce original issue)
4. Commit cleanly
5. Present diff + verification results for human review
6. Only after approval: push and create PR with excellent description

### Phase 4: State Management

Maintain `issue-processing-state.md` with columns:

- Issue #
- Status (Planned / In Progress / PR Created / Done)
- PR #
- Notes / Batching decision

## Verification Checklist (run before every commit)

- [ ] Original issue behavior is fixed (repro steps pass)
- [ ] No unrelated changes
- [ ] Tests pass (or new tests added)
- [ ] Lint / typecheck clean
- [ ] Follows project coding standards (see AGENTS.md)
- [ ] PR description is clear and links issue(s)
- [ ] Branch is focused and small

## Invocation

User says: "Run github-issue-to-pr skill. Start with Phase 1 scan on this repo."
