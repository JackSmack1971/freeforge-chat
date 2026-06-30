# FreeForge — Portfolio Quality Pass

## What This Is

FreeForge is a self-contained, zero-dependency browser chat UI that talks directly to the OpenRouter API using only free models. No server, no build step, no tracking — just open the HTML file and chat.

The v1 implementation shipped as a quality pass: onboarding with key validation, streaming chat, model selector, hardened markdown rendering, copy/regenerate buttons, session-scoped key persistence, settings modal, error handling, and responsive dark UI. This project is the **quality pass** that took it from "it works" to "impressive portfolio piece" — tight code, accessible markup, polished UX, and clean architecture.

## Core Value

A single HTML file you can open, share, or deploy anywhere — beautiful enough to show in a portfolio, tight enough to show in the code.

## Current Milestone: v1.1 Inline Message Editing

**Goal:** Let users edit a sent user message in place, then resend the conversation from that point through the existing `regenerate()` / `sendMessage()` path.

**Target features:**
- Click a user message bubble to open inline edit mode
- Confirming an edit truncates later messages and resends the edited prompt
- A single-slot, session-only undo toast restores truncated messages before persistence

## Context

- **Type:** Brownfield — code is already written and functional
- **Stack:** Vanilla ES modules, Tailwind CDN, marked.js CDN (DOMPurify in freeforge/index.html), no build step
- **Entry point:** `freeforge/index.html` (canonical)
- **Owner:** Solo project / portfolio
- **Target:** Public GitHub repo + portfolio showcase
- **Current focus:** Inline message editing built on the existing chat lifecycle, with no new message history model

## Who It's For

Developers who want free AI chat without an account wall, and anyone reviewing the codebase as a portfolio artifact.

## Requirements

### Validated

- ✓ Onboarding card with key input, show/hide toggle, validation via `/models` endpoint, inline error messages — existing
- ✓ Save key to session-scoped storage; skip onboarding if key present on reload — existing
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

- [ ] **EDIT-01**: User can click their own sent message to open inline edit mode with the original text prefilled
- [ ] **EDIT-02**: Confirming an edit truncates later messages and resends from the edited turn through the existing chat flow
- [ ] **EDIT-03**: User can undo one edit in the same session before the truncated slice is persisted

### Out of Scope

- Backend / server component — this is a client-only app by design
- Authentication beyond API key storage — unnecessary for personal/portfolio use
- Multi-conversation history / sidebar — adds complexity without portfolio value
- Custom model fine-tuning or system prompt UI — out of v1 scope
- PWA / service worker — nice-to-have but not the focus
- New conversation model — the edit milestone must reuse the current send/regenerate flow
- Persistent edit history — undo only needs to cover the current session

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| No build step | Zero-friction open-and-use; portfolio viewers can read the source directly | Preserved — ES modules + CDN only |
| Vanilla JS over React/Vue | Demonstrates fundamentals; no framework overhead for a small app | Preserved |
| client-side only storage | Privacy-first; no server to maintain | Preserved |
| marked.js via CDN | Full Markdown spec; lightweight enough for CDN delivery | Keep; DOMPurify is paired with it in the canonical entry point |
| Two HTML entry points | `freeforge.html` (root) vs `freeforge/index.html` — root file lacked DOMPurify | Resolved — root file removed, canonical entry is `freeforge/index.html` |
| Inline edit flow reuses resend path | Editing should truncate history once and call the existing send flow instead of introducing a second message pipeline | Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition:**
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone:**
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-06-28 after v1.1 milestone initialization*
