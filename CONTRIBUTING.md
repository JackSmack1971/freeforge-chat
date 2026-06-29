# Contributing

FreeForge is a small static repo. Keep changes narrow and only touch files the issue or PR actually needs.

## Before You Start

- Check the open issue or open one if the work is not already tracked.
- Assign yourself and mark the issue in progress before editing.
- Comment the intended plan and target files on the issue.

## Workflow

- Use the smallest safe change.
- Prefer existing patterns over new abstractions.
- Keep repo-hygiene and control-plane changes isolated.
- Add tests when behavior changes.

## Commands

- `cd freeforge && npm test`
- `git status --short`
- `git branch --show-current`

## Pull Requests

- Link the PR to the source issue.
- Describe the change, verification, and rollback path.
- Keep the diff scoped to the issue.

## Ownership

- If you are the only maintainer available, assign the issue to yourself.
- If a future ownership map exists, follow `.github/CODEOWNERS`.
