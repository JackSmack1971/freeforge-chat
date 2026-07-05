# FreeForge

## What This Is

FreeForge is a zero-build browser chat app that connects directly to OpenRouter free models. It runs entirely in the browser, stores the API key only in the current tab, and keeps chat history local.

## Core Value

Open a single HTML file, connect a key, and chat without installing a stack or exposing secrets outside the browser session.

## Requirements

### Active

- [ ] Conversation history stays browser-local, capped, and safe to restore.
- [ ] The history drawer remains keyboard accessible and requires explicit confirmation before replacing unsent text.
- [ ] Starting a new chat preserves a restorable snapshot of the current thread.

### Out of Scope

- Cloud sync or cross-device history.
- Search, tagging, pinning, or bulk deletion of archived chats.
- Server-side history or analytics capture.

## Context

- The app is shipped as static files under `freeforge/`.
- Chat history already stays local to the browser.
- The history drawer should reuse the existing dialog and focus patterns.
- The settings modal baseline is already complete and stable.

## Constraints

- **Security**: Never expose raw conversation content in logs, toasts, analytics, or stored content.
- **Platform**: Keep the app buildless and browser-native.
- **Storage**: Preserve the current session-scoped key and local message storage behavior while adding a capped local archive.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Keep history browser-local and capped | Minimizes risk and avoids a backend history system | Pending |

---
*Last updated: 2026-07-05 after import bootstrap*
