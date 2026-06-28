# Phase 3 Research: Inline Edit Entry

## Scope

Phase 3 is the entry point for inline editing on user-authored messages. The goal is to let a user click one of their own bubbles, edit it in place, and resend from that point without introducing a second conversation pipeline.

## Implementation Surface

### Current send/resend flow

- `freeforge/src/features/chat.js` owns the only send path via `sendMessage(text)`.
- `sendMessage()` trims and validates the prompt, blocks while streaming, enforces the 32,000 character limit, pushes the new user message, optionally inserts the first-turn notice, and appends the assistant placeholder.
- `regenerate()` already demonstrates the intended pattern for reuse: it removes the last assistant message, removes the last user message, removes the notice if present, persists the shortened array, and calls `sendMessage(text)` again.

### Current rendering surface

- `freeforge/src/ui/messages.js` renders every message bubble.
- User messages currently render as a plain `div.msg-user-surface` with no click handling or keyboard affordance.
- The message list is re-rendered through `renderAllMessages()`, so an inline editor can be mounted by state-driven re-rendering instead of manual DOM surgery.

### Current orchestration

- `freeforge/src/app.js` already owns delegated document-level click handling for suggestions and regenerate.
- That makes `app.js` the right place for delegated inline-edit entry and confirm/cancel wiring so message rendering stays dumb and `chat.js` keeps the mutation logic.

### Reusable helpers

- `renderAllMessages()` can be reused to swap between bubble and editor states.
- `scrollBottom()` can keep the active editor visible after entry.
- `sendMessage()` should remain the only resend implementation.
- The existing `regenerate()` flow is the right reference for message truncation semantics.

## Risks / Constraints

- The editor must not introduce a second message-history shape. Keep edit state transient and derive everything from `S.messages`.
- Confirming an edit should fail fast if the target message id no longer exists.
- If the edited text is empty or over the existing limit, the current `sendMessage()` guard should remain authoritative.
- Editing should stay disabled while streaming so the conversation state cannot be mutated mid-request.

## Recommendation

Split the phase into two executable plans:

1. Build the inline edit entry surface in `ui/messages.js` plus delegated open/cancel handling in `app.js`, with minimal CSS for the editor shell.
2. Add a shared truncation/resend helper in `features/chat.js` and wire edit-confirm submission through the existing `sendMessage()` path.

## Research Complete

The current codebase already has the right resend primitive. The phase should reuse `sendMessage()` and `regenerate()` semantics, not create a separate edit send pipeline.
