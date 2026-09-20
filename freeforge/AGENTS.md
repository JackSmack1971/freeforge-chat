# freeforge/ — Agent Context

Local addendum to the root `AGENTS.md`. Read the root file first; this document
only covers what differs for the application code under `freeforge/`.

## Architecture

- Zero-build, browser-only static app. `freeforge/index.html` loads
  `freeforge/src/**` directly as native ES modules — no bundler, transpiler,
  or framework, and no server component.
- Do not introduce a build step, framework, or bundler to solve a task in
  this directory unless the task explicitly requires it. Prefer the existing
  module/DOM patterns over adding a new abstraction or dependency.
- CDN runtime libraries (`marked`, `dompurify`, Tailwind) are loaded from
  `freeforge/index.html` with SRI hashes pinned in `netlify.toml`'s CSP
  `script-src`. Changing a CDN version requires updating both the `<script>`
  tag's SRI hash and the matching CSP hash together, or the page fails to
  load under the deployed CSP.

## Module boundaries

| Layer | Files | Depends on |
|---|---|---|
| State | `state.js`, `agent-schema.js`, `agent-storage.js` | nothing (leaf layer) |
| API | `api.js` | `state.js` |
| Feature | `features/*.js`, `agent-runtime.js` | `state.js`, `api.js`, `ui/*` |
| UI | `ui/*.js` | `state.js`, `markdown.js` |
| Entrypoint | `app.js` | all of the above (only file that binds DOM events) |

Rules that keep this graph acyclic:

- Only `app.js` attaches top-level DOM event listeners; feature modules call
  into `ui/` to render, not the other way around.
- `agent-runtime.js` is feature-facing: called from `features/chat.js` and
  `features/agents.js` only. Never import it from `ui/`.
- `state.js`'s singleton `S` and its `LS` localStorage wrapper are the only
  shared mutable state. Do not add a second global state container.
- No barrel/index re-export files; import each module directly by path.

## Security invariants (see also root `AGENTS.md` and `security/constitution.md`)

- The OpenRouter API key lives in `sessionStorage` under `ff_key` only.
  Never write it to `localStorage`, a log, an export, or committed source.
- Any remote or persisted JSON (model list, agent persona data, imported
  conversation/agent files) is untrusted until validated and normalized
  against its schema (see `agent-schema.js` for the pattern) — do not consume
  it into state or render it before validation.
- Assistant/markdown content must pass through `marked` and then DOMPurify
  before it reaches `innerHTML`. Never assign unsanitized `marked()` output,
  or any other untrusted string, to `innerHTML` directly.
- Preserve the CSP, security headers, and SRI hashes in `netlify.toml` and
  `freeforge/index.html`; do not relax `script-src`, remove SRI, or add an
  inline script/style that the current CSP would otherwise block.

## Testing

Tests for this directory live in `tests/security/` and `tests/helpers/`, not
alongside the source files — see `tests/AGENTS.md` for the test contract.
Tests assert observable behavior (DOM state, storage reads/writes, toast
messages, API call shapes) rather than internal function calls; a new
innerHTML site, storage key, or CSP-relevant attribute needs a dedicated test
in `tests/security/`.
