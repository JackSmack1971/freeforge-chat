# Requirements: Inline Message Editing

**Defined:** 2026-06-27
**Core Value:** A single HTML file you can open, share, or deploy anywhere - beautiful enough to show in a portfolio, tight enough to show in the code.

## v1 Requirements

### Inline Edit Entry

- [ ] **EDIT-01**: Clicking any rendered user message opens an inline editor in place of that bubble, with the message text prefilled
- [ ] **EDIT-02**: Confirming an edit truncates `S.messages` at that message and resends the edited text through the existing `sendMessage()` path, reusing the current regenerate/history pattern instead of creating a new message pipeline

### Undo and Safety

- [ ] **EDIT-03**: After an edit confirm, the UI shows a 6-second session-only undo toast that restores the truncated message slice if tapped before the resend is persisted, using a single-slot undo buffer

## v2 Requirements

### Deferred

- **EDIT-04**: Edit assistant messages
- **EDIT-05**: Persist edit history across reloads
- **EDIT-06**: Multi-step undo / redo history

## Out of Scope

| Feature | Reason |
|---------|--------|
| Modal-based editor | Inline edit is the desired interaction and keeps the diff smaller |
| Assistant-message editing | Not needed for the milestone and expands the state model |
| Persistent edit history | Undo only needs to cover the current session |
| New conversation history architecture | Existing regenerate/sendMessage flow is sufficient |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| EDIT-01 | Phase 3: Inline Edit Entry | Pending |
| EDIT-02 | Phase 3: Inline Edit Entry | Pending |
| EDIT-03 | Phase 4: Undo and Safety | Pending |

**Coverage:**
- v1 requirements: 3 total
- Mapped to phases: 3
- Unmapped: 0

---
*Requirements defined: 2026-06-27*
*Last updated: 2026-06-27 after inline-message-editing milestone start*
