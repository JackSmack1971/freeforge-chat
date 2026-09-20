# Migration Contract: `freeforge-chat` → Codex CLI Project Control Plane

Companion to `CURRENT_STATE.md`. That document records what exists; this one
defines the target topology, the invariants that must hold at every step of
the migration, and the separation of concerns the migrated control plane must
express. It does not authorize any change by itself — each concrete step
still needs its own review and, where noted, human approval.

This contract makes **no application-behavior changes**. Nothing here
modifies `freeforge/**`, `tests/**`, `netlify.toml`, or CSP/SRI values.

## 1. Governing separations

Nine dimensions must stay visibly separate in the migrated control plane.
Collapsing any of these into one artifact (e.g. a rule file that also
executes, or a Skill that also grants permission) recreates the ambiguity
this migration exists to remove.

### 1.1 Behavioral policy

*What an agent should decide to do* — style, priorities, engineering
standards, definition-of-done, role responsibilities. Currently expressed in
`AGENTS.md` (root, `tests/AGENTS.md`, `.agents/AGENTS.md`). Text-only;
carries no enforcement power by itself. `AGENTS.md` already says this about
its own "Capability and permission policy" section — the same rule applies
to all of it.

### 1.2 Execution policy

*What an agent is allowed to attempt* — the deny/ask/allow decision for a
given tool call. Currently expressed only in the (disk-deleted, still
tracked) `.claude/settings.json` permission engine and
`managed-settings.example.json`. Codex CLI has its own equivalent
configuration surface (approval mode / sandbox policy); the migrated
execution policy must live there, natively, not as a ported JSON file that
Codex doesn't read.

### 1.3 Capabilities / tool availability

*What tools exist to be called at all* — MCP servers, CLI tool access,
network reachability. Distinct from execution policy (1.2): a tool can be
available but denied, or unavailable entirely. `.claude/settings.json`'s
`enabledMcpjsonServers` is the only current record of this; it names a
Claude-Code-specific mechanism (`.mcp.json`) with no automatic Codex
equivalent.

### 1.4 Runtime execution

*The mechanism that actually runs agent turns and tool calls* — Claude Code's
harness today; Codex CLI's own runtime in the target state. Hooks
(`.claude/hooks/**`), workflows (`.codex/workflows/7axes-full-audit.js`), and
slash commands (`.claude/commands/**`) are runtime-execution artifacts, not
policy documents — they only do something because a specific runtime
interprets them. A file moved under `.codex/` does not become Codex-native
merely by being moved; it becomes native when Codex CLI's runtime can
actually execute it unmodified.

### 1.5 Approvals

*Who or what must sign off before an effect lands.* Two layers, kept
distinct:

- **Tool-level approval** — the `ask` gate in execution policy (1.2), e.g.
  `Bash(git commit*)` requiring interactive confirmation.
- **Change-level approval** — human review of a diff/PR before merge,
  independent of what any individual tool call was permitted to do.
  `AGENTS.md`'s Implementer role ("may not, without explicit higher
  authority: push to a protected branch, merge or approve its own change...")
  is change-level approval policy; it does not by itself enforce anything
  (see 1.1) and must be backed by branch protection / required review, which
  is outside this repository's file tree.

### 1.6 Skills

*Reusable, invokable procedures a runtime can load on demand.* `.agents/skills/**`
(untracked, 49 directories) is the emerging Codex-shaped skill set;
`.claude/skills/healing-test-failures/SKILL.md` and
`.codex/skills/7axes-audit/**` are the two predecessors. Per invariant 3.2
below, a Skill is instructions for *how* to do something once already
permitted — it must never be the thing that grants the permission to do it.

### 1.7 Subagents

*Named personas with a scoped role*, e.g. `.claude/agents/lead-engineer.md`
and the other five `.claude/agents/*.md` personas. These encode behavioral
policy (1.1) for a narrower actor, not execution policy — a subagent
definition describing broad authority does not itself grant that authority;
the runtime's execution policy (1.2) still gates every tool call the
subagent attempts.

### 1.8 Hooks

