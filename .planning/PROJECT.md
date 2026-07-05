# FreeForge

## What This Is

FreeForge is a zero-build browser chat app that connects directly to OpenRouter free models. It runs entirely in the browser, stores the API key only in the current tab, and keeps chat history local.

## Core Value

Open a single HTML file, connect a key, and chat without installing a stack or exposing secrets outside the browser session.

## Requirements

### Active

- [ ] Settings key management stays in the existing modal and remains keyboard accessible.
- [ ] Key validation, clear confirmation, and success/error feedback stay legible without exposing the raw key.
- [ ] Existing session-scoped key storage and local chat storage behavior remain unchanged.

### Out of Scope

- New preferences system — the app only needs the current settings modal.
- Server-side key storage — the app is browser-only.
- Cross-tab sync or background settings management — not required for this workflow.

## Context

- The app is shipped as static files under `freeforge/`.
- Settings is the gatekeeper for updating or clearing the OpenRouter API key.
- The modal already has a shared focus trap and clear/update flows.

## Constraints

- **Security**: Never expose the raw API key in logs, toasts, analytics, or stored content.
- **Platform**: Keep the app buildless and browser-native.
- **Storage**: Preserve the current session-scoped key and local message storage behavior.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Keep settings as the single key-management surface | Minimizes UI surface area and preserves the current workflow | Pending |

---
*Last updated: 2026-07-05 after import bootstrap*
