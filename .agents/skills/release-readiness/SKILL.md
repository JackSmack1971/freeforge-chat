---
name: release-readiness
description: Use before recommending or performing any action that can move a FreeForge change toward production — committing, pushing, opening/merging a PR into main, creating a git tag or GitHub release, or running a Netlify deploy command. Checks operator intent, evidence-vs-authority, production-sensitive scope, and rollback identifiability before the action, not after.
compatibility: Requires read access to this repository's Git state (git status/log) and the files this skill checks (netlify.toml, freeforge/**, .github/workflows/**). Performs no writes itself.
---

# Release Readiness

Canonical policy: `docs/control-plane/production-boundary.md`. This skill is
a short pre-action checklist derived from that document, not a
restatement of it — read the full document when a check below is
ambiguous or when the answer is "no."

The fact this exists to protect: `netlify.toml` publishes `freeforge/`
directly with no build step, so **merging to `main` is production
publication**, not a separate later step you can still stop before.

## When to run this

Before recommending, drafting, or executing any of: `git commit` (when the
next likely step is push/PR), `git push` (especially to `main` or a branch
feeding a PR into it), opening or merging a PR, `git tag`, `gh release
create`, or any `netlify deploy` invocation.

Do **not** run this for read-only inspection (`git status`, `git diff`,
`git log`) or for running the repository's own test/lint commands — those
are evidence-gathering, not release actions (see `production-boundary.md`
section 3).

## Checklist

1. **State the current state honestly, using the six-state model**
   (`production-boundary.md` section 2): is this change a candidate,
   committed, pushed, an open PR, merged, or already deployed? Do not
   round up — an open PR with green CI is still just "PR," not "merged."

2. **Evidence is not authority.** If the justification for the next step is
   "tests pass" or "CI is green," that answers whether the change is
   *correct*, not whether it should be *published*. Passing checks never
   substitute for the explicit human sign-off in step 4.

3. **Check production-sensitive scope** (`production-boundary.md` section
   4): does the diff touch `freeforge/**`, `netlify.toml`, the CSP/SRI/CDN
   triad in `netlify.toml` + `freeforge/index.html`, or
   `.github/workflows/**`? If yes, and it also touches anything
   `security/constitution.md` governs (XSS/sanitizer boundary, API-key
   storage, CSP/SRI, auth, secrets, untrusted-data handling), flag that a
   security reviewer must review this before merge, per
   `production-boundary.md` section 7 — do not proceed to merge without it.

4. **Confirm explicit operator intent for the specific action.** A merge to
   `main`, a tag/release creation, or a direct Netlify deploy each need a
   human's per-instance approval naming *that* action — not a standing "go
   ahead when green" from earlier in the conversation, and not the
   implementer's own approval of their own change (`AGENTS.md`,
   Implementer role). If that explicit approval is not present in the
   conversation, stop and ask for it before proceeding; do not infer it.

5. **If this is a rollback, identify the exact prior state first**
   (`production-boundary.md` section 6): the current SHA, the target SHA,
   and why the target is believed good. Never roll back to "whatever was
   there before" from memory.

6. **If the change is control-plane-only** (`.agents/**`, `.codex/**`,
   `.github/workflows/**`, `docs/control-plane/**`), still ask whether it
   can change what CI enforces or what an agent will do next time it hits a
   publication command (`production-boundary.md` section 8). If yes, treat
   it with the same explicit-approval discipline as an application change.

7. **State the limitation, don't overclaim.** Local hooks
   (`.codex/hooks/guard-production-signal.js`) and execpolicy
   (`.codex/rules/default.rules`) are real for the commands issued through
   *this* session, but they cannot see or stop a merge made through the
   GitHub web UI, another machine, or another agent runtime. The durable
   protection against an unreviewed merge to `main` is server-side branch
   protection, not this checklist. Never tell a user this skill or the
   Codex hooks "prevent" an unauthorized merge — say what they actually
   cover.

## Output

State plainly: the current state (step 1), whether the scope is
production-sensitive and/or security-sensitive (step 3), whether explicit
operator authorization for the specific next action is present or missing
(step 4), and — if missing — exactly what approval is needed before
proceeding. Do not perform the release action yourself while that approval
is outstanding.
