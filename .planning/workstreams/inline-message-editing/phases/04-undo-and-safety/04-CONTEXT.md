# Phase 4: Undo and Safety - Context

**Gathered:** 2026-06-28
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase adds a single-session undo path for inline message edits. An edited send can be rolled back once, within the current session, by restoring the truncated slice before the new history write is finalized.

</domain>

<decisions>
## Implementation Decisions

### Undo timing and recovery
- **D-01:** Undo is allowed while the edited response is still streaming.
- **D-02:** Tapping undo must abort the in-flight request, restore the truncated slice immediately, and clear the undo slot.

### Undo snapshot lifecycle
- **D-03:** Keep only the most recent confirmed-edit snapshot in a single-slot buffer until it is used or expires.
- **D-04:** A later confirmed edit replaces the previous undo snapshot instead of blocking or stacking it.

### Undo surface
- **D-05:** Expose undo through the existing toast action pattern.

### the agent's Discretion
None — the undo timing, buffer behavior, toast surface, and repeat-edit behavior were all explicitly chosen in discussion.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope and acceptance
- `.planning/workstreams/inline-message-editing/ROADMAP.md` — phase boundary, goal, and task split for Phase 4
- `.planning/workstreams/inline-message-editing/REQUIREMENTS.md` — EDIT-03 requirement and Phase 4 out-of-scope items
- `.planning/PROJECT.md` — milestone framing and the current inline-message-editing goal

### Prior phase decisions
- `.planning/workstreams/inline-message-editing/phases/03-inline-edit-entry/03-CONTEXT.md` — locked inline-edit behavior and regenerate-parity resend semantics

### Phase 3 implementation artifacts
- `.planning/workstreams/inline-message-editing/phases/03-inline-edit-entry/03-RESEARCH.md` — code-path analysis that identified the shared resend lifecycle
- `.planning/workstreams/inline-message-editing/phases/03-inline-edit-entry/03-01-PLAN.md` — inline edit entry rendering and delegated open/cancel handling
- `.planning/workstreams/inline-message-editing/phases/03-inline-edit-entry/03-02-PLAN.md` — shared truncation/resend helper and regenerate reuse

### Codebase touchpoints
- `freeforge/src/features/chat.js` — `resendFromUserMessage()`, `sendMessage()`, and `regenerate()` define the resend and truncation lifecycle
- `freeforge/src/state.js` — singleton state holder for transient undo data and persistence helpers
- `freeforge/src/ui/toast.js` — existing toast/action surface for the undo control
- `freeforge/src/ui/messages.js` — inline-edit rendering and message list rebuild flow
- `freeforge/src/app.js` — delegated interaction wiring for inline edit confirm/cancel and regeneration

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `toast()` in `freeforge/src/ui/toast.js` already supports an action button, so undo can ride the current notification pattern without a new control surface.
- `S` in `freeforge/src/state.js` is the existing place for short-lived UI state, so a one-slot undo buffer can live beside the current inline-edit state.
- `resendFromUserMessage()` in `freeforge/src/features/chat.js` already truncates the conversation from a chosen user turn and reuses `sendMessage()`.

### Established Patterns
- The app already uses one delegated document click handler in `freeforge/src/app.js` for related message interactions, so undo wiring should stay in that delegation model.
- `S.streaming` is the current interaction gate, and the undo path needs to work with that same stream lifecycle rather than inventing a parallel history model.
- Message rendering is still derived from `S.messages` and rebuilt through `renderAllMessages()`, so the undo restore path should mutate state first and rerender from that source of truth.

### Integration Points
- `freeforge/src/features/chat.js` should own the truncated-slice snapshot and the abort/restore logic tied to edit confirmation.
- `freeforge/src/ui/toast.js` should expose the session-only undo action with the existing toast API.
- `freeforge/src/app.js` should forward the undo action from the toast into the chat/state restore path.

</code_context>

<specifics>
## Specific Ideas

- Undo should be available for 6 seconds, matching the current phase goal, and it should restore the exact truncated slice from the confirmed edit.
- The undo path should cancel the live request if the assistant response is still streaming when the toast action is tapped.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 4-Undo and Safety*
*Context gathered: 2026-06-28*
