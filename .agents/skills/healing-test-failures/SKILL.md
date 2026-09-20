---
name: healing-test-failures
description: Diagnose a failing test before touching production code — reproduce, classify, minimize, fix with a strict two-cycle cap per error signature, and escalate with evidence when the cap is hit.
compatibility: Requires Node.js 22+ and the repository's `node:test` suite under `tests/security/`.
---

# Healing Test Failures

## Core principle

**Diagnose before changing production code.** A test failure is evidence, not an
instruction to edit the nearest file. Do not touch `freeforge/src/` until you know
whether the defect is in that source, in the test itself, or in the environment
running it.

## Required workflow

Complete each step in order. Do not skip ahead to remediation.

### 1. Reproduce the exact failure

Run the failing command exactly as reported — do not paraphrase it or swap in a
broader command yet.

```bash
node --test tests/security/<name>.test.mjs
```

Capture the raw stdout/stderr verbatim. Record the current commit (`git rev-parse
HEAD`) as the baseline SHA before making any change. If the failure does not
reproduce on the first try, run it 2-3 more times before concluding it is flaky —
`node:test` failures in this repo are almost always deterministic (see
`tests/AGENTS.md`); an inconsistent result is itself a finding (see step 2,
environment/tooling).

### 2. Classify the failure

Decide which bucket the failure belongs to before writing any fix:

- **Production defect** — `freeforge/src/*` produces behavior that contradicts its
  documented/tested contract (e.g. a DOM mutation, storage key, or sanitize step
  described in `AGENTS.md` / `tests/AGENTS.md` is missing or wrong).
- **Test defect** — the test asserts something the contract does not actually
  require, uses a stale fixture, or misuses `tests/helpers/mock-dom.mjs` (e.g.
  missing `restore()`, missing `resetState(S)`, asserting on a global that was
  never installed).
- **Environment/tooling defect** — failure depends on Node version, run order,
  leaked global state, or timing, not on the test's assertions being wrong. In
  this codebase this almost always traces back to one of the invariants in
  `tests/AGENTS.md` §"Invariants Every Test Must Preserve": unrestored globals,
  stale `state.S`, an unresolved microtask, or a stray network/storage call.

Only "production defect" justifies editing `freeforge/src/`. "Test defect" is
fixed in `tests/security/`. "Environment/tooling" is fixed in the test's setup
(`installGlobals`/`restore`/`resetState`/awaited microtask), not in application
code.

### 3. Minimize to the smallest failing case

Narrow to the single failing `test()` block, not the whole file:

```bash
node --test --test-name-pattern="<exact test name>" tests/security/<name>.test.mjs
```

If the failure only appears when the full suite runs (`npm --prefix freeforge
test`) but not in isolation, that itself is diagnostic: it points at shared
state leaking across tests (unrestored global, un-reset `state.S`, or import
caching — see `importFresh` vs `importShared` in `tests/AGENTS.md`), i.e. an
environment/tooling defect, not the isolated test's logic.

### 4. Inspect the relevant source and test contract

Before writing a fix, read:

- The `freeforge/src/` module(s) the test exercises.
- The test file itself, especially its `installGlobals(...)` call, whether it
  wraps in `try/finally { restore(); }`, whether it calls `resetState(S)` before
  `importFresh('freeforge/src/app.js')`, and whether it awaits a microtask
  (`await new Promise(r => setTimeout(r, 0))`) after dispatching an event that
  triggers async work (stream completion, model load).
- `tests/helpers/mock-dom.mjs` for the exact shape of `MockDocument`,
  `MemoryStorage`, and `makeFetchResponse` if the failure touches DOM, storage,
  or fetch mocking.
- The nearest `AGENTS.md` (root, then `tests/AGENTS.md`) for the invariant the
  test is meant to enforce (no real network, no real storage, sanitize-before-
  `innerHTML`, sessionStorage-only key storage, etc.).

Do not guess the contract from the test name alone.

### 5. Remediate — at most two targeted cycles per error signature

An "error signature" is the specific assertion message / stack frame / thrown
error, not just "the test is red." For a given error signature:

- **Cycle 1**: form one hypothesis from steps 1-4, make the smallest change that
  tests it (one file, one root cause — no bundled cleanup), rerun the narrowed
  command from step 3.
- **Cycle 2** (only if cycle 1's rerun still shows the *same* error signature):
  form a new hypothesis informed by cycle 1's result, make one more targeted
  change, rerun.
- If the *same* error signature appears a third time: **stop**. Do not attempt a
  third remediation. Produce the escalation payload (below) instead.

A different error signature after a fix is progress, not a repeat — it starts a
fresh two-cycle budget for the new signature, but note in your report that the
symptom changed.

### 6. Rerun focused validation after each cycle

After every remediation attempt, rerun only the narrowed command from step 3
first. Do not broaden scope while the focused case is still red.

### 7. Broaden only after focused success

Once the narrowed test/test-name-pattern passes, broaden in this order and stop
if any step fails (treat a new failure as its own diagnosis, not a rubber-stamp
retry):

```bash
node --test tests/security/<name>.test.mjs      # whole file
npm --prefix freeforge test                      # full suite
npx --yes @biomejs/biome@1.9.4 check freeforge/src tests/security tests/helpers
```

Both commands are listed as the repository's "Full pre-merge verification" in
`AGENTS.md` — run them before calling the fix done.

### 8. Stop on repeated identical failure — produce the escalation payload

If step 5's cap is hit (same error signature survives two targeted remediation
cycles), stop editing and assemble the escalation payload below instead of
attempting a third fix.

## Escalation payload

Produce exactly these fields, backed by evidence gathered in steps 1-7 — do not
summarize from memory:

- **Baseline SHA** — `git rev-parse HEAD` captured in step 1, before any edits.
- **Exact command** — the precise command from step 1 or step 3 that fails.
- **Raw stdout/stderr** — verbatim output (or a faithful excerpt if very long —
  keep the assertion diff and stack trace, trim repeated boilerplate).
- **Error signature** — the specific assertion/exception that repeated
  identically across both remediation cycles.
- **Files changed** — every file touched across both cycles (`git diff
  --stat` since the baseline SHA), even ones later reverted.
- **Hypothesis** — current best explanation of the root cause, and why cycles 1
  and 2 did not resolve it.
- **Attempted remediations** — what each of the two cycles changed and the
  resulting (still-identical) error signature.
- **Remaining evidence needed** — what would disambiguate the hypothesis (e.g.
  "needs confirmation whether `state.S` is shared with another in-flight test
  file run in the same process").

### Reporting the escalation

State the payload to the user/caller directly. **Do not open or update a GitHub
issue automatically.** Only use an issue-filing capability if one is available in
this session *and* its use for this action has been explicitly authorized —
this skill can request that external effect, but it cannot grant itself the
authority to perform it. If no such capability or approval exists, stop after
presenting the payload and wait for direction.

## What NOT to do

- Do not edit `freeforge/src/` to make a test pass without first classifying the
  failure as a production defect (step 2).
- Do not weaken, delete, or skip an assertion to make a test go green — that is
  never a valid remediation for any classification.
- Do not attempt a third remediation cycle for the same error signature; escalate
  instead.
- Do not broaden to the full suite or Biome while the narrowed case is still
  failing.
- Do not fabricate or paraphrase stdout/stderr in the escalation payload — quote
  it.
