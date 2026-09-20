# Production Deployment Boundary

Companion to `AGENTS.md` ("Source control, worktree, and deployment
boundaries"), `MIGRATION_CONTRACT.md` (sections 3.7–3.8), `policy-map.md`,
and `hooks-policy-map.md`. Those documents establish the general
control-plane migration and the Codex config/hook/execpolicy layers; this
one is scoped narrowly to one question — **what makes a change to this
repository "production" for FreeForge's current Netlify architecture, and
what governs the boundary before that happens.**

This document does not change Netlify headers, `netlify.toml`, or any
`freeforge/**` application behavior. It is governance/documentation only.

## 1. The fact this whole document exists to preserve

`netlify.toml` sets `publish = "freeforge"` with **no `[build]` command, no
branch/context restriction, and no separate build step**. Netlify's
git-integration default is to auto-deploy the linked production branch on
every push/merge that lands on it. Because this repository's remote
(`JackSmack1971/freeforge-chat`) is Netlify-linked with `main` as that
branch:

> **A change merged to `main` can become publicly live: no repository build
> step sits between merge and publication.** There is no compile, bundle,
> or artifact-staging phase that a human or CI could inspect between
> "merged" and "served to the public" — Netlify republishes the raw
> contents of `freeforge/` as-is.

Stated as plainly as possible: **merging to `main` is production
publication.** It is not a step before publication, and not a step that
still needs a separate deploy decision afterward — for this repository,
the two are the same event. This is the single fact every rule below
exists to protect against being forgotten under time pressure, partial
context, or a green CI run that looks like permission.

## 2. Six states, not one — candidate ≠ committed ≠ pushed ≠ PR ≠ merged ≠ deployed

Treat these as six distinct states of a change, each requiring its own
explicit action to advance, never assume an earlier state implies a later
one:

| State | What it means | What it does *not* mean |
|---|---|---|
| **Candidate** | A diff exists in the working tree or an agent's proposed patch. | Not reviewed, not tested, not saved anywhere durable. |
| **Committed** | The candidate is a local commit (`git commit`). | Not visible to anyone else; not on any remote; reversible with `git reset`/`git rebase` without any external trace. |
| **Pushed** | The commit(s) reached a remote branch (`git push`), typically a non-`main` branch. | **Not** on `main`; triggers no Netlify production deploy by itself. May trigger a Netlify *deploy preview* if branch deploys are configured, which is a separate, non-production surface. |
| **PR (opened)** | A pull request exists proposing the change be merged into `main`. | Not merged. Review, CI, and comments at this stage are input to a decision, not the decision itself. |
| **Merged** | The PR (or a direct push, if branch protection allows it) has landed on `main`. | **This is the point of no separate return** — see §1. Treat this state, by itself, as production publication already having started, not as "ready to deploy." |
| **Deployed** | Netlify has actually built/published the new `main` HEAD and it is being served. | Practically simultaneous with "merged" for this repository, because there is no intermediate build gate (§1). Do not treat "deployed" as a later, separately-authorized step you can still stop before — for `main`, merged *is* deployed. |

Each arrow between these states is a distinct, attributable human or
CI action. None of them may be inferred from an earlier one:

- A green test run on a **candidate** does not imply it should be
  **committed**.
- A **commit** existing does not imply it should be **pushed**.
- A **push** to a feature branch does not imply a **PR** should be opened.
- An **open PR**, even with passing CI and approving reviews, does not
  imply it should be **merged** — merge is a distinct act requiring its own
  explicit trigger (§4).
- **Merged** does not imply anyone separately decided to **deploy** — for
  this repository, they are the same event (§1), which is exactly why the
  merge step itself must carry deploy-level scrutiny, not a lighter one.

## 3. Tests and CI establish evidence, not deployment authority

Per `MIGRATION_CONTRACT.md` section 3.7: `npm --prefix freeforge test` and
the Biome check (or the GitHub Actions `Node Tests` workflow that runs
them) are **evidence** that a candidate change did not regress the
behaviors those checks cover. They are not, and must never be treated as,
**authorization** to commit, push, merge, or deploy:

- A passing local test run only tells you the candidate is not known-bad by
  the checks that exist; it says nothing about operator intent to publish.
- A passing CI run on a PR is the same kind of evidence, scoped to that
  PR's diff — it is not a merge button, and merging still requires the
  explicit operator action in §4.
- Nothing in this repository's tooling auto-commits, auto-merges, or
  auto-deploys on a green run, and no future automation should be added
  that would let it.

Treat "tests pass" and "safe to publish" as two independent questions.
Passing tests answer the first. Only an explicit human decision answers the
second.

## 4. What is production-sensitive

A change is production-sensitive — meaning it warrants the scrutiny in this
document before it is merged, not just before it is deployed — if it
touches any of:

- **`freeforge/**`** — the application source Netlify serves directly
  (`freeforge/index.html`, `freeforge/src/`, `freeforge/styles/`, and the
  checked-in `freeforge/styles/tailwind.min.css` bundle).
- **`netlify.toml`** — the publish directory, headers, and any future build
  or redirect configuration.
- **CDN/SRI/CSP dependencies** — the `script-src`/`style-src` hash
  allowlist in `netlify.toml`'s `Content-Security-Policy` header, and the
  matching `<script>`/`<link>` tags with `integrity`/SRI attributes in
  `freeforge/index.html`. These three surfaces (CSP hash list, SRI hash,
  and the actual CDN asset) must change together or not at all — updating
  one without the others either breaks the app (mismatched SRI/CSP) or
  silently weakens the supply-chain integrity guarantee in
  `security/constitution.md`'s `preserve-csp-and-subresource-integrity`
  rule.
- **Deployment workflow/config** — `.github/workflows/**` (CI gating) and
  any Netlify CLI/site configuration.

A change confined to `.agents/**`, `.codex/**`, `docs/**`, tests, or
non-shipped tooling is not, by itself, production-sensitive under this
definition — but see §7 for why "control-plane-only" is not automatically
"low scrutiny."

## 5. Merge to `main` requires explicit operator intent

Restating `AGENTS.md`'s "Source control, worktree, and deployment
boundaries" and `MIGRATION_CONTRACT.md` section 3.8 in this document's
terms: because merged and deployed are effectively the same event for this
repository (§1, §2), **merging to `main` must be treated with the same
weight as a manual deploy/release action** —

- requiring a human's explicit, per-instance authorization (an approval
  that names *this* merge, not a standing "you may merge when CI is
  green"), matching `AGENTS.md`'s Release-operator role;
- never inferred from a green CI run, an approving review alone, or an
  agent's own assessment that the change "looks safe";
- and never performed by the same identity/session that authored the
  change under review, per `AGENTS.md`'s Implementer role ("may not
  without explicit higher authority: ... merge or approve its own
  change").

## 6. Rollback must identify the exact prior Git state

Because there is no build artifact to "roll back" independently of Git
(§1), rollback for this repository means one thing: **returning `main` to
a specific, previously-known-good commit**, not a vague "revert the
change" instruction.

A rollback decision must record, before acting:

- the exact commit SHA `main` is currently at (`git rev-parse HEAD` against
  the deployed branch, or the SHA Netlify's deploy log names);
- the exact commit SHA to roll back to, and why it is believed good (last
  known-good deploy, last tagged release, etc.) — never "a few commits
  back" or "before lunch";
- whether the rollback will be performed as a new `git revert` commit
  (preferred — preserves history, auditable, itself goes through §5) or,
  only if a human explicitly authorizes it, a hard reset of `main` (a
  history-rewriting operation `AGENTS.md`'s "Approval Gates" and this
  repository's git-workflow discipline require explicit approval for every
  time, not once).

Never roll back by re-deploying "whatever was there before" from memory,
a stale local checkout, or an unverified branch — identify the SHA first.

## 7. Security-sensitive deploys require security review

A production-sensitive change (§4) that also touches a security-relevant
concern — anything `security/constitution.md` governs (XSS/sanitizer
boundary, API-key storage, CSP/SRI), authentication/authorization,
secrets, or trust-boundary handling of remote/untrusted data — requires
review from `AGENTS.md`'s Security reviewer role before merge, in addition
to (not instead of) the operator-intent requirement in §5. A green test
suite does not substitute for this review (§3); the two are independent
gates that must both pass.

## 8. Control-plane-only changes still need release-behavior review

A change confined to `.agents/**`, `.codex/**`, `.github/workflows/**`, or
this `docs/control-plane/**` tree is not "application code," but it is not
automatically low-scrutiny either, because it can **indirectly** alter
what CI enforces or what an agent is willing to do next time, without
touching a single line of `freeforge/**`:

- editing `.github/workflows/node-tests.yml` to drop a test glob, remove a
  step, or change trigger branches changes what CI evidence (§3) actually
  covers, without changing the application itself;
- editing `.codex/rules/default.rules` to loosen a `forbidden`/`prompt`
  decision to `allow` (or removing a rule) changes what commands an agent
  may run unattended, including the very publication commands this
  document is about;
- editing `.codex/hooks/guard-production-signal.js` or `.codex/hooks.json`
  to narrow the advisory pattern, or disabling a hook, reduces the
  visibility this document depends on (§9) without disabling any
  authoritative gate — which can create a false sense that a command is
  unflagged because it is safe, rather than because visibility was reduced.

Review a control-plane-only change by asking, explicitly: *"could this
change what CI enforces, or what an agent will do the next time it
encounters a publication command?"* If yes, it gets the same
explicit-approval discipline as a production-sensitive application change,
even though `freeforge/**` never moved.

## 9. What actually enforces this today, and what does not

Stated plainly, to avoid the document overclaiming its own reach:

- **Real, enforced decisions** for the specific command shapes below live
  in `.codex/rules/default.rules` (Codex CLI's native execpolicy engine —
  `forbidden`/`prompt`/`allow`, evaluated by Codex itself before a command
  runs): `git push` (prompt; `--force*` variants forbidden), `git commit`
  (prompt), `gh pr merge` (prompt), `gh release create` (prompt), `netlify
  deploy` (prompt; `--prod`/`--prod-if-unlocked` forbidden), `npm`/`yarn`/
  `pnpm publish` (forbidden), `git reset --hard`/`git clean -f*` (forbidden
  — protects the working tree, not production, but is part of the same
  destructive-operation family). See `policy-map.md` and
  `tests/security/codex-execpolicy-rules.test.mjs`.
- **`.codex/hooks/guard-production-signal.js`** is advisory-only defense in
  depth: it recognizes the same command family (plus a few Codex's
  execpolicy layer does not separately gate, like `git merge`, `docker
  push`, `kubectl apply`/`delete`/`replace`/`patch`, `terraform apply`,
  migration commands, and local `git tag` creation as an early release
  signal) and restates the human-authorization requirement inline. **It
  never denies a call** — see `hooks-policy-map.md` for why, and do not
  read its presence as a second enforcement layer with teeth; it is a
  visibility layer only.
- **What neither of these can do — stated explicitly, not left implicit:**
  neither `default.rules` nor `guard-production-signal.js` can see or
  prevent a merge performed through the GitHub web UI, a different
  machine, a different agent runtime, a repository admin's direct push, or
  any path to `main` that does not go through *this* Codex CLI session
  issuing *this* shell command. **This document does not claim hooks can
  prevent every remote merge path to `main` — they cannot.** The only
  durable protection against an unreviewed merge reaching `main` is
  server-side: GitHub branch protection / required reviews on `main`
  itself. Local hooks and execpolicy are evidence and friction for the
  sessions that go through them, not a substitute for that server-side
  control, and this document does not assert otherwise.

## 10. Verification

- `docs/control-plane/production-boundary.md` (this file) makes no changes
  to `netlify.toml`, `freeforge/**`, or any Netlify header/CSP/SRI value —
  confirmed by inspecting the diff introduced alongside it.
- The command families named in §9 are cross-checked against
  `.codex/rules/default.rules` and `.codex/hooks/guard-production-signal.js`
  directly (not from memory) as part of writing this document.
- `tests/security/production-boundary.test.mjs` asserts: (a) a normal local
  validation command (`npm --prefix freeforge test`) is not flagged as a
  production signal; (b) each publication-command family named in §9 is
  flagged by the advisory hook; (c) this document and
  `.agents/skills/release-readiness/SKILL.md` both exist, cross-reference
  each other, and state the "hooks cannot prevent every remote merge path"
  limitation explicitly rather than overclaiming enforcement.