*Runtime-triggered side effects* — `.claude/hooks/validators/*.js` (command
analysis, control-plane structural check, file protection, web-access
guard) and `.claude/hooks/workflow/*.js` (file formatting, session start,
stop summary). These are runtime execution (1.4) with a specific trigger
model (pre/post tool-call, session lifecycle). `node-tests.yml` currently
invokes `.claude/hooks/validators/control-plane-check.js` directly as a
plain Node script outside any Claude Code hook context, which is itself a
sign this particular hook was already partly decoupled from the Claude Code
hook system before this baseline was taken.

### 1.9 Source-control authority

*Who/what may create commits, branches, or history-altering operations, and
under what condition.* `AGENTS.md`'s Implementer/Release-operator role text
addresses this at the policy layer (1.1); actual enforcement is Git
itself plus branch protection plus the execution-policy `ask` gate on
`git commit*`/`git push*`. No file in this repository can enforce
source-control authority by itself — it can only declare the intended
policy for a compliant runtime to apply.

### 1.10 Netlify production publication

Kept as its own dimension because it is the one place in this repository
where a Git operation has a direct, automatic, irreversible external effect
with no separate gate. See section 4.

### 1.11 Verification / evidence

*What proves a change is correct*, distinct from what authorizes shipping it
(§4, invariant 4.7). `AGENTS.md`'s "Testing and verification" and "Change
review expectations" sections, plus `tests/AGENTS.md`'s five test
invariants and `security/constitution.md`'s machine-readable rules, are the
current evidence contract. CI (`.github/workflows/*.yml`) is the only
automated, independent verification boundary; everything else is
self-reported by whichever agent did the work.

## 2. Target topology

```
.codex/                      Codex CLI runtime-native mechanisms only
  rules/                     Codex-native behavioral/execution-scoped rules
                              (real Codex rule format, not ported Claude
                              frontmatter — see gap G1 below)
  skills/                    Codex-native skills only, once ported
  workflows/                 Only if/when Codex CLI has a matching native
                              primitive for what 7axes-full-audit.js does
                              (unresolved — see gap G3)
.agents/                     Cross-tool / project-level control-plane content
  AGENTS.md                  Scope statement for this directory (already
                              present; needs its dangling-path reference
                              fixed — see gap G2)
  skills/**                  Already populated (49 dirs, untracked)
AGENTS.md                    Root behavioral-policy document (already
                              rewritten to be self-contained; keep it that
                              way — do not reintroduce a CLAUDE.md pointer)
tests/AGENTS.md               Local behavioral policy for tests/
security/constitution.md      Machine-readable security invariants
docs/control-plane/           This baseline + contract (source of truth for
                              the migration itself)
```

`.claude/**` is **not** part of the target topology. Whether it is deleted,
archived, or left for the git-history record is an open question this
baseline does not decide (see §5); either way, no *new* control-plane content
should be authored under `.claude/` going forward.

## 3. Migration invariants

These are the constraints every subsequent migration step must satisfy.
They restate and sharpen the task's stated invariants against the concrete
evidence in `CURRENT_STATE.md`.

### 3.1 Codex-native mechanisms only under `.codex/` and `.agents/`

