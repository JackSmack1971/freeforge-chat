# Project Agent Baseline

## Operating Contract

Use the smallest safe change that satisfies the objective. Prefer reading existing code patterns before creating new files. Keep the main session context clean by delegating noisy exploration, test-log analysis, security review, and broad codebase mapping to specialized subagents.

## Default Commands

- Lint: `npx --yes @biomejs/biome@1.9.4 check freeforge/src tests/security`
- Test: `npm --prefix freeforge test`
- Build: no build step — static files are served as-is.

## Engineering Standards

- Preserve public APIs unless the task explicitly requests a breaking change.
- Use explicit error handling for I/O, network, database, auth, and file operations.
- Keep functions small, named, and testable. Prefer existing abstractions over new frameworks.
- Add or update tests for behavioral changes.
- Avoid broad refactors during bug fixes unless required for correctness.
- Never hardcode secrets, tokens, production URLs, private keys, or local absolute paths.

## Completion Evidence

Every completed implementation must include:

- Summary of changes.
- Files modified.
- Tests or validation commands run.
- Raw final pass/fail status.
- Known limitations or follow-up work.

<!-- GSD:project-start source:PROJECT.md -->

## Project

**FreeForge — Portfolio Quality Pass**

FreeForge is a self-contained, zero-dependency browser chat UI that talks directly to the OpenRouter API using only free models. No server, no build step, no tracking — just open the HTML file and chat.

The v1 implementation is feature-complete: onboarding with key validation, streaming chat, model selector, markdown rendering, copy/regenerate buttons, localStorage persistence, settings modal, error handling, and responsive dark UI. This project is the **quality pass** that takes it from "it works" to "impressive portfolio piece" — tight code, accessible markup, polished UX, and clean architecture.

**Core Value:** A single HTML file you can open, share, or deploy anywhere — beautiful enough to show in a portfolio, tight enough to show in the code.
<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->

## Technology Stack

FreeForge is a browser-first chat app with no runtime build step. The shipped app lives under `freeforge/` and opens directly in the browser.

## Languages

- JavaScript (ES modules) in `freeforge/src/**/*.js`
- HTML in `freeforge/index.html`
- CSS in `freeforge/styles/**/*.css`
- TOML in `netlify.toml`
- Node.js test modules in `tests/security/**/*.mjs`

## Runtime

- Browser runtime for the application shell and all user-facing behavior
- Node.js only for local tests and repo tooling
- Static hosting on Netlify via `netlify.toml`

## Frameworks and Libraries

- No front-end framework
- `marked@18.0.4` for Markdown parsing, loaded in `freeforge/index.html`
- `dompurify@3.4.8` for HTML sanitization, loaded in `freeforge/index.html`
- Tailwind CSS is used as prebuilt CSS, not through a bundler

## Key Dependencies

- `marked@18.0.4` — Markdown-to-HTML rendering for AI responses (`freeforge/src/markdown.js`)
- `dompurify@3.4.8` — XSS sanitization of rendered LLM output (`freeforge/src/markdown.js`)
- `tailwindcss@3` (local bundle) — All UI styling in `freeforge/index.html`

## Configuration

- No `.env` files; no server-side environment variables required
- The only runtime secret is the OpenRouter API key, stored in `sessionStorage` under key `ff_key` (browser-only, never server-side)
- `netlify.toml` publishes `freeforge/` and sets security headers
- `biome.json` configures linting for `freeforge/src` and `tests/security`

## Platform Requirements

- A modern browser (ES modules, Fetch API, ReadableStream, TextDecoder, localStorage required)
- No npm/pnpm/yarn install step needed
- Static file hosting only (no server, no database, no build pipeline)

<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->

## Conventions

## Language and Module System

- Plain JavaScript — no TypeScript, no build step, no bundler.
- ES modules throughout: `import`/`export` with `.js` extensions on all import paths.
- Runs directly in the browser via `<script type="module">` in `freeforge/index.html`.
- No root `package.json` — scripts rely solely on Node built-ins.

## Naming Patterns

- `camelCase` for all source files: `app.js`, `state.js`, `messages.js`, `chat.js`.
- Feature grouping under `freeforge/src/features/` and UI under `freeforge/src/ui/`.
- `camelCase` for all exported and local functions: `sendMessage`, `renderAllMessages`, `fetchFreeModels`, `maskKey`, `fmtCtx`.
- Verb-first naming for action functions: `openSettings`, `closeSettings`, `updateKey`, `clearKey`, `loadModels`, `validateAndConnect`.
- Event handler callbacks are inline arrow functions, not named.
- `camelCase` for locals: `savedKey`, `lastAsstIdx`, `firstToken`.
- Short abbreviations used consistently within scope: `btn`, `inp`, `err`, `ctrl`, `dec`, `buf`.
- Single-letter loop variables: `k`, `m`, `e` (event), `t` (trimmed line), `j` (parsed JSON).
- Module-level shared state is a plain object named `S` exported from `freeforge/src/state.js`.
- localStorage helpers exported as `LS` from the same file.
- DOM helper `$` is a shorthand for `document.getElementById`, exported from `state.js`.
- Browser storage keys use `ff_` prefix: `ff_key` in `sessionStorage`; `ff_msgs` and `ff_model` in `localStorage`.
- Named exports for shared modules.
- No default exports.

## Code Style

