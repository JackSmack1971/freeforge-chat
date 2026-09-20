---
name: source-control-unit-of-work
description: Use when any task touches Git state - editing, staging, committing, pushing, opening/merging a PR, tagging a release, or deploying - to make that state an explicit, auditable engineering contract instead of implicit agent prose.
compatibility: Requires Git and a filesystem-readable repository. Assumes no automatic commit or external write is authorized by loading this skill alone.
---

# Source Control Unit of Work

Loading this skill authorizes nothing by itself. It does not commit, push,
open a PR, merge, tag, or deploy. Every boundary below still needs the
authorization that boundary itself normally requires (explicit user request,
or a project rule that pre-authorizes it).

## Model

```
UnitOfWork = known baseline + intended delta + verification evidence + change-management state
```

A unit of work is not "the diff." It is the full record of what state you
started from, what you meant to change, what you actually changed, what you
ran to prove it, and where that work currently sits in the publication
pipeline. Treat this as a structured object you populate and keep current
through the task, not a narrative you reconstruct at the end.

## Required fields

Populate these from direct inspection (`git status`, `git rev-parse`,
`git diff`, `git branch`, `git worktree list`) — never from memory, prior
summaries, or assumption:

- **Baseline commit SHA** — `git rev-parse HEAD` at task start, captured
  before any edit.
- **Branch / worktree identity** — current branch name, and which worktree
  (main checkout or a dedicated one) the work happens in.
- **Initial dirty-state inventory** — full `git status --short` snapshot
  taken before any edit, so pre-existing modified/untracked/deleted paths are
  known and attributable to prior work, not to this task.
- **Intended paths** — the specific files/dirs this task is authorized to
  touch, stated before editing begins.
- **Unrelated paths to preserve** — everything in the dirty-state inventory
  that is *not* an intended path. These are named explicitly, not left
  implicit.
- **Resulting diff scope** — `git diff` / `git status --short` after edits,
  compared against intended paths to confirm no drift.
- **Focused/full verification commands** — the narrowest command that
  exercises the changed surface, plus the full suite when the change or the
  project's rules warrant it; record what ran and its result.
- **Review target** — what a human or reviewer would look at (a diff, a
  branch, a PR) to evaluate this unit of work.
- **Commit identity if created** — resulting SHA, subject line, and the
  files actually included in that commit.
- **Publication state** — none / committed locally / pushed / PR opened / PR
  merged / released / deployed. State this precisely; do not conflate
  "committed" with "published."

## Rules

- **Unrelated dirty state is never silently staged or modified.** Diff any
  pre-existing modified file before touching it. Stage only the intended
  paths, by explicit path — never assume a broad `git status` clean-up is in
  scope.
- **Use a dedicated worktree** (see the `using-git-worktrees` skill) when
  independent concurrent work exists on this repo, or when the root checkout
  is already dirty with unrelated changes and isolation is needed to keep
  this unit of work's diff scope clean.
- **Never use `git add .`, `git add -A`, or `commit -a`.** Stage explicit
  paths or hunks only.
- **Git diff overrides agent prose.** If a summary, plan, or prior message
  disagrees with what `git diff` / `git status` actually shows, the diff is
  authoritative. Reconcile before proceeding, don't paper over it.
- **Edit, stage, commit, push, PR, merge, release, and deployment are
  distinct boundaries.** Completing one does not imply authorization for the
  next. Each needs its own explicit request or pre-authorization.
- **Conversation identity is not Git identity.** The person chatting with
  the agent is not automatically the Git author/committer; use the
  repository's configured Git identity, never infer one from chat metadata.
- **Do not force-push.** Not even `--force-with-lease`, unless the user
  explicitly authorizes that specific push with its expected target SHA.
- **Do not merge `main` merely because CI passes.** Green CI is necessary,
  not sufficient — merge/publication is a separate authorization boundary
  (see below).

## FreeForge production rule

In this repository, `main` is connected to the public Netlify deployment of
`freeforge/`. Any action that merges into `main`, or otherwise publishes
`freeforge/` (merge, direct push to `main`, release, redeploy), is
**production-impacting** and must be:

1. Explicitly reported as production-impacting before it happens — state
   what will become publicly live and when.
2. Explicitly authorized by the operator for that specific action. A prior
   approval for a different action (e.g. "commit this") does not extend to
   merge/publish.

Treat this rule as absolute for this repository regardless of how routine
the underlying change looks.

## Completion report schema

Emit this structure when closing out (or checkpointing) a unit of work, so
it can be captured for later audit:

```json
{
  "baseline_commit": "<sha>",
  "branch": "<name>",
  "worktree": "<main | path to dedicated worktree>",
  "initial_dirty_state": ["<path>: <status>", "..."],
  "intended_paths": ["<path>", "..."],
  "unrelated_paths_preserved": ["<path>", "..."],
  "resulting_diff_scope": ["<path>: <status>", "..."],
  "verification": {
    "focused_commands": ["<command>: <result>", "..."],
    "full_commands": ["<command>: <result>", "..."]
  },
  "review_target": "<diff | branch | PR URL>",
  "commit": {
    "created": false,
    "sha": null,
    "subject": null,
    "files": []
  },
  "publication_state": "none",
  "production_impact": {
    "applies": false,
    "reported_to_operator": false,
    "explicit_authorization": false
  },
  "limitations": []
}
```

Leave `commit` null-valued and `publication_state: "none"` unless a commit
or publish actually happened in this session. `production_impact.applies`
is `true` only when the action touches `main` or otherwise publishes
`freeforge/`; in that case both `reported_to_operator` and
`explicit_authorization` must be `true` before the action is taken, not
after.