A file's location does not make it native; its format and the runtime that
actually interprets it do. Before anything is moved into `.codex/` as part
of this migration, confirm Codex CLI has a real mechanism for it — frontmatter
`paths:`-scoped rule files and JS "workflow" scripts, as currently written
under `.codex/`, were authored for a different runtime and are flagged as
inert for exactly this reason (see `CURRENT_STATE.md` §"`.codex/**`
(deleted from disk, still in HEAD)").

### 3.2 Instructions never grant runtime authority

`AGENTS.md`, `tests/AGENTS.md`, `.agents/AGENTS.md`, and any Codex rule file
describe intended behavior. None of them can enforce anything by
themselves — enforcement is the runtime's execution policy (1.2), sandbox,
and CI. `AGENTS.md` already states this explicitly for its own capability
section; extend the same reading to every instruction file in the target
topology, including new Codex-native ones.

### 3.3 Skills never grant permissions

A Skill (1.6) is a packaged procedure invoked once a tool call is already
permitted. If a migrated Skill under `.agents/skills/` or `.codex/skills/`
appears to expand what an agent may do (e.g. by instructing it to bypass an
`ask` gate, or by embedding credentials/scopes), that Skill is malformed
under this contract regardless of intent.

### 3.4 One implementation owner for overlapping edits

Where `.claude/**` and the new `.agents/**`/`.codex/**` trees cover the same
concern (e.g. `.claude/skills/healing-test-failures` vs. whatever eventually
lands in `.agents/skills/` or `.codex/skills/` for the same purpose; the six
`.claude/agents/*.md` personas vs. any future Codex subagent definitions),
exactly one of them is authoritative once migration completes for that
concern. Until a given concern's migration step explicitly resolves this,
treat the Claude-Code-era file as authoritative (it is the only one that is
currently runnable) and the new tree's equivalent as staged/draft.

### 3.5 Read-only exploration/review by default

Any agent working on this migration defaults to read-only inspection unless
a step explicitly authorizes a write, matching `AGENTS.md`'s Explorer role.
This baseline pass itself followed that default: it created exactly the two
files named by the task, in `docs/control-plane/`, and made no other writes.

### 3.6 Git diff is authoritative

`CURRENT_STATE.md` is derived entirely from `git status`/`git diff`/`git show`
output, not from `.planning/**`, prior summaries, or file presence assumed
from memory. Every later migration step must re-derive current state the
same way rather than trusting this document's snapshot as still current —
it is a point-in-time baseline dated 2026-09-20 at HEAD
`76f40a99368aa4627f32cbe439cf45e1e3f039dc`.

### 3.7 Passing tests do not authorize commit, push, merge, or deployment

`node --test tests/security/*.test.mjs` and the Biome check are evidence
(1.11), not approval (1.5). Nothing in this repository's current tooling
auto-commits or auto-merges on a green run, and this migration must not
introduce anything that does.

### 3.8 Merging to `main` is production publication

`netlify.toml` configures `publish = "freeforge"` with no branch/context
restriction, and Netlify's git-integration default is to auto-deploy the
linked production branch. Given this repository's remote
(`JackSmack1971/freeforge-chat`) is Netlify-linked, a merge to `main` is not
a neutral Git operation — treat it with the same weight as a deploy action
under `AGENTS.md`'s Release-operator role, requiring explicit human
authorization each time, not implicit authorization from CI passing.

## 4. Explicit non-authorizations for this baseline pass

- This pass did not push, merge, or otherwise update `main` (per task
  instruction).
- This pass did not delete `.codex/rules/control-plane.md`,
  `.codex/skills/7axes-audit/**`, or `.codex/workflows/7axes-full-audit.js`
  from Git history or the index (they were already absent from disk before
  this session; this pass took no further action on them).
- This pass did not fix the `.gitignore` contradiction, the broken CI step,
  the dangling `docs/codex-skills-data-for-migration/` reference, or the
  stale `../CLAUDE.md` pointer in `tests/AGENTS.md`. All four are recorded as
  findings for a scoped follow-up step, not fixed inline here, since fixing
  them is itself a control-plane change requiring its own review.

## 5. Unresolved ambiguities (require a decision before the next step)

1. **`docs/codex-skills-data-for-migration/` does not exist.**
   `.agents/AGENTS.md` names it as the single source of truth for Codex
   control-plane information and requires scanning it before migrating any
   skill from `.claude/skills/`. No skill migration can proceed against this
   invariant until either the folder is created with real content, or
   `.agents/AGENTS.md` is corrected to point somewhere that exists.
2. **`.gitignore` hides the very paths the migration needs to track.**
   `.codex/*` is fully ignored; `.claude/*` is ignored except two
   hook-script subpaths. If migrated content is meant to land under
   `.codex/` per the target topology (§2), `.gitignore` must be updated as
   part of (not incidental to) the migration, and that update should be its
   own reviewed step given `.gitignore` changes affect what future commits
   can accidentally omit.
3. **`node-tests.yml`'s first step is currently broken against disk state.**
   If the pending deletion of `.claude/**` is ever committed as-is, CI's
   "Run control-plane structural check" step fails outright (file not
   found), not just semantically stale. Whether the replacement is a
   Codex-native structural check, a different script, or removal of the
   step is undecided.
4. **Disposition of `.claude/**` is undecided.** Delete, archive under a
   clearly-inert path, or leave as git-history-only are all consistent with
   "do not change application behavior," but they are not equivalent for
   future contributors reading the tree. Task instructions explicitly said
   not to delete the three named `.codex/` artifacts yet; they said nothing
   about `.claude/**`, `.planning/**`, or the untracked `.7axes/` /
   `codex-pr-reviews/` / `reports/` directories, so this pass leaves all of
   them untouched pending an explicit decision.
5. **Whether `.7axes/`, `reports/`, and `codex-pr-reviews/` are in-scope
   control-plane content or disposable run output.** They are untracked and
   were not named in the task's inspection list; `MIGRATION_CONTRACT.md`
   does not assign them a place in the target topology (§2) because their
   ownership (are they Skill run artifacts? throwaway logs?) was not
   established by this baseline pass.
6. **Overlap between `.claude/agents/*.md` personas and any future Codex
   subagent definitions is unmapped.** No content comparison of the six
   personas against `.agents/skills/**` was performed beyond directory
   listing; a concern-by-concern mapping is future work, not something this
   baseline resolves.

## 6. Verification

### `git diff --check` (whitespace/conflict-marker check across the full
working tree, read-only)

