---
name: freeforge-orchestration
description: Primary multi-agent workflow for complex changes to this repository. Use when a task is large, unfamiliar, cross-cutting, or spans multiple files/modules and independent exploration, security specialization, or fresh verification would materially reduce risk. Defines the default topology, delegation contract, and adjudication procedure for coordinating subagents without expanding their authority beyond AGENTS.md.
---

# Freeforge Orchestration

## Purpose

Coordinate subagents for complex changes using a fixed, low-fan-out topology:
read-only explorers → synthesis → one implementation owner → fresh reviewer +
verifier → primary adjudication. This skill governs *how* to delegate; it does
not grant any subagent authority beyond what `AGENTS.md` already permits for
its role (Explorer, Implementer, Verifier, Security reviewer, Documentation
maintainer, Release operator).

## When to delegate

Delegation is justified only when at least one of these holds:

- **Genuine isolation** — a subtask benefits from not sharing context/bias
  with the primary thread (e.g. an adversarial verifier that should not see
  the implementer's self-report).
- **Independent exploration** — the codebase surface is unfamiliar or large
  enough that parallel read-only reconnaissance is faster and safer than
  serial exploration.
- **Security specialization** — the change touches auth, secrets, crypto,
  external input, deserialization, exec, network, migrations, concurrency,
  CI/CD, or dependencies (see `AGENTS.md` security constraints and the
  `security-and-tools` skill).
- **Fresh verification** — the implementer should not grade its own work;
  a reviewer/verifier with no stake in the diff must check it.

Do not delegate a task that is small, single-file, or already well
understood — do it directly. Do not use majority vote across multiple
implementers, recursive subagent spawning, or more than one writer touching
overlapping code at the same time.

## Default topology

```
read-only explorers  →  synthesis  →  one implementation owner
                                            │
                                            ▼
                          fresh reviewer  +  fresh verifier
                                            │
                                            ▼
                              primary adjudication
```

- **Explorers** (0–4, read-only): independent reconnaissance of distinct
  scopes. Never write, never overlap scope with another explorer.
- **Synthesis**: the primary thread reconciles explorer findings against
  source evidence (files, tests, history) — not against explorer claims
  alone — and resolves conflicts before any code is written.
- **Implementation owner**: exactly one subagent (or the primary thread
  itself) owns any given piece of overlapping code. Never split one
  cross-cutting change across multiple concurrent writers.
- **Reviewer + verifier**: dispatched fresh (no prior exposure to the
  implementer's reasoning), working from the actual diff and executed
  evidence, not the implementer's narrative. Add a `security_reviewer` when
  the change is security-sensitive per `AGENTS.md`.
- **Primary adjudication**: the primary thread — not a subagent — makes the
  final accept/revise/escalate call, using the diff and evidence, not
  agreement counts.

## Procedure

1. **Inspect baseline/dirty state.** Run read-only checks (`git status`,
   `git diff`, relevant file reads) before any delegation or mutation.
   Treat prior plans, summaries, or tickets as hypotheses until confirmed
   against current repository state.
2. **Decide whether delegation is justified** using the criteria above. If
   not justified, do the work directly and skip the rest of this procedure.
3. **Dispatch at most 2–4 bounded workers.** Fewer, tightly scoped workers
   beat many broad ones.
4. **Give each worker an explicit assignment** containing:
   - `baseline` — the commit/state it is starting from;
   - `scope` — exactly which files/areas are in bounds;
   - `objective` — what it must produce;
   - `non_goals` — what it must not do or touch;
   - `applicable_instructions` — the relevant `AGENTS.md` sections, nested
     `AGENTS.md` files, and skills (e.g. `security-and-tools`,
     `surgical-change-control`) it must follow;
   - `evidence_required` — what proof of work it must return (file paths,
     command output, diff hunks — not prose claims);
   - `return_schema` — the schema in "Delegation result schema" below.
5. **Wait for independent read-only findings** from all explorers before
   synthesizing. Do not let explorers see each other's in-progress output.
6. **Synthesize conflicts against source evidence.** Where explorers
   disagree, resolve by re-checking the repository/tests directly, not by
   picking a majority.
7. **Assign exactly one implementation owner** for any overlapping code
   surface identified during synthesis.
8. **Obtain fresh reviewer and verifier passes** after implementation,
   working from the Git diff and independently executed checks. Add
   `security_reviewer` for security-sensitive changes.
9. **Adjudicate** from the Git diff plus executed evidence — never from
   subagent self-reports alone. Confirm the diff matches the stated scope
   and that no unrelated files changed.
10. **Stop** when acceptance criteria are met, or report the specific
    blocker if one remains (per `AGENTS.md` "Mandatory escalation").

## Delegation result schema

Every dispatched worker returns:

```json
{
  "status": "ok | blocked | partial",
  "baseline": "commit/state the worker started from",
  "scope": "files/areas actually touched or examined",
  "observations": "findings relevant to the objective, with evidence pointers",
  "changes": "diff summary — only present if the worker is a writer",
  "verification": "commands/checks run and their results",
  "risks": "known gaps, assumptions, or residual risk",
  "recommended_next_action": "what the primary thread should do next"
}
```

Workers that are not writers omit `changes`. A worker reporting `status:
ok` with no `verification` evidence has not actually verified anything —
treat that as `partial`.

## Non-goals

- This skill does not grant subagents any tool access, filesystem scope, or
  network/secret permission beyond what `AGENTS.md` and the runtime already
  allow for their role. It is a coordination contract, not a permission
  grant.
- Do not port the legacy 7-axes workflow (previously under `.claude/` /
  `.codex/`) into this skill. Only add topology elements here when a
  concrete repository need demonstrates they are missing — this skill stays
  minimal by default.
- No majority vote, no recursive subagent spawning, no overlapping writers.

## Escalation

If applicable instructions materially conflict, a worker requests authority
outside its role, or scope grows substantially beyond the original task,
stop and escalate per `AGENTS.md` "Mandatory escalation" instead of
resolving it silently inside the orchestration loop.
