# Project Agent Baseline

## Operating Contract

Use the smallest safe change that satisfies the objective. Prefer reading existing code patterns before creating new files. Keep the main session context clean by delegating noisy exploration, test-log analysis, security review, and broad codebase mapping to specialized subagents.

## Swarm Execution Pattern

1. Clarify the objective only when required to prevent destructive or irreversible work.
2. Inspect repository state with `git status --short` and `git branch --show-current` before edits.
3. Build a brief plan naming target files, risks, test strategy, and rollback approach.
4. Use read-only agents for discovery, architecture review, security review, and quality review.
5. Use writer agents only for bounded implementation tasks with explicit target paths.
6. Run targeted tests after edits. Run full quality gate before commit, merge, deploy, or release.
7. When `.claude/**`, `.mcp.json`, `managed-settings.json`, `CLAUDE.md`, or `AGENTS.md` changes, run `/control-plane-check` before broader quality claims.
8. When pausing a multi-step task, update `.claude/handoff/current-task.json` with `/handoff`.
9. When resuming a paused task, read `.claude/handoff/current-task.json` or run `/resume-handoff` before broad rediscovery.
10. After installing or upgrading this framework in a real repository, run `/runtime-smoke-check`.
11. Report completion with modified files, verification evidence, unresolved risks, and next actions.

## Default Commands

- Install: detect from lockfile (`npm ci`, `pnpm install --frozen-lockfile`, `uv sync`, `poetry install`, `cargo fetch`, etc.).
- Lint: prefer `npm run lint`, `pnpm lint`, `ruff check`, `cargo clippy`, or project equivalent.
- Typecheck: prefer `npm run typecheck`, `pnpm typecheck`, `mypy`, or project equivalent.
- Test: prefer targeted tests first, then full suite for release readiness.
- Build: prefer `npm run build`, `pnpm build`, `cargo build`, or project equivalent.

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

## Summary

## Languages

- JavaScript (ES2020+) — All runtime code: hooks in `.claude/hooks/**/*.js`, FreeForge app in `freeforge/src/**/*.js`
- Markdown — Agent definitions, rules, skills, commands in `.claude/**/*.md`
- JSON — Configuration: `.claude/settings.json`, `managed-settings.example.json`
- HTML5 — Application shell: `freeforge/index.html`, `freeforge.html`
- CSS3 — Custom styles: `freeforge/styles/app.css`

## Runtime

- Browser (client-side only) — FreeForge app runs entirely in the browser; no Node runtime required at deploy time
- Node.js — Required only for `.claude/hooks/**/*.js` hook scripts during Claude Code sessions (version not pinned; any LTS likely sufficient given the simple scripts)
- None detected — No `package.json`, `pnpm-lock.yaml`, `yarn.lock`, or any lockfile present in the repository

## Frameworks

- None — FreeForge uses vanilla ES modules with no framework
- Claude Code settings schema (`https://json.schemastore.org/claude-code-settings.json`) governs `.claude/settings.json`
- Tailwind CSS v3 (JIT) — Loaded via CDN at `https://cdn.tailwindcss.com` in `freeforge/index.html`; no local install
- marked v9.1.6 — Loaded via jsDelivr CDN with SRI hash in `freeforge/index.html`
- DOMPurify v3.1.6 — Loaded via jsDelivr CDN with SRI hash in `freeforge/index.html`
- Not detected — No test framework, test files, or test scripts present
- Not detected — No bundler (Vite, webpack, esbuild, etc.), no build step; files are served as-is

## Key Dependencies

- `marked@9.1.6` — Markdown-to-HTML rendering for AI responses (`freeforge/src/markdown.js`)
- `dompurify@3.1.6` — XSS sanitization of rendered LLM output (`freeforge/src/markdown.js`)
- `tailwindcss@3` (JIT CDN) — All UI styling in `freeforge/index.html`
- Node.js standard library — Used by hook scripts in `.claude/hooks/**/*.js` (fs, path, child_process implied)

## Configuration

- No `.env` files detected; no server-side environment variables required
- The only runtime secret is the OpenRouter API key, stored in `sessionStorage` under key `ff_key` and migrated out of any legacy `localStorage` copy on first read (browser-only, never server-side)
- No build config files (no `vite.config.*`, `webpack.config.*`, `tsconfig.json`, etc.)
- `managed-settings.example.json` — Template for centrally managed Claude Code policy; not a build config
- `.claude/settings.json` — Permission allow/deny/ask lists, hook registrations, plugin enablement
- `.claude/settings.local.example.json` — Template for developer-local overrides (not committed)

## Platform Requirements

- A modern browser (ES modules, Fetch API, ReadableStream, TextDecoder, localStorage required)
- Node.js (any recent LTS) for Claude Code hook execution
- No npm/pnpm/yarn install step needed
- Static file hosting only (no server, no database, no build pipeline)
- `freeforge/index.html` or the standalone `freeforge.html` can be opened directly from the filesystem or served from any static host (GitHub Pages, Netlify, S3, etc.)

