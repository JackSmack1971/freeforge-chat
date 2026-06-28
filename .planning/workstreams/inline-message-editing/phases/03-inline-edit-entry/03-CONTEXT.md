# Phase 3: Inline Edit Entry - Context

**Gathered:** 2026-06-27
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase delivers inline edit entry for user-authored messages. A click on a user bubble swaps that bubble for a transient in-place editor, and the confirmed edit continues through the existing resend flow without introducing a new history model.

</domain>

<decisions>
## Implementation Decisions

### Inline edit activation and dismissal
- **D-01:** Open inline edit on mouse click only. Keyboard activation is intentionally out of scope for this phase.
- **D-02:** Close the inline editor through the explicit cancel control only. Escape-to-dismiss and outside-click dismissal are intentionally out of scope for this phase.

### Confirmed resend semantics
- **D-03:** Confirmation should follow the existing `regenerate()` behavior as the reference for conversation truncation, then reuse the current `sendMessage()` path to resend the edited text. That keeps one resend pipeline and one cut rule.

### the agent's Discretion
- Use regenerate-parity truncation rules for the confirm path, including removing any later messages exactly as the shared helper dictates.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope and acceptance
- `.planning/workstreams/inline-message-editing/ROADMAP.md` — phase boundary, goals, and task split for Phase 3
- `.planning/workstreams/inline-message-editing/REQUIREMENTS.md` — EDIT-01 and EDIT-02 requirements plus out-of-scope items

### Phase plan artifacts
- `.planning/workstreams/inline-message-editing/phases/03-inline-edit-entry/03-01-PLAN.md` — edit entry render and delegated open/cancel handling
- `.planning/workstreams/inline-message-editing/phases/03-inline-edit-entry/03-02-PLAN.md` — truncation and resend wiring

### Codebase touchpoints
- `freeforge/src/ui/messages.js` — current user-bubble rendering and message list rebuild flow
- `freeforge/src/features/chat.js` — existing `sendMessage()` and `regenerate()` resend path
- `freeforge/src/app.js` — delegated interaction wiring for suggestions and regenerate
- `freeforge/styles/app.css` — existing message bubble styling and motion tokens

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `document.addEventListener('click', ...)` handlers in `freeforge/src/app.js` already route delegated interactions for suggestions and regenerate.
- `buildMsgEl()` in `freeforge/src/ui/messages.js` already owns the user-bubble DOM branch and can swap that branch for an editor in one place.
- `sendMessage()` and `regenerate()` in `freeforge/src/features/chat.js` already define the conversation cut and resend lifecycle.
- `.msg-user-surface` in `freeforge/styles/app.css` already provides the visual anchor for user-message styling.

### Established Patterns
- UI state is rendered from `S.messages` and rebuilt through `renderAllMessages()`, so the edit surface should stay transient and derived from state.
- `S.streaming` is the existing gate for chat interactions, so inline edit entry should follow the same guard.
- The codebase favors small helper functions that return DOM nodes and then attach behavior after render.

### Integration Points
- `freeforge/src/app.js` needs delegated handling for edit entry and cancel.
- `freeforge/src/ui/messages.js` is the rendering point for the bubble/editor swap.
- `freeforge/src/features/chat.js` is the place to share truncation and resend semantics.
- `freeforge/styles/app.css` is where minimal inline-editor styling belongs.

</code_context>

<specifics>
## Specific Ideas

- Keep the editor in the same bubble slot rather than opening a modal.
- Match the existing regenerate flow for the confirm path so the edit behavior stays consistent with the current conversation lifecycle.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 3-Inline Edit Entry*
*Context gathered: 2026-06-27*