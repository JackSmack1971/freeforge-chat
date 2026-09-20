---
name: using-git-worktrees
description: Create and verify an isolated Git worktree before parallel or branch-isolated implementation work.
compatibility: Requires Git and Python 3.11+; setup commands are detected but never evaluated through a shell string.
---

# Using Git Worktrees

Use this skill only when isolation is requested or parallel implementation genuinely needs it. First detect `.worktrees/` or `worktrees/`, then verify ignore status, construct a branch path, create the worktree, optionally run the project's existing setup, and run its existing baseline tests. Stop with structured output on a missing Git repository, branch collision, setup failure, or test failure.

The portable helper exposes the former actions as subcommands:

```text
python scripts/worktree.py detect
python scripts/worktree.py path --location .worktrees --branch feature/name
python scripts/worktree.py create --path <path> --branch feature/name
python scripts/worktree.py setup --path <path>
python scripts/worktree.py test --path <path>
python scripts/worktree.py verify-ignore --dir .worktrees
```

The current workspace is not a Git repository, so this skill must report that fact rather than create metadata or silently fall back to a copy.