<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->

## Conventions

## Summary

## Language and Module System

- Plain JavaScript — no TypeScript, no build step, no bundler.
- ES modules throughout: `import`/`export` with `.js` extensions on all import paths.
- Runs directly in the browser via `<script type="module">` in `freeforge/index.html`.
- CommonJS (`require`/`module.exports`) in hook validators and workflow scripts.
- Shebang line `#!/usr/bin/env node` on all executable hook files.
- No package.json, no lockfile — scripts rely solely on Node built-ins (`fs`, `path`, `child_process`).

## Naming Patterns

- `camelCase` for all source files: `app.js`, `state.js`, `messages.js`, `chat.js`.
- Feature grouping under `freeforge/src/features/` and UI under `freeforge/src/ui/`.
- Hook files use `kebab-case`: `analyze-command.js`, `protect-files.js`, `session-start.js`.
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
- Named exports for shared modules (per `.claude/rules/typescript.md`).
- Explicit public function and component prop types.
- Avoid `any`; prefer `unknown`, generics, or discriminated unions.

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
- Hook scripts write diagnostics to `process.stderr` and exit with a non-zero code on unexpected failures.

## Security Conventions

- Secrets kept in environment variables, never in source files.
- Parameterized queries for database access.
- PII and tokens redacted from logs.
- Safe error messages to clients; detailed diagnostics kept internal.

## Logging

- No structured logger or log library in `freeforge/src/` — no `console.log` calls in production paths.
- Node hook scripts write summaries to `process.stdout` as JSON or plain strings; errors to `process.stderr`.

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

## Agent / Automation Framework Conventions

- Use smallest safe change. Read existing patterns before creating files.
- Never hardcode secrets, tokens, production URLs, or local absolute paths.
- Prefer existing abstractions over new frameworks.
- Control-plane files (agents, commands, hooks, workflows, rules, settings) treated as high-risk; require `/control-plane-check` after edits.
- Hook scripts: prefer Node or Python over shell pipelines for cross-platform reliability.
- Writer agents require explicit target paths, prerequisites, and loop-stop conditions.

## Gaps / Unknowns

- No linter or formatter config detected (no `.eslintrc`, `.prettierrc`, `biome.json`). Style consistency relies entirely on human discipline.
- No `package.json` at repo root or in `freeforge/` — no dependency manifest, no version pinning.
- TypeScript rules in `.claude/rules/typescript.md` exist but no `.ts` files are present. Rules are aspirational / forward-looking.
- No explicit code review checklist beyond the rules files.

<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->

## Architecture

## Summary

## System Overview

```text

```

## Component Responsibilities

### Swarm Framework

| Component | Responsibility | Path |
|-----------|----------------|------|
| CLAUDE.md | Operating contract, command shortcuts, engineering standards | `CLAUDE.md` |
| settings.json | Permission allow/deny/ask lists; hook event wiring | `.claude/settings.json` |
| Commands | Slash-command definitions invoked by the user | `.claude/commands/*.md` |
| Agents | Named subagent personas with model, tools, isolation | `.claude/agents/*.md` |
| Skills | Reusable multi-step procedures loaded on demand | `.claude/skills/*/SKILL.md` |
| Rules | Path-scoped behavioral constraints loaded into context | `.claude/rules/*.md` |
| Hooks (validators) | PreToolUse gates: block dangerous Bash, protect files | `.claude/hooks/validators/*.js` |
| Hooks (workflow) | Session lifecycle: startup summary, format-on-write, stop summary | `.claude/hooks/workflow/*.js` |
| Workflows | Optional dynamic agent orchestration programs | `.claude/workflows/*.js` |
| Handoff | JSON state persisted across session boundaries | `.claude/handoff/current-task.json` |

### FreeForge Application

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

### Swarm Framework

- The main Claude Code session is the sole orchestrator; subagents never spawn other agents (`disallowedTools: [Agent]` on every agent definition).
- Two agent classes: **read-only reviewers** (`permissionMode: plan` or `dontAsk`, no Write/Edit tools) and **writer agents** (`permissionMode: acceptEdits`, `isolation: worktree`, bounded `maxTurns`).
- Control-plane files (agents, commands, hooks, rules, settings, CLAUDE.md) are protected by two independent mechanisms: the `protect-files.js` PreToolUse hook and the `settings.json` `ask` permission list.
- Skills decouple reusable procedures from commands. A command (e.g., `/swarm`) is a thin dispatcher; deep logic lives in a skill (`orchestrating-swarm/SKILL.md`).

### FreeForge

- `state.js` exports the singleton `S` — all modules import it directly. There is no Flux/Redux abstraction.
- `app.js` is the only file that touches the DOM for event binding; feature modules call back into `ui/` helpers.
- No framework, no build step. ES modules loaded natively by the browser from `freeforge.html`.

## Data Flow

### Swarm: User Objective to Completion

### Swarm: Session Start

### Swarm: PreToolUse Gate

