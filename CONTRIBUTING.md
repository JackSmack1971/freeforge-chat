# Contributing to FreeForge Chat

FreeForge Chat is intentionally small: no package install, no build step, and no server. Keep changes narrow and tied to the issue you are fixing.

## Before You Open a PR

1. Open the app directly with `freeforge/index.html` if you need a quick manual check.
2. Run `git diff --check` to catch whitespace and patch issues.
3. Run `npx --yes @biomejs/biome@1.9.4 check freeforge/src tests/security`.
4. Run `node --test tests/security/*.test.mjs`.
5. Add screenshots or logs only when they help explain the change.

## Workflow

- Open a GitHub issue for bugs or feature requests.
- Work on a short-lived branch tied to the issue number.
- Keep pull requests focused on one behavior, doc update, or hygiene fix.
- Mention `@JackSmack1971` in the PR or issue when you need review or clarification.

## What to Avoid

- Large refactors that are unrelated to the issue.
- Adding dependencies, build steps, or generated files without a clear need.
- Editing secrets, keys, or environment-specific files.

## Useful Commands

```bash
git diff --check
npx --yes @biomejs/biome@1.9.4 check freeforge/src tests/security
node --test tests/security/*.test.mjs
```
