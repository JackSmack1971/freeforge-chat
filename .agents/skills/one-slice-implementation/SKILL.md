---
name: one-slice-implementation
description: Implement one ordinary FreeForge behavioral change end to end — resolve AGENTS.md, capture baseline state, make the smallest coherent edit, and verify with the repo's canonical commands. Use for routine bug fixes and small feature slices in freeforge/src; not for planning, audits, or release/deploy actions.
compatibility: Requires this repository's zero-build layout (freeforge/src, tests/security) and Node.js 22.
---

# One-Slice Implementation

Ship one smallest coherent FreeForge behavioral change, verified with this
repo's canonical commands, without disturbing anything the task didn't ask
for.

## 0. Resolve instructions and baseline

1. Find the nearest applicable `AGENTS.md` to the files you expect to touch
   (root `AGENTS.md`, `tests/AGENTS.md`, or any `.agents/skills/*` node) and
   read it before editing. Root `AGENTS.md` is the instruction root; a nearer
   file only specializes it and may not weaken security, privacy, or release
   controls.
2. Record the baseline: `git status --short` and `git rev-parse HEAD`. Note
   any pre-existing uncommitted or untracked files — they are not yours.
   Never stash, discard, or fold them into this change.
3. If `git status` shows unrelated dirty files, protect them explicitly: stage
   and diff only the paths this slice touches; never `git add -A`, `git
   checkout .`, `git reset --hard`, or `git clean`.

## 1. Define the slice

1. State the one smallest coherent behavioral delta in a sentence: the user-
   or API-observable change, not the mechanism.
2. Name the intended files up front (expect `freeforge/src/**`, matching
   `tests/security/*.test.mjs`, and docs only if behavior visible to users
   changed).
3. Name explicit non-goals: adjacent code you will not touch, refactors you
   will not do, dependencies you will not add. If the fix requires touching
   more than one module's worth of unrelated logic, stop and treat it as
   larger than one slice — load `surgical-change-control` before proceeding.

## 2. Inspect before editing

1. Read the module(s) you intend to change and at least one sibling module
   under `freeforge/src/features/` or `freeforge/src/ui/` for existing
   conventions (naming, error handling, event wiring, state access via
   `state.js`'s `S` singleton).
2. Check `tests/security/` for an existing test file covering the surface;
   read it before writing new assertions so new tests match existing
   structure and mocking via `tests/helpers/mock-dom.mjs`.
3. If two or more in-flight changes could touch the same function or file,
   use a single writer for that surface — do not let concurrent edits race
   on the same lines. Sequence the work instead.

## 3. Escalate before implementing, if triggered

Before writing code, check whether the change touches any of:

- secrets, credentials, or anything that could land outside
  `sessionStorage` for the OpenRouter API key (`localStorage`, logs,
  exports, committed source);
- HTML rendering of assistant or remote content, or any `innerHTML` site
  (the pipeline must stay `marked` → `DOMPurify` → DOM; sanitized output
  only);
- CSP, security headers, or SRI metadata in `netlify.toml` or
  `freeforge/index.html`;
- network access, fetch targets, or anything that could reach a real
  OpenRouter (or other) endpoint from a test;
- imported/remote structured data (agent configs, JSON) that isn't yet
  validated/normalized before use.

If any apply, load the `security-review` skill and complete that review
before or alongside implementation — do not defer it past the point where
the risky code is written and unreviewed.

## 4. Implement

1. Make the smallest coherent edit that satisfies the delta. No opportunistic
   refactors, renames, or reformatting of surrounding code.
2. Preserve the zero-build browser architecture: no bundler, no new build
   step, no npm runtime dependency. CDN libraries stay CDN-loaded with SRI.
3. Keep domain/state logic (`state.js`, `features/`) independent of DOM/UI
   wiring (`ui/`, `app.js`) per existing module boundaries; don't introduce a
   new cross-layer import without noting the dependency direction in your
   report.
4. Update tests in the same change as the behavior they cover — not before,
   not deferred to a follow-up. Add a new `tests/security/*.test.mjs` test
   only when no existing file covers the surface; otherwise extend the
   existing one.

## 5. Verify

Run checks narrowest-first; do not skip to the broad command alone.

1. Focused: the single test file for the changed surface —
   `node --test tests/security/<name>.test.mjs`.
2. Full suite: `npm --prefix freeforge test`.
3. Static analysis, when `freeforge/src`, `tests/security`, or
   `tests/helpers` changed:
   `npx --yes @biomejs/biome@1.9.4 check freeforge/src tests/security tests/helpers`
4. Inspect the final diff (`git diff`, `git status --short`) against the
   named intended-files list from step 1. Anything outside that list is
   either justified in the report or reverted before reporting done.

Never weaken, delete, skip, or rewrite a test/assertion/CSP rule to make a
check pass. If a canonical command fails, investigate the failure — do not
substitute a different command.

## 6. Report

Close with:

- `Changed` — files touched and the one-sentence behavioral delta.
- `Reused` — existing patterns/tests extended instead of duplicated.
- `Verified` — exact commands run and their results (pass/fail, not "looks
  right").
- `Limitation` — anything unverified, skipped, or still failing, and why.

State any control-plane file touched (`AGENTS.md`, `.agents/**`,
`.codex/**`, `security/constitution.md`, `.github/workflows/**`) explicitly
and separately — these are higher-scrutiny by repository policy even inside
an otherwise ordinary slice.

This skill may recommend a commit or PR (via `git-workflow`/`git-commit`)
but must never perform one, push, or merge on its own authority. Committing,
pushing, merging to `main`, or any deploy-adjacent action requires the
user's explicit go-ahead for that specific action, given at the time — a
prior approval of this skill's use does not carry forward to those actions.

## Stop conditions

Stop and report back to the user, without further edits, when any of:

- **Repeated failure.** The same focused test or Biome check fails twice in
  a row after a genuine fix attempt (not a typo retry). Report the exact
  failure, what was tried, and ask before a third attempt or a different
  approach.
- **Scope creep.** The smallest coherent delta from step 1 turns out to
  require touching a second, unrelated module or a protected area (auth,
  payments/trading logic, DB migrations, CI/CD, production config, secrets).
  Stop, name what grew, and let the user confirm before continuing.
- **Conflicting instructions.** Repository instructions, this skill, and the
  task requirement materially disagree and the safe reading isn't obvious.
  Surface the conflict; don't silently pick one.
- **Dirty or unexpected baseline.** Step 0 finds uncommitted work you didn't
  create and can't cleanly separate from your diff. Ask before proceeding.
