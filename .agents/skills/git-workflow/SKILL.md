---
name: git-workflow
description: Use when performing any Git action, including status inspection, branching, synchronization, staging, committing, merging, rebasing, pushing, deleting refs, resolving conflicts, or recovering from a failed command.
compatibility: Requires Git and a filesystem-readable repository when Git actions are requested.
---

# Git Workflow

Preserve user work, history, and reviewability. Inspect first, keep actions
within the requested scope, and prefer reversible operations.

## Repository state

- Follow repository conventions from `CONTRIBUTING*`, `AGENTS.md`, project
  rules, pull-request templates, and recent history.
- Before editing, inspect the repository root, `git status --short --branch`,
  current branch, and relevant recent history.
- Before synchronization, branch changes, deletion, or remote work, inspect
  upstreams, remotes, and `git worktree list`.
- Stop and report detached HEAD, unresolved conflicts, or an active
  merge/rebase/cherry-pick/revert/bisect.
- Treat submodules, nested repositories, Git LFS, and generated artifacts as
  out of scope unless explicitly requested.
- Preserve pre-existing index and working-tree changes. Diff an already
  modified file before touching it; never overwrite, restore, reset, clean,
  stash, stage, or commit unrelated changes.

## Branching and synchronization

- Follow the repository's branch naming and base-branch conventions.
- Do not create or switch branches unless required. Verify current changes
  will not be carried, hidden, overwritten, or mixed into another branch.
- Do not work directly on a protected or default branch when the repository
  requires a pull-request branch.
- Prefer `git fetch` plus explicit comparison when remote freshness matters;
  use `git pull --ff-only` only when fast-forward-only synchronization is
  intended.
- If local and upstream history diverge, report ahead/behind state instead of
  choosing merge, rebase, reset, or force-push implicitly.
- Resolve conflicts file by file. Never blanket-accept `ours` or `theirs`.

## Changes and staging

- Keep each change set aligned to one coherent acceptance-criteria group.
- Stage explicit paths or hunks; avoid `git add -A`, `git add .`, and
  `commit -a` in a dirty or mixed-scope worktree.
- After staging, inspect status, the cached diff stat, the complete cached
  diff, and `git diff --check`.
- Investigate unexpected whitespace, line-ending, mode, rename, binary, or
  generated-file changes.
- Verify the staged snapshot contains no credentials, local environment files,
  debug artifacts, or unrelated changes.

## Verification and commits

- Run the repository's required tests, lint, format, type-check, build, and
  security checks before committing when applicable.
- Commit only when explicitly requested or when an established workflow
  clearly requires it.
- Use the documented commit convention, recent history, or otherwise a concise
  imperative subject.
- Commit only the reviewed staged snapshot. Do not amend, squash, fixup,
  rebase, rewrite author identity, or alter signing/trailers without explicit
  approval.
- After committing, report the hash, subject, scope, and verification run.

## Destructive local operations

Get explicit approval immediately before any operation that may discard work or
refs, including `reset --hard`, destructive `restore` or `checkout`, `clean`,
`branch -D`, stash deletion, reflog expiration, forced worktree removal, and
aggressive pruning.

Before approved destructive work, state exactly what may be lost and create a
recoverable checkpoint when practical. For `git clean`, run a dry run first.
Before deleting a branch, verify it is not checked out elsewhere and whether
its commits are merged or recoverable; prefer `-d` over `-D`.

Do not create, apply, drop, clear, or rewrite user stashes as a convenience.

## Remote operations

Push, force-push, remote ref deletion, pull-request creation or merge,
release, and deployment are explicit-request operations. Immediately before a
remote mutation, re-check status, branch, source and destination refs,
upstream, push URL, and transmitted commits. Use explicit refspecs and
`--dry-run` when practical.

Never use raw `--force`; an approved rewrite requires
`--force-with-lease=<ref>:<expected>` after verifying the expected remote
commit. Never bypass protections, required checks, signing, or rulesets.

## Failure handling

After a failed or unexpected Git command, stop further mutations and
re-inspect state. Do not auto-reset, clean, force-push, delete, or resolve in
response. Prefer the documented abort command when safe, and report partial
effects, remaining conflicts, and the safest next step.
