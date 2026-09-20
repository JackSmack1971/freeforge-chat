# Control-Plane Current State (Baseline)

Recorded 2026-09-20 by an inspection pass. This document is a factual snapshot,
not a plan. It records what exists on disk, what Git tracks, and where the two
disagree, so the migration contract in `MIGRATION_CONTRACT.md` starts from
verified state rather than assumption.

## Baseline identity

- Repository: `JackSmack1971/freeforge-chat`
- Branch: `main`
- HEAD SHA: `76f40a99368aa4627f32cbe439cf45e1e3f039dc`
- Working tree: **dirty** (52 changed paths: deletions, modifications, and four
  untracked directories). See "Dirty-state inventory" below.
- No commits were made, and none of the working-tree state described here was
  created by this session — it predates this inspection.

## Dirty-state inventory

### Deleted from disk, still tracked at HEAD (`git status` `D`)

- All of `.claude/**` (agents, commands, handoff templates, hooks, output
  styles, rules, `settings.json`, skills) — the entire directory is absent
  from disk.
- `.codex/rules/control-plane.md`, `.codex/skills/7axes-audit/scripts/7axes/feedback.py`,
  `.codex/workflows/7axes-full-audit.js` — the entire `.codex/` directory is
  absent from disk.
- All of `.planning/**` (project/roadmap/state docs and phase artifacts).
- `.claude/audit-runs/repo-audit-25da978e9d2d/contracts/index.md`.
- `CLAUDE.md` at the repo root.

### Modified relative to HEAD (`M`)