- 2-space indentation throughout.
- Single quotes for strings in JS source; backtick template literals for interpolated strings.
- Semicolons present on all statements.
- No trailing commas in function argument lists; trailing commas used in multi-line array/object literals.
- Opening brace on same line as control flow (`if`, `for`, `try`, `function`).
- Arrow functions used for short callbacks; `async function` declarations for top-level named async functions.
- Single blank line between export groups.
- No blank lines between closely related one-liners (e.g., state field assignments).
- Short guard returns on one line: `if (!text || S.streaming) return;`
- Ternary expressions used for short conditional assignments and template literal branches.

## Import Organization

- Always relative with `.js` extension.
- No barrel index files; each module imported directly.

## Error Handling

- `try/catch` used at all `fetch` and `JSON.parse` boundaries.
- `catch {}` (swallow) used only for `localStorage` operations where failure is non-fatal (`freeforge/src/state.js`).
- Async errors surfaced to the user via `toast(errMsg, 'error')` from `freeforge/src/ui/toast.js`.
- HTTP error codes handled with specific user-facing messages (401, 429, 400, 413) in `freeforge/src/api.js`.
- `AbortError` from `fetch` treated as a normal cancellation, not an error.

## Security Conventions

- Secrets kept in environment variables, never in source files.
- PII and tokens redacted from logs.
- Safe error messages to clients; detailed diagnostics kept internal.

## Logging

- No structured logger or log library in `freeforge/src/` — no `console.log` calls in production paths.

## Comments

- Inline section comments used in `app.js` to label event-listener groups: `// onboarding`, `// model select`, `// settings`, etc.
- `// delegated` and `// avoid circular dep` notes explain non-obvious architectural decisions.
- No JSDoc/TSDoc annotations in current source.

## Function Design

- Functions are small and single-purpose: most are under 20 lines.
- Async functions use `await` with `try/catch`; no `.then().catch()` chaining.
- Callbacks passed as named-property objects: `{ onToken, onDone, onError }` — not positional.
- DOM manipulation co-located with the feature that owns it; no centralized DOM abstraction layer.

## Module Design

- One concern per file: `api.js` handles HTTP, `state.js` holds shared state, `markdown.js` renders markdown.
- Named exports only; no default exports.
- No barrel/index re-export files.
- Circular dependency explicitly avoided: `regenerate` button handled via delegated `document.addEventListener` in `app.js` rather than a direct import between `messages.js` and `chat.js`.

## Gaps / Unknowns

- No linter or formatter config beyond `biome.json`. Style consistency relies on Biome enforcement.
- No `package.json` at repo root — no root-level dependency manifest or version pinning.

<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->

## Architecture

FreeForge is a single-page browser application with a small module graph. The entrypoint wires DOM events, feature modules own user flows, UI helpers render, and `state.js` holds shared runtime state.

## Component Responsibilities

| Component | Responsibility | Path |
|-----------|----------------|------|
| app.js | DOM event wiring, init flow, screen routing | `freeforge/src/app.js` |
| state.js | Singleton state object `S`, localStorage wrapper `LS`, DOM helper `$`, utilities | `freeforge/src/state.js` |
| api.js | OpenRouter REST calls: model list fetch and SSE streaming | `freeforge/src/api.js` |
| features/chat.js | sendMessage, regenerate, newChat — full message lifecycle | `freeforge/src/features/chat.js` |
| features/models.js | Fetch and populate free-model dropdown; preference logic | `freeforge/src/features/models.js` |
| features/onboarding.js | API key validation and initial connection | `freeforge/src/features/onboarding.js` |
| features/settings.js | Key update, clear, settings modal open/close | `freeforge/src/features/settings.js` |
| ui/messages.js | Full message list render, streaming DOM updates, copy/regen buttons | `freeforge/src/ui/messages.js` |
| ui/screen.js | Screen visibility switching (onboarding vs chat), invalid-API-key banner | `freeforge/src/ui/screen.js` |
| ui/toast.js | Ephemeral notification display | `freeforge/src/ui/toast.js` |
| markdown.js | Markdown-to-HTML rendering for assistant messages | `freeforge/src/markdown.js` |

## Patterns

- `state.js` exports the singleton `S` — all modules import it directly. There is no Flux/Redux abstraction.
- `app.js` is the only file that touches the DOM for event binding; feature modules call back into `ui/` helpers.
- No framework, no build step. ES modules loaded natively by the browser from `freeforge/index.html`.

## Layers

- **State layer** (`freeforge/src/state.js`) — `S` singleton, `LS` localStorage wrapper, `$` DOM id helper, pure utilities. Depends on nothing; used by every module.
- **API layer** (`freeforge/src/api.js`) — all network I/O with OpenRouter. Contains `fetchFreeModels`, `streamCompletion`. Depends on `state.js`.
- **Feature layer** (`freeforge/src/features/`) — business logic per domain. Depends on `state.js`, `api.js`, `ui/`.
- **UI layer** (`freeforge/src/ui/`) — DOM manipulation and rendering. Depends on `state.js`, `markdown.js`.

## Architectural Constraints

- **No build step:** ES modules loaded natively; no bundler, no transpiler.
- **Global state:** `S` in `state.js` is a module-level singleton. All mutations are synchronous except during streaming.

## Error Handling

- `api.js` maps HTTP status codes to user-facing error strings; 401 triggers the invalid-API-key banner.
- `AbortError` (user cancelled stream) is silently swallowed via `onDone('')`.
- `onError` in `chat.js` removes the in-flight assistant message and shows a toast.

<!-- GSD:architecture-end -->

<!-- GSD:profile-start -->

## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
