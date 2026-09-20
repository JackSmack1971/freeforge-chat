# Handoff / Evidence Contract

Companion to `CURRENT_STATE.md` and `MIGRATION_CONTRACT.md`. Scoped narrowly
to one migration concern: replacing Claude-Code-specific continuity — the
retired `.claude/handoff/current-task.json` mechanism, written/resumed only
by the retired `/handoff` and `/resume-handoff` slash commands — with a
runtime-neutral task-handoff/evidence record any runtime (Codex CLI, Claude
Code, a human) can read, write, and validate the same way.

This document does not authorize any change by itself (per
`MIGRATION_CONTRACT.md` invariant 3.5). It defines the schema, the semantics,
and the tool that enforces both; per-task use of that tool still needs its
own review like any other control-plane-adjacent artifact.

## What this replaces, and what it does not

| Claude-era mechanism | Runtime-neutral replacement |
|---|---|
| `.claude/handoff/current-task.json` (persisted state) | `tools/control-plane/generated/handoff.json` (gitignored runtime state) or a promoted copy under `docs/control-plane/evidence/**` (tracked evidence) |
| `.claude/commands/handoff.md` (write) | `node tools/control-plane/handoff.mjs update` |
| `.claude/commands/resume-handoff.md` (read) | `node tools/control-plane/handoff.mjs show` |
| *(none — no validation existed)* | `node tools/control-plane/handoff.mjs validate` |

