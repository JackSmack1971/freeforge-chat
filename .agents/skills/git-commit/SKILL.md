---
name: git-commit
description: Use when the user asks to create a Git commit, commit changes, generate a Conventional Commits message, or invoke `/commit`.
compatibility: Requires Git and a filesystem-readable repository.
---

# Git Commit

Create a focused, semantic Git commit using the Conventional Commits format.
Inspect the actual diff before choosing the message or staging files.

## Format

```text
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

Types:

| Type | Use for |
|---|---|
| `feat` | New functionality |
| `fix` | Bug fixes |
| `docs` | Documentation only |
| `style` | Formatting with no behavior change |
| `refactor` | Behavior-preserving code restructuring |
| `perf` | Performance changes |
| `test` | Tests |
| `build` | Build or dependency changes |
| `ci` | CI configuration |
| `chore` | Maintenance |
| `revert` | Reverting a commit |

Use `!` after the type or scope, or a `BREAKING CHANGE:` footer, for breaking
changes.

## Workflow

1. Load the `git-workflow` skill and follow its safety protocol.
2. Inspect `git status --short`, `git diff --staged`, and `git diff` as
   applicable. Determine whether the worktree is mixed or already staged.
3. Stage only explicit files or hunks that belong to this logical change. Never
   stage `.env`, credentials, private keys, or unrelated user work.
4. Infer type and scope from the reviewed diff. Write an imperative,
   present-tense description under 72 characters.
5. Commit only when the user explicitly requested it or the established
   workflow requires it. Run the repository's required checks first.
6. After committing, report the commit hash, subject, scope, and checks run.

## Examples

```text
feat(auth): add passwordless login
fix: handle empty configuration file
docs: explain local setup
```

Do not use interactive or destructive Git operations implicitly. If the
repository state is ambiguous, stop and report it before staging or committing.
