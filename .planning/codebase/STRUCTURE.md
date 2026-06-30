# Structure

## Summary

The repository is split between the shipped browser app in `freeforge/`,
repo-level docs and policy files, and a small security-focused test suite.

## Top-Level Layout

- `freeforge/` - the deployable static app
- `tests/security/` - Node-based invariants for security and rendering rules
- `netlify.toml` - deployment and response headers
- `biome.json` - linting scope and style config
- `README.md`, `CONTRIBUTING.md`, `SECURITY.md`, `CHANGELOG.md` - repo guidance

## App Directory

- `freeforge/index.html` - static shell and entrypoint
- `freeforge/package.json` - local dependency metadata and test script
- `freeforge/src/` - application logic
- `freeforge/styles/` - handwritten CSS and checked-in Tailwind output

## Source Substructure

- `freeforge/src/app.js` - bootstraps the UI and binds events
- `freeforge/src/state.js` - shared state and storage helpers
- `freeforge/src/api.js` - OpenRouter request code
- `freeforge/src/markdown.js` - markdown rendering and sanitization
- `freeforge/src/features/` - behavior controllers
- `freeforge/src/ui/` - DOM rendering helpers

## Feature Modules

- `freeforge/src/features/chat.js`
- `freeforge/src/features/models.js`
- `freeforge/src/features/onboarding.js`
- `freeforge/src/features/settings.js`
- `freeforge/src/features/palette.js`
- `freeforge/src/features/export.js`

## UI Modules

- `freeforge/src/ui/messages.js`
- `freeforge/src/ui/screen.js`
- `freeforge/src/ui/toast.js`
- `freeforge/src/ui/ctx-pill.js`

## Naming Conventions

- Lowercase, descriptive file names
- Feature files grouped by behavior, not by view framework
- `ui/` for DOM rendering
- `features/` for stateful user flows
- `state.js` for shared mutable runtime data

## Test Structure

- `tests/security/style-csp.test.mjs`
- `tests/security/state-utils.test.mjs`
- `tests/security/state-storage.test.mjs`
- `tests/security/markdown-pipeline.test.mjs`
- `tests/security/innerhtml-audit.test.mjs`

## Notable File Placement Choices

- The app is self-contained under `freeforge/`
- Security checks live outside the app tree
- Generated docs are expected under `.planning/codebase/`

## Key Paths

- `freeforge/index.html`
- `freeforge/src/app.js`
- `freeforge/src/features/chat.js`
- `freeforge/src/ui/messages.js`
- `tests/security/*.mjs`