This is **not** a claim that `.claude/`'s `/handoff` flow is restored. Per
migration invariant 3.4 ("one implementation owner for overlapping edits"),
`tools/control-plane/handoff.mjs` is now the sole authority for handoff state
in this repository. If a later step adapts Claude Code's `/handoff` and
`/resume-handoff` slash commands to call this same tool (see "Claude
compatibility" below), that adaptation is additive — it must not fork the
schema or write a second, competing state file.

## Where state lives

- **Runtime state** (default): `tools/control-plane/generated/handoff.json`.
  Already covered by the existing `.gitignore` entry
  `tools/control-plane/generated/` — nothing new was added there. A task may
  point `handoff.mjs` at a different `--out`/path, but the default is
  deliberately the gitignored generated directory so ordinary iteration
  during a task does not need a commit for every state change.
- **Tracked evidence**: `docs/control-plane/evidence/*.json`, populated only
  by `node tools/control-plane/handoff.mjs promote <runtime-file> --to
  docs/control-plane/evidence/<name>.json`. Promotion is the one explicit,
  reviewable act that moves a handoff record from "local scratch state" to
  "durable evidence a reviewer can cite." Nothing in this contract promotes a
  file automatically, and `promote` itself refuses a record that is either
  schema-invalid or stale (see below) — it will not launder bad state into a
  tracked path.

## Schema

Machine-readable schema: `docs/control-plane/schema/handoff.schema.json`
(JSON Schema draft-07). Starting template: `docs/control-plane/templates/handoff.template.json`.
Required fields, matching the task's field list exactly:

| Field | Purpose |
|---|---|
| `objective` | What this task is trying to accomplish. |
| `baselineSha` | The commit every other claim in the record (`changedFiles`, `verification`) was evaluated against — see "Staleness" below. |
| `worktree.branch` (`worktree.path` optional) | Which branch/worktree this task ran in. `path` is intentionally optional and machine-specific; a handoff record must not encode an absolute local path as if it were portable. |
| `intendedScope` | The declared boundary of what this task may touch, so scope creep is detectable by diffing intent against `changedFiles`. |
| `changedFiles` | Repository-relative paths actually changed as of `baselineSha`. |
| `verification` | See "Evidence semantics" below — the record's core contract. |
| `unresolvedFailures` | Failures observed and not yet fixed. |
| `openRisks` | Known risks not yet mitigated. |
| `nonGoals` | What this task deliberately does not attempt — absence of coverage here is a decision, not an oversight. |
| `nextActions` | What a resuming agent/human should do next. |
| `productionImpact` | Whether anything recorded here touches or is reachable from production. Per `MIGRATION_CONTRACT.md` 3.8, a merge to `main` is production publication for this repository — this flag exists so a resuming agent does not have to re-derive that from scratch. |
| `updatedAt` | ISO 8601 timestamp, set only by `handoff.mjs` itself, never hand-edited. |

`additionalProperties: false` at every object level in the schema: an unknown
field is a validation error, not silently ignored, so the schema cannot
quietly drift out from under the tool that enforces it.

## Evidence semantics

Every entry in `verification` is `{ id, state, command?, result?, rationale?, ranAt? }`.
`state` is one of exactly four values, and **is never defaulted** — every
entry must name its own state explicitly, so "nobody set a state" can never
be mistaken for "passed":

- **`PASSED`** — only for a command that actually executed and succeeded.
  Requires non-empty `command` *and* non-empty `result`. `handoff.mjs`
  enforces both at write time (`update --add-verification`) and at read time
  (`validate`); it is structurally impossible to record `PASSED` with an
  empty command or no captured result.
- **`FAILED`** — only for a command that actually executed and failed.
  Requires non-empty `command` (the thing that ran); `result` is optional
  (a failure's captured output, if any) but not required, since the state
  itself already encodes the outcome.
- **`UNAVAILABLE`** — the check was not run, or the capability to run it is
  missing (no network, no binary, no permission). No `command`/`result` is
  required. This is the honest default for "I did not check this" —
  `handoff.mjs` never converts an unset or unknown state into `PASSED`; the
  caller must pick one of the four values, and "I don't know" is
  `UNAVAILABLE`, not silence.
- **`NOT_APPLICABLE`** — only when a check genuinely does not apply to this
  task (e.g. a lint check for a language this task did not touch). Requires
  non-empty `rationale` stating why. A bare "N/A" with no reason is a
  validation error.

This mirrors this repository's existing verification floor
(`AGENTS.md`, "Testing and verification": *"do not delete, skip, weaken, or
broadly mock tests merely to make them pass"* and *"report skipped or
unavailable checks explicitly"*) — the schema makes that norm mechanically
enforceable for handoff records specifically, instead of relying on an
agent to remember to phrase it that way in prose.

## Staleness

A handoff record's `baselineSha` is a claim about *when* its other fields
were evaluated, not a promise that they still hold. `handoff.mjs show`
compares `baselineSha` against the current `git rev-parse HEAD` on every
invocation and prints an explicit `STALE:` line — never silently assumes the
record still describes the working tree. `handoff.mjs promote` goes further
and refuses to promote a stale record at all, since promotion is meant to
create durable evidence, and stale evidence recorded as if it were current is
exactly the failure mode this contract exists to prevent.

Schema validity and staleness are independent checks: a record can be
schema-valid and stale, or schema-invalid regardless of its `baselineSha`.
`show` reports both, distinctly, rather than collapsing them into one
pass/fail bit.

## Codex `SessionStart` integration

`.codex/hooks/session-start.js` (see `hooks-policy-map.md`) now looks for
`tools/control-plane/generated/handoff.json` and, if present, appends a
summary to its existing advisory `additionalContext` output — objective,
branch, production-impact flag, and a staleness verdict — using the exact
same `validateHandoff`/`staleness` logic `handoff.mjs` itself uses (imported,
not re-implemented, so the two can never silently drift apart). This is
**summarization, not trust**: the hook is advisory-only exactly like the rest
of this hook layer (`hooks-policy-map.md`, "Fail-conservative vs.
degrade-safely, by hook" — `session-start.js` degrades safely and never
blocks), and it explicitly labels a stale or invalid record as such rather
than presenting it as current fact. If no handoff file exists, the hook's
output is unchanged from before this contract — this is additive, not a
replacement of the hook's existing repo-root/branch/SHA/dirty-state report.

## Claude compatibility (future work, not implemented by this contract)

Per the task's own framing, this contract keeps Claude compatibility
*possible*, without implementing it now:

- The schema and `handoff.mjs` are Claude-agnostic already — nothing in
  either references `.claude/**` or any Claude-Code-specific payload shape.
- A future step could reintroduce Claude Code slash commands named
  `/handoff` and `/resume-handoff` (or restore the retired
  `.claude/commands/handoff.md` / `resume-handoff.md` under a corrected
  path) that shell out to `node tools/control-plane/handoff.mjs update` /
  `show` respectively, instead of writing their own competing state file.
  That step is out of scope here — this contract only guarantees the target
  those future commands would call already exists, is documented, and is
  independently testable without any Claude-specific runtime present.
- Until that future step lands, `.claude/**` is absent from disk (per
  `CURRENT_STATE.md`) and no Claude-specific handoff path exists at all;
  this contract does not depend on `.claude/**` existing, being restored, or
  being deleted.

## No secrets, no transcripts

`handoff.mjs` never reads environment variables, process credentials, or
session/conversation transcripts. Every field it writes comes from an
explicit CLI argument the caller supplies (`--objective`, `--add-change`,
`--add-verification`, ...); there is no "capture everything" mode. This
follows `AGENTS.md`'s "Observability and auditability" section verbatim:
*"Do not capture raw prompts, tool arguments, outputs, secrets, or sensitive
code in telemetry by default merely for convenience."* A caller who pastes a
secret into a `--set`/`--add-*` value has done so despite the tool, not
because of it; this contract does not add a redaction layer beyond what
callers are already expected to observe repository-wide (`AGENTS.md`,
"Secrets: Never print, log, commit, paste, transmit, or persist secrets.").

## Verification

- `tests/control-plane/handoff.test.mjs` exercises `handoff.mjs` as a real
  subprocess: `init` produces a schema-valid record against real
  `git rev-parse HEAD`/branch output; `validate` accepts a valid fixture and
  rejects each malformed evidence-semantics case (`PASSED` with no
  `command`/`result`, `NOT_APPLICABLE` with no `rationale`, an unknown
  `state` value, an unknown top-level field); `update` performs an atomic
  write (verified by asserting the target file is never observed
  mid-truncation) and refuses to write a record `update` would make
  invalid; `promote` refuses a stale or invalid source record and, on a
  valid/current one, writes only under `docs/control-plane/evidence/`,
  never outside it.
- `tests/security/codex-hooks.test.mjs` gains cases for
  `session-start.js`'s handoff summary: present-and-valid, present-and-stale,
  present-and-invalid, and absent (unchanged prior behavior).
- This contract and the files it describes make no application-behavior
  changes: nothing here modifies `freeforge/**`, `netlify.toml`, or CI
  workflow trigger conditions.
