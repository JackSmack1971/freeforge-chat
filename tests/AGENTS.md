# Tests — Agent Context

> **READ FIRST** before editing or adding tests. Parent context: `../README.md` and `../CLAUDE.md`.

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
```

## How to Run

```bash
node --test tests/security/*.test.mjs
# or single file:
node --test tests/security/markdown-pipeline.test.mjs
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