```
$ git diff --check
.repository-hygiene/report.md:3: trailing whitespace.
+Generated: `2026-08-09T22:14:13+00:00`  
.repository-hygiene/report.md:4: trailing whitespace.
+Repository: `C:/workspaces/DEPLOYED/NETLIFY/freeforge-chat`  
(exit status 2)
```

Both findings are trailing-whitespace lines in `.repository-hygiene/report.md`,
a file already modified in the working tree before this session started (see
`CURRENT_STATE.md`'s dirty-state inventory) — not introduced by this pass,
and not a conflict marker. `git diff --check` does not evaluate untracked
files (both new documents here are untracked, not yet staged), so it could
not check them directly; each was instead read back in full after writing to
confirm no stray conflict markers or malformed content. No files were edited
to silence this finding, per the verification-floor rule against weakening
checks to force a pass — it is reported here as-is.

### Local links in the two new documents

Manually verified, since these are prose Markdown files with no automated
link checker configured in this repository:

- `CURRENT_STATE.md` references paths only (no `[text](path)` links) —
  every referenced path was independently confirmed to exist or not exist
  via `find`/`git show` as documented in its own "Verification performed"
  section.
- `MIGRATION_CONTRACT.md` cross-references `CURRENT_STATE.md` by filename
  only (no relative link syntax), both files co-located in
  `docs/control-plane/`.

No broken relative links were introduced.

## 7. Summary for the record

- **Baseline SHA:** `76f40a99368aa4627f32cbe439cf45e1e3f039dc` (branch `main`).
- **Dirty-state assessment:** working tree is mid-migration and uncommitted —
  52 changed paths (deletions of `.claude/**`, `.codex/**`, `.planning/**`,
  `CLAUDE.md`; modifications to `AGENTS.md`, `CONTRIBUTING.md`, hygiene
  reports) plus 4 untracked directories (`.7axes/`, `.agents/`,
  `codex-pr-reviews/`, `reports/`). None of it was touched by this pass.
- **Files created by this pass:** `docs/control-plane/CURRENT_STATE.md`,
  `docs/control-plane/MIGRATION_CONTRACT.md`. No other files were created,
  modified, or deleted.
- **Unresolved ambiguities:** 6, listed in §5 — most material is the missing
  `docs/codex-skills-data-for-migration/` source-of-truth folder (blocks any
  skill migration) and the `.gitignore` contradiction (blocks tracking new
  `.codex/**` content at all).
- **Raw verification results:** `git diff --check` on the full working tree
  exited 2 with two trailing-whitespace findings in the pre-existing,
  already-modified `.repository-hygiene/report.md` (not introduced by this
  pass, not a conflict marker); all path claims in `CURRENT_STATE.md` were
  checked against `find`/`git show`/`git check-ignore` output captured
  during this session, not asserted from memory.
- **Production boundary respected:** no push, merge, or update to `main` was
  performed or attempted.
