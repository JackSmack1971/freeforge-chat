# Requirements: Inline Message Editing

**Defined:** 2026-06-28
**Core Value:** A single HTML file you can open, share, or deploy anywhere - beautiful enough to show in a portfolio, tight enough to show in the code.

## v1 Requirements

### Inline Edit Entry

- [ ] **EDIT-01**: User can click their own sent message to open inline edit mode with the original text prefilled
- [ ] **EDIT-02**: Confirming an edit truncates later messages and resends from the edited turn through the existing chat flow

### Undo and Safety

- [ ] **EDIT-03**: User can undo one edit in the same session before the truncated slice is persisted

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
*Requirements defined: 2026-06-28*
*Last updated: 2026-06-28 after inline-message-editing milestone initialization*
