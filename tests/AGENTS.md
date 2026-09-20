# Tests — Agent Context

> **READ FIRST** before editing or adding tests. Parent context: `../README.md` and `../AGENTS.md`.

## Ownership

This directory owns all automated tests for FreeForge. Tests run in Node.js using the built-in
`node:test` runner — no test framework install required.

## Layout

```
tests/
  helpers/
    mock-dom.mjs         521 lines — DOM/storage/fetch environment for unit tests
  security/
    state-storage.test.mjs      sessionStorage/localStorage key isolation
    state-utils.test.mjs        pure utility helpers in state.js
    style-csp.test.mjs          inline style attributes vs CSP
    innerhtml-audit.test.mjs    innerHTML assignment audit across all modules
    markdown-pipeline.test.mjs  marked + DOMPurify integration, XSS surface
    api-error-paths.test.mjs    HTTP error code handling (401, 429, 400, 413)
    chat-context-tokens.test.mjs  context-token tracking and overflow guard
    runtime-app.test.mjs        full app.js boot and event-wiring integration
    runtime-state-api.test.mjs  streaming, abort, model fetch integration
    runtime-ui-features.test.mjs  settings modal, onboarding, copy/regen UI
    codex-config.test.mjs       .codex/config.toml parseability + disallowed-setting checks
    codex-execpolicy-rules.test.mjs  .codex/rules/default.rules execpolicy behavior
    codex-hooks.test.mjs        .codex/hooks/*.js fixture-driven behavior tests
    production-boundary.test.mjs  merge-to-main production-publication policy contract
  control-plane/
    fixtures/                  deterministic good/malformed/snapshot-* fixture roots
    verify.test.mjs             tools/control-plane/verify.mjs conformance + identity fixtures
    snapshot.test.mjs           tools/control-plane/snapshot.mjs determinism/dirty-state fixtures
    handoff.test.mjs            tools/control-plane/handoff.mjs schema/evidence-state fixtures
    policy-invariants.test.mjs  cross-cutting monotonicity + unrelated-dirty-state invariants
    coverage-matrix.test.mjs    maps each conformance-goal scenario to a real, currently-passing test
```

`tests/control-plane/` is a distinct suite from `tests/security/`: it is a conformance/evaluation
suite for the control-plane tooling itself (`tools/control-plane/*.mjs`, `.codex/rules/*.rules`,
`.codex/hooks/*.js`, `.agents/skills/**`), not application behavior. Keep it separate — do not
merge its fixtures or assertions into `tests/security/`, and do not have it re-implement the
tools it tests; every test spawns the real entry point in `tools/control-plane/` (or the real
`.codex/hooks/*.js` script) as a subprocess.

Do not add top-level `tests/*.test.mjs` files outside `tests/security/` or `tests/control-plane/`
unless this file is updated to document a new canonical location.

## How to Run

```bash
node --test tests/security/*.test.mjs
# or single file:
node --test tests/security/markdown-pipeline.test.mjs

# control-plane conformance suite (separate from the above):
node --test tests/control-plane/*.test.mjs
```

No install step. Tests import source files directly via `node:path` + `pathToFileURL`.

## The `mock-dom.mjs` Helper

`makeBaseDom()` builds a `MockDocument` with every DOM element id FreeForge expects at
startup. Tests call this instead of `jsdom` — it is intentionally lightweight and partial.

Key exports:
- `makeBaseDom()` — returns a `MockDocument` pre-populated with all app element ids
- `makeWindow()` — returns a `MockEventTarget` standing in for `window`
- `installGlobals(values)` — injects globals (`document`, `window`, `localStorage`,
  `sessionStorage`, `fetch`, `marked`, `DOMPurify`, etc.) and returns a `restore()` teardown
- `importFresh(relPath)` — cache-busted dynamic import (use for modules that capture globals
  at load time, e.g. `app.js`)
- `importShared(relPath)` — stable import (use for `state.js` singleton shared across tests)
- `MemoryStorage({ seed }, opts)` — in-memory localStorage/sessionStorage replacement;
  supports `throwOnGet/Set/Remove` to simulate quota errors
- `makeFetchResponse({ ok, status, json, body })` — mock fetch response factory
- `makeClipboard()` — records `writeText` calls for clipboard assertion

## Invariants Every Test Must Preserve

1. **Always restore globals.** Every test that calls `installGlobals()` must wrap the test
   body in `try/finally { restore(); }`. Leaked globals corrupt subsequent tests.
2. **State reset before app.js import.** Call `resetState(S)` on the shared `state.S`
   singleton before each `importFresh('freeforge/src/app.js')` — the singleton persists
   across cache-busted imports.
3. **No real network.** Stub `fetch` in `installGlobals`; never allow tests to reach
   `api.openrouter.ai`.
4. **No real storage.** Seed `MemoryStorage` explicitly; never rely on actual
   `localStorage`/`sessionStorage`.
5. **Await micro-tasks after events.** DOM events are synchronous but side effects
   (model load, stream complete) are async. Use `await new Promise(r => setTimeout(r, 0))`
   after dispatching events that trigger async work.

## Adding a Test

1. Import from `../helpers/mock-dom.mjs`.
2. Call `makeBaseDom()` and `installGlobals(...)` at the top of each `test()`.
3. For modules that capture globals at import time (`app.js`), use `importFresh`; for the
   state singleton, use `importShared`.
4. Assert against DOM state (`classList`, `innerHTML`, `children`) and `state.S` properties,
   not internal implementation details.
5. Test both the success path and the relevant failure paths (quota error, 401, stream abort).

## What Belongs Here vs `freeforge/src/`

Tests validate **observable behavior**: DOM mutations, storage reads/writes, toast messages,
API call shapes, and error recovery. They do not test private function internals.
New security invariants (new innerHTML site, new storage key, new CSP-relevant attribute)
get a dedicated test in `security/`.