### FreeForge: Send Message

## Layers (FreeForge)

- Purpose: single source of truth for all runtime data
- Location: `freeforge/src/state.js`
- Contains: `S` singleton, `LS` localStorage wrapper, `$` DOM id helper, pure utilities
- Depends on: nothing
- Used by: every other module
- Purpose: all network I/O with OpenRouter
- Location: `freeforge/src/api.js`
- Contains: `fetchFreeModels`, `streamCompletion`
- Depends on: `state.js` (for `S.abort`)
- Used by: `features/models.js`, `features/chat.js`
- Purpose: business logic per domain (chat, models, onboarding, settings)
- Location: `freeforge/src/features/`
- Depends on: `state.js`, `api.js`, `ui/`
- Used by: `app.js`
- Purpose: DOM manipulation and rendering
- Location: `freeforge/src/ui/`
- Contains: screen switching, message rendering, toast notifications
- Depends on: `state.js`, `markdown.js`
- Used by: `features/`, `app.js`

## Key Abstractions

- Purpose: Declarative subagent specification — name, model, permissionMode, tools, isolation, maxTurns
- Examples: `.claude/agents/architect-planner.md`, `.claude/agents/implementation-engineer.md`
- Pattern: YAML frontmatter + markdown role description + output contract
- Purpose: Node.js stdin/stdout contract with Claude Code event bus
- Examples: `.claude/hooks/validators/protect-files.js`, `.claude/hooks/workflow/session-start.js`
- Pattern: Read JSON from stdin, write JSON decision to stdout, exit 0 (pass/ask) or 2 (deny)
- Purpose: All mutable application state in one object
- Location: `freeforge/src/state.js:10`
- Pattern: Plain object exported as `S`; modules mutate properties directly

## Entry Points

## Architectural Constraints

- **No subagent spawning:** Every agent definition has `disallowedTools: [Agent]`. Only the main session may call `Agent`.
- **Worktree isolation:** Writer agents use `isolation: worktree` to prevent parallel edit collisions.
- **No build step (FreeForge):** ES modules loaded natively; no bundler, no transpiler.
- **Global state (FreeForge):** `S` in `state.js` is a module-level singleton. All mutations are synchronous except during streaming.
- **Control-plane protection:** Two independent layers (hook + settings.json) both require human approval for writes to `.claude/**`, `CLAUDE.md`, `.mcp.json`, `managed-settings.json`.

## Anti-Patterns

### Subagent spawning from a subagent

### Writing control-plane files without approval

## Error Handling

- Hook scripts catch JSON parse errors and write to stderr; non-zero exit triggers Claude Code error handling
- Handoff state validates JSON on read; invalid JSON surfaces a warning instead of crashing
- `api.js` maps HTTP status codes to user-facing error strings; 401 triggers the invalid-API-key banner
- `AbortError` (user cancelled stream) is silently swallowed via `onDone('')`
- `onError` in `chat.js` removes the in-flight assistant message and shows a toast

## Cross-Cutting Concerns

<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->

## Project Skills

| Skill | Description | Path |
|-------|-------------|------|
| orchestrating-swarm | Coordinates multi-agent coding work using map-reduce delegation, bounded writer agents, read-only reviewers, and final quality gates. Trigger for complex multi-file objectives. | `.claude/skills/orchestrating-swarm/SKILL.md` |
| running-quality-gate | Runs final validation after code changes: lint, typecheck, tests, security review, dependency review, performance review, and release decision. | `.claude/skills/running-quality-gate/SKILL.md` |
| preparing-pr | Generates a PR description from local diffs, tests, security review, and quality gate evidence. | `.claude/skills/preparing-pr/SKILL.md` |
| healing-test-failures | Diagnoses failing tests, maps failure causes, applies minimal fixes, and reruns targeted verification. | `.claude/skills/healing-test-failures/SKILL.md` |
| threat-modeling-change | Builds a pre-implementation threat model for auth, API, database, file upload, dependency, and infrastructure changes. | `.claude/skills/threat-modeling-change/SKILL.md` |
| auditing-control-plane | Runs structural verification for Claude control-plane changes by parsing settings plus optional .mcp.json and managed-settings.json, checking referenced files, and syntax-checking hook or workflow scripts. | `.claude/skills/auditing-control-plane/SKILL.md` |
| recording-handoff-state | Captures structured task state in .claude/handoff/current-task.json so another Claude session or subagent can resume multi-step work quickly. | `.claude/skills/recording-handoff-state/SKILL.md` |
| resuming-handoff-state | Reads .claude/handoff/current-task.json and converts saved state into the next concrete work cycle for Claude Code. | `.claude/skills/resuming-handoff-state/SKILL.md` |
| smoke-testing-runtime | Runs the final real-Claude smoke-test checklist for hooks, approval prompts, handoff resume, and MCP fallback after static validation passes. | `.claude/skills/smoke-testing-runtime/SKILL.md` |
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->

## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:

- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->

## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
