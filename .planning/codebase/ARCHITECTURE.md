# Architecture

## Summary

FreeForge is a single-page browser application with a small module graph.
The entrypoint wires DOM events, feature modules own user flows, UI helpers render, and `state.js` holds shared runtime state.

## High-Level Shape

- `freeforge/index.html` loads the UI shell and module entrypoint
- `freeforge/src/app.js` wires events and initializes the app
- `freeforge/src/state.js` stores shared state in one object
- `freeforge/src/features/` contains flow controllers
- `freeforge/src/ui/` contains render and display helpers
- `freeforge/src/api.js` isolates network I/O
- `freeforge/src/markdown.js` isolates markdown rendering and sanitization

## Data Flow

1. User interacts with the onboarding screen or chat shell.
2. `freeforge/src/app.js` forwards DOM events to feature modules.
3. Feature modules update `S` from `freeforge/src/state.js`.
4. `freeforge/src/api.js` calls OpenRouter and streams tokens back.
5. `freeforge/src/ui/messages.js`, `screen.js`, `toast.js`, and `ctx-pill.js` repaint the UI.
6. `freeforge/src/markdown.js` sanitizes assistant content before it reaches the DOM.

## Runtime State

- `S` is the singleton runtime store
- `LS` wraps safe JSON storage access
- `getStoredKey()`, `setStoredKey()`, and `clearStoredKey()` manage the API key
- `S.messages` is the conversation source of truth
- `S.models` and `S.selectedModel` control the model picker

## Flow Boundaries

- Onboarding: validate key, fetch free models, switch to chat
- Chat: append message, stream assistant output, persist transcript
- Settings: update or clear the stored key
- Palette: dispatch shortcut actions and model switching
- Export: generate markdown from the current transcript

## Rendering Model

- Message rows are built from DOM nodes in `freeforge/src/ui/messages.js`
- User and notice content uses `textContent`
- Assistant content goes through `renderMd()` before insertion
- Streamed assistant text is kept as plain text until final render

## Architectural Constraints

- No framework, no router, no component system
- No build-time transform in the shipped app
- No global state manager beyond `S`
- No direct DOM abstraction layer
- No server-side rendering

## Safety Boundaries

- Markdown output is sanitized with DOMPurify
- Inline style sinks are avoided in tracked UI files
- The API key is kept out of persistent storage
- Error handling surfaces user-facing toasts instead of silent failure

## Entry Points

- `freeforge/index.html`
- `freeforge/src/app.js`
- `freeforge/src/features/chat.js`
- `freeforge/src/features/onboarding.js`
- `freeforge/src/features/settings.js`

## Key Paths

- `freeforge/src/state.js`
- `freeforge/src/api.js`
- `freeforge/src/markdown.js`
- `freeforge/src/ui/messages.js`
- `freeforge/src/ui/screen.js`
- `freeforge/src/ui/toast.js`
- `freeforge/src/features/palette.js`

