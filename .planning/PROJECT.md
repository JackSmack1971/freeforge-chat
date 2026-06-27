# FreeForge — Portfolio Quality Pass

## What This Is

FreeForge is a self-contained, zero-dependency browser chat UI that talks directly to the OpenRouter API using only free models. No server, no build step, no tracking — just open the HTML file and chat.

The v1 implementation shipped as a quality pass: onboarding with key validation, streaming chat, model selector, hardened markdown rendering, copy/regenerate buttons, session-scoped key persistence, settings modal, error handling, and responsive dark UI. This project is the **quality pass** that took it from "it works" to "impressive portfolio piece" — tight code, accessible markup, polished UX, and clean architecture.

## Core Value

A single HTML file you can open, share, or deploy anywhere — beautiful enough to show in a portfolio, tight enough to show in the code.

## Context

- **Type:** Brownfield — code is already written and functional
- **Stack:** Vanilla ES modules, Tailwind CDN, marked.js CDN (DOMPurify in freeforge/index.html), no build step
- **Entry point:** `freeforge/index.html` (canonical)
- **Owner:** Solo project / portfolio
- **Target:** Public GitHub repo + portfolio showcase

## Who It's For

Developers who want free AI chat without an account wall, and anyone reviewing the codebase as a portfolio artifact.

## Requirements

### Validated

- ✓ Onboarding card with key input, show/hide toggle, validation via `/models` endpoint, inline error messages — existing
- ✓ Save key to localStorage; skip onboarding if key present on reload — existing
- ✓ Main chat UI: top nav (logo, model selector, settings gear, new chat) — existing
- ✓ Fetch and filter `:free` OpenRouter models for the model selector dropdown — existing
- ✓ Streaming responses via ReadableStream + SSE (`data: [DONE]` handling) — existing
- ✓ User messages right-aligned indigo, assistant messages left-aligned zinc — existing
- ✓ Animated "Thinking..." dots during streaming; blinking cursor during stream — existing
- ✓ Enter to send, Shift+Enter for newline; auto-growing textarea — existing
- ✓ Copy button on assistant messages; Regenerate button on last assistant message — existing
- ✓ Persist messages to localStorage; restore on reload — existing
- ✓ New Chat clears messages, keeps model and key — existing
- ✓ Settings modal: view masked key, update key, clear key — existing
- ✓ Invalid key banner with "Update Key" action — existing
- ✓ Toast notifications (key saved, errors, model changed) — existing
- ✓ Error handling: 401, 429, 413 (context overflow), network errors — existing
- ✓ Markdown rendering for assistant messages (marked.js) — existing
- ✓ Empty state in chat area — existing
- ✓ System notice after first message — existing
- ✓ Dark theme, indigo accents, responsive layout — existing
- ✓ Stop button during streaming to abort the active request — existing

### Active

- [ ] **QUAL-01**: Accessibility audit and remediation — proper ARIA labels, focus management, keyboard navigation, screen reader announcements for streaming content
- [ ] **QUAL-02**: Mobile UX polish — touch targets, safe-area insets, virtual keyboard behavior on iOS/Android
- [ ] **QUAL-03**: Code review and cleanup — dead code, inconsistencies between `freeforge.html` (root) and `freeforge/index.html`, consolidation decision
- [ ] **QUAL-04**: Security hardening — DOMPurify integration in both HTML files, CSP meta tag, verify no XSS vectors in markdown rendering
- [ ] **QUAL-05**: UX polish — model selector shows context length, empty state with suggestion chips, smooth transitions on screen switches, footer link
- [ ] **QUAL-06**: Error resilience — graceful handling of no-free-models response, empty stream, malformed JSON in SSE, AbortController cleanup
- [ ] **QUAL-07**: README and documentation — usage instructions, screenshot, project description suitable for GitHub portfolio
- [ ] **QUAL-08**: Performance and loading — CDN SRI hashes verified, graceful degradation if CDNs fail, lazy rendering for long conversations

### Out of Scope

- Backend / server component — this is a client-only app by design
- Authentication beyond API key storage — unnecessary for personal/portfolio use
- Multi-conversation history / sidebar — adds complexity without portfolio value
- Custom model fine-tuning or system prompt UI — out of v1 scope
- PWA / service worker — nice-to-have but not the focus

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| No build step | Zero-friction open-and-use; portfolio viewers can read the source directly | Preserved — ES modules + CDN only |
| Vanilla JS over React/Vue | Demonstrates fundamentals; no framework overhead for a small app | Preserved |
| client-side only storage | Privacy-first; no server to maintain | Preserved |
| marked.js via CDN | Full Markdown spec; lightweight enough for CDN delivery | Keep; DOMPurify is paired with it in the canonical entry point |
| Two HTML entry points | `freeforge.html` (root) vs `freeforge/index.html` — root file lacked DOMPurify | Resolved — root file removed, canonical entry is `freeforge/index.html` |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-06-27 after v1.0 milestone completion*