- `AGENTS.md` — rewritten from a five-line pointer file ("canonical source of
  truth is `CLAUDE.md`") into a full ~550-line self-contained operating
  contract. `CLAUDE.md` no longer exists on disk, so `AGENTS.md` now carries
  the substance `CLAUDE.md` previously held.
- `CONTRIBUTING.md` — updated Biome check command to include `tests/helpers`,
  points ownership at `.github/CODEOWNERS` instead of a root `CODEOWNERS`
  file, and adds a note about conversation-history storage behavior.
- `.repository-hygiene/report.json`, `.repository-hygiene/report.md`.

### Untracked (`??`), not yet in Git at all

- `.7axes/` — audit run artifacts (calibration, ledger, run outputs) from a
  prior "7axes" audit tool.
- `.agents/` — 515 files. Root `.agents/AGENTS.md` states this is "the folder
  for the codex project level control plane" and that migrated/future skills,
  a future `/rules` folder, and other Codex project-level assets belong here.
  Contains `.agents/skills/**` (49 skill directories) already populated.
- `codex-pr-reviews/` — at least one PR review run
  (`pr-review-20260809-224612-364/`) with diff, context, and review artifacts.
- `reports/` — `reports/7axes-20260705-175416.md`, output of the `.7axes/`
  tool.

**Assessment:** the repository is mid-migration. A prior session deleted the
entire `.claude/` and `.codex/` trees from disk (but did not `git rm` or
commit the deletions), rewrote `AGENTS.md` to absorb `CLAUDE.md`'s content,
and began populating a new `.agents/` tree — all uncommitted. `git diff` is
the only authoritative record of this; nothing here has been committed.

## `.gitignore` vs. tracked control-plane paths — direct contradiction

Root `.gitignore` contains:

```
!.claude/
.claude/*
!.claude/hooks/
.claude/hooks/*
!.claude/hooks/validators/
.claude/hooks/validators/*
!.claude/hooks/validators/*.js
!.claude/hooks/workflow/
.claude/hooks/workflow/*
!.claude/hooks/workflow/*.js
.codex/
```

Verified with `git check-ignore -v --no-index`:

- `.codex/rules/control-plane.md` → **ignored** (matched by `.gitignore:12:.codex/`).
- `.claude/agents/lead-engineer.md` → **ignored** (matched by `.gitignore:3:.claude/*`).
- Only `.claude/hooks/validators/*.js` and `.claude/hooks/workflow/*.js` are
  allow-listed back in; nothing under `.codex/` is allow-listed at all.

The (now-deleted-from-disk, still-in-HEAD) file `.codex/rules/control-plane.md`
itself asserts: *"The control-plane check must confirm the tracked governance
paths are no longer hidden by `.gitignore`."* That check currently fails:
`.codex/**` is fully hidden, and most of `.claude/**` is hidden except two
hook-script subpaths. This is a pre-existing, unresolved condition, not
something this baseline pass introduced.

## CI still depends on a deleted file

`.github/workflows/node-tests.yml` step "Run control-plane structural check"
runs:

```
node .claude/hooks/validators/control-plane-check.js
```

That file is deleted from disk (see inventory above) and, per `.gitignore`,
`.claude/hooks/validators/*.js` is one of the few paths *not* ignored — so if
the deletion were committed as-is, this workflow step would fail on the next
push/PR because the file would no longer exist in the tree at all.
`.github/workflows/biome-check.yml` has no such dependency.

## Root tree (top level)

```
.7axes/ (untracked)          .session-feedback/
.agents/ (untracked)         .team_experience.md
.audit-runs/                 .worktrees/
.git/                        AGENTS.md (modified)
.github/                     CHANGELOG.md
.gitignore                   CONTRIBUTING.md (modified)
.repository-hygiene/         LICENSE
CLAUDE.md (deleted)          README-SWARM.md
README.md                    SECURITY.md
biome.json                   codex-pr-reviews/ (untracked)
coverage/                    docs/
freeforge/                   managed-settings.example.json
netlify.toml                 pending_rules/
plans/                       reports/ (untracked)
security/                    tests/
```

`.claude/` and `.codex/` are absent from disk entirely (see above); they still
exist as directories in `git show HEAD`.

## Instruction/policy surface

### `AGENTS.md` (root, modified, current working-tree content)

Self-contained ~550-line operating contract. Key structural points relevant to
this migration:

- States scope/precedence: repo-wide unless a nearer `AGENTS.md` overrides;
  local instructions cannot weaken security/privacy/data/release controls.
- Defines five agent **roles** with explicit may/may-not lists: Explorer,
  Implementer, Verifier, Security reviewer, Documentation maintainer, Release
  operator. Implementer explicitly **may not**, "without explicit higher
  authority": push to a protected branch, merge/approve its own change,
  deploy/release/publish, bypass required checks, rewrite history.
- Defines a "Capability and permission policy" section (deny-by-default) that
  is descriptive/aspirational text, not an enforced mechanism — the file says
  so itself: *"These rules describe required behavior. Actual permissions
  MUST also be enforced by the runtime, sandbox, IAM, CI/CD, and
  secret-management systems."*
- States explicitly: *"Do not treat `.agents/` as product source: it is
  project control-plane content and has its own local instructions."*
- Intent Layer names three children: `tests/AGENTS.md`, `.agents/AGENTS.md`,
  and skill-specific nodes under `.agents/skills/`.
- Canonical commands (fast validation / tests / lint) match
  `freeforge/package.json` and `.github/workflows/*.yml` — verified below.

### `CLAUDE.md` (root, deleted from disk, still in HEAD)

Historical content (Claude Code specific): operating contract, default
commands, engineering standards, completion-evidence checklist, and a
"Handoff Conventions" section naming `.claude/handoff/current-task.json` as
canonical persisted handoff state, written/resumed via `/handoff` and
`/resume-handoff` (both under `.claude/commands/`, also deleted from disk).
Also carries injected `<!-- GSD:project-start -->` / `<!-- GSD:stack-start -->`
blocks (project description, tech stack) that have no equivalent yet in the
rewritten `AGENTS.md`.

### `.claude/**` (deleted from disk, still in HEAD) — Claude-Code-native mechanisms

- `settings.json` — permission engine: `defaultMode: "auto"`, explicit
  `deny`/`ask` allowlists for Bash/Read/Write patterns (secrets, force-push,
  `rm -rf`, publish commands, migrations, deploy commands all gated), one
  enabled plugin (`security-guidance@claude-plugins-official`).
- `agents/*.md` — six named subagent personas (`aris-thorne`, `elara-voss`,
  `jax-holden`, `kaelen-vance`, `lead-engineer`, `silas-mercer`).
- `commands/*.md` — four slash commands including `control-plane-check`,
  `handoff`, `resume-handoff`.
- `hooks/validators/*.js` — `analyze-command.js`, `control-plane-check.js`
  (the one CI still invokes), `protect-files.js`, `web-access-guard.js`.
- `hooks/workflow/*.js` — `format-touched-file.js`, `session-start.js`,
  `stop-summary.js`.
- `handoff/` — `README.md`, `current-task.template.json` (persisted
  cross-session task handoff state).
- `output-styles/default.md`, `rules/control-plane.md`,
  `rules/failure-escalation.md`, `skills/healing-test-failures/SKILL.md`.

None of this has a committed Codex-native counterpart yet; `.agents/skills/`
(untracked) is the closest analog but covers a different, broader skill set
(49 skills, mostly general engineering — `git-workflow`, `pr-review`,
`security-best-practices`, etc.) rather than a one-to-one port.

### `.codex/**` (deleted from disk, still in HEAD) — inert/non-native artifacts

- `.codex/rules/control-plane.md` — frontmatter-scoped rule
  (`paths: .claude/**, .mcp.json, managed-settings.json, CLAUDE.md,
  AGENTS.md`). Declares `.claude/`, `.codex/`, and `docs/` as "production
  governance," instructs running `/control-plane-check` after control-plane
  edits, and states the gitignore-hiding invariant quoted above. This is
  **Claude-Code-shaped tooling** (frontmatter `paths:` scoping, a Claude-style
  slash command) sitting under `.codex/`, not a Codex CLI-native mechanism.
- `.codex/skills/7axes-audit/scripts/7axes/feedback.py` — one Python script
  from a larger `7axes` audit tool; the corresponding run outputs live in the
  untracked `.7axes/` and `reports/` directories at the repo root, not under
  `.codex/`, so the skill's script and its data are already split across two
  locations.
- `.codex/workflows/7axes-full-audit.js` — 308-line workflow script. Codex CLI
  has no native "workflow" primitive matching this file's shape; it reads as
  a ported/adapted script rather than something written against a Codex
  execution model.

All three are explicitly called out by the task as inert or non-native and
must **not** be deleted during this baseline pass; they are recorded here for
the contract to schedule.

### `.agents/AGENTS.md` (untracked) — declared future home

Single-paragraph file: declares `.agents/` as "the folder for the codex
project level control control plane," states migrated/future skills and a
future `/rules` folder belong here, and names
`docs/codex-skills-data-for-migration/` as "the single source of truth for
codex control plane information," instructing a full scan of that folder
before migrating anything from `.claude/skills/`.

**Unresolved:** `docs/codex-skills-data-for-migration/` does **not exist**
(`find` confirms no such path under `docs/`; `docs/` contains only
`docs/features/`). The single source of truth this file points to is
missing. This is a hard blocker for any skill-migration step, not something
this baseline pass can resolve by inspection alone.

### `tests/AGENTS.md`

Governs `tests/` layout, the `mock-dom.mjs` helper contract, and five
numbered invariants every test must preserve (global restoration, state reset
before `importFresh`, no real network, no real storage, awaiting
microtasks). Still references `../CLAUDE.md` as parent context in its header
comment (*"Parent context: `../README.md` and `../CLAUDE.md`"*) — `CLAUDE.md`
is deleted from disk, so this pointer is currently broken.

### `security/constitution.md`

Machine-readable JSON (not Markdown despite the name): four rules with
`id`, `vulnerability_class`, CWE/OWASP tags, and `must`/`must_not` lists —
sanitize-before-innerHTML, API key in `sessionStorage` only, CSP/SRI
preservation, untrusted-JSON validation. `AGENTS.md`'s "Repository
invariants" section restates these three security rules in prose; the two
sources currently agree.

### `.team_experience.md`

A small "routing heuristics" log (4 entries, dated 2026-07-04) about using
worktrees for dirty checkouts, treating timeout/context-pressure as a
checkpoint signal, and preferring the GitHub REST API over `gh issue edit`
for label edits that reject certain values. Operational lore, not policy.

## Build / deploy / CI surface

### `netlify.toml`

```
[build]
  publish = "freeforge"
```

Plus a `[[headers]]` block for `/*` setting CSP (pinned `script-src` hashes
matching `freeforge/package.json`'s `_cdnDependencies` SRI values),
`X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
`Referrer-Policy: no-referrer`, HSTS, and a restrictive `Permissions-Policy`.
**No branch/context restriction is configured** — Netlify's default behavior
for a site with this config is to auto-deploy on pushes to the linked
production branch (`main`), which is the basis for treating a merge to `main`
as production publication in the migration contract.

### `freeforge/package.json`

Zero-build, zero-install static app confirmed:

- `"scripts": { "test": "cd .. && node --test tests/security/*.test.mjs" }` —
  matches `AGENTS.md`'s stated `npm --prefix freeforge test` command.
- `_cdnDependencies` (not real npm dependencies): `marked@18.0.4`,
  `dompurify@3.4.8` (both with SRI hashes matching `netlify.toml`'s CSP),
  `tailwindcss@3` (CDN, no SRI recorded).
- No `dependencies`/`devDependencies` key at all.

### `.github/workflows/`

- `biome-check.yml` — runs
  `npx --yes @biomejs/biome@1.9.4 check freeforge/src tests/security tests/helpers`
  on push to `main`/`fix|test|chore/issue-*` and on PRs. Matches
  `AGENTS.md`'s canonical lint command exactly.
- `node-tests.yml` — runs the deleted `.claude/hooks/validators/control-plane-check.js`
  (see "CI still depends on a deleted file" above), then
  `node --test tests/security/*.test.mjs` on the same trigger set. Matches
  `AGENTS.md`'s canonical test command, but the first step is currently
  broken relative to disk state.

Neither workflow references `.codex/**`, `.agents/**`, or any Codex-native
mechanism. Nothing in `.github/workflows/**` deploys to Netlify directly —
production publication is Netlify's own git-integration auto-deploy on
`main`, outside GitHub Actions' control.

## Verification performed for this document

- `git rev-parse HEAD`, `git status --porcelain=v1`, `git diff --stat`,
  `git diff HEAD -- AGENTS.md CONTRIBUTING.md` — read-only, no mutation.
- `git show HEAD:<path>` for every file recorded above as "deleted from disk,
  still in HEAD" (`.codex/rules/control-plane.md`,
  `.codex/workflows/7axes-full-audit.js` (line count only),
  `.codex/skills/7axes-audit/...` (tree listing), `CLAUDE.md`,
  `.claude/settings.json`).
- `git check-ignore -v --no-index` against one representative path under each
  of `.codex/` and `.claude/` to confirm the gitignore contradiction.
- `find`/`ls` against every path named in the task instruction
  (`AGENTS.md`, `CLAUDE.md`, `.claude/**`, `.codex/**`,
  `.github/workflows/**`, `security/constitution.md`, `tests/AGENTS.md`,
  `.team_experience.md`, `netlify.toml`, `freeforge/package.json`), plus the
  four untracked directories (`.7axes/`, `.agents/`, `codex-pr-reviews/`,
  `reports/`) and the missing `docs/codex-skills-data-for-migration/` path.
- No files outside `docs/control-plane/` were created or modified by this
  pass. No git state was mutated (no add/commit/push/checkout/reset/clean).
