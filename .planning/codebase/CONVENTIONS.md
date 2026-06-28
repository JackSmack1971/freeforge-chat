# Conventions

## Summary

The codebase is intentionally small and consistent.
The dominant pattern is plain ES modules with narrow, purpose-built files.

## Language and Module Rules

- Plain JavaScript only
- ES modules everywhere in `freeforge/src/**/*.js`
- Relative imports use `.js` extensions
- Named exports are preferred
- No default exports in the app code

## Style

- 2-space indentation
- Single quotes for JS strings
- Semicolons are used
- Short guard clauses are common
- Small helper functions are preferred over large multipurpose routines

## State and Flow

- `freeforge/src/state.js` owns the shared `S` singleton
- Modules mutate `S` directly instead of using a framework store
- `LS` wraps localStorage access with JSON serialization
- `getStoredKey()` and `setStoredKey()` centralize API key persistence

## DOM Conventions

- `app.js` owns event wiring
- Feature modules own business logic
- UI modules own DOM creation and updates
- `textContent` is used for untrusted or user-authored content
- `innerHTML` is reserved for sanitized markdown or static placeholders

## Error Handling

- Fetch and JSON parsing are wrapped in `try/catch`
- User-facing failures are surfaced with `toast()`
- `AbortError` is treated as normal cancellation
- Storage failures are swallowed where persistence is non-critical

## Security Conventions

- API keys stay in `sessionStorage`
- Markdown is sanitized before DOM insertion
- Inline style sinks are avoided in the tracked UI files
- Browser clipboard, export, and network calls stay explicit and local

## UI Conventions

- Screen switching is handled by `.screen` and `.screen.active`
- Accessibility names are set explicitly for icon-only controls
- The command palette and settings modal are controlled by feature modules
- Copy and regenerate actions are attached after render

## Testing Conventions

- Node’s built-in `node:test` is used
- Tests focus on invariants instead of large UI suites
- Security checks read source text directly for dangerous patterns
- Browser behavior still relies on manual verification for some flows

## Repo Conventions

- No framework-generated boilerplate
- No build-step abstraction layer
- `freeforge/package.json` is local metadata, not a root workspace manifest
- Checked-in CSS and HTML are the shipping artifacts

## Key Paths

- `freeforge/src/state.js`
- `freeforge/src/app.js`
- `freeforge/src/features/chat.js`
- `freeforge/src/ui/messages.js`
- `tests/security/*.mjs`

