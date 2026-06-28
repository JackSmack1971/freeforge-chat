# Roadmap: Inline Message Editing

## Overview

This milestone adds inline editing for user-authored messages without introducing a new conversation model. The work is split so the core edit-and-resend flow lands first, then undo/persistence safety is hardened around it.

## Phases

- [ ] **Phase 3: Inline Edit Entry** - Click any user bubble, open an in-place textarea, and route the confirmed edit through the existing resend flow
- [ ] **Phase 4: Undo and Safety** - Add the session-only undo toast and verify the edit path does not create a new persistence or history model

## Phase Details

### Phase 3: Inline Edit Entry
**Goal**: A user can click their own message, edit it in place, confirm, and see the conversation resend from that point using the current `sendMessage()` / `regenerate()` pattern.
**Mode:** mvp
**Depends on**: Phase 2: Audit Cleanup
**Requirements**: EDIT-01, EDIT-02
**Success Criteria** (what must be TRUE):
  1. Clicking a `.msg-user-surface` bubble opens an inline textarea over that message with the original text prefilled
  2. Confirming the edit removes the original message and everything after it, then calls the existing send flow with the edited text
  3. The implementation does not add a new message history shape or a second resend pipeline
**Plans:** 2 plans
Plans:
- [ ] 03-01-PLAN.md - Add delegated click handling for user bubbles and render the inline edit overlay
- [ ] 03-02-PLAN.md - Implement edit truncation and resend in `features/chat.js` by reusing the existing send path

### Phase 4: Undo and Safety
**Goal**: Edited sends can be rolled back once, within the current session, before the new message history is persisted.
**Mode:** mvp
**Depends on**: Phase 3: Inline Edit Entry
**Requirements**: EDIT-03
**Success Criteria** (what must be TRUE):
  1. Confirming an edit captures the truncated slice in a single-slot undo buffer
  2. A 6-second undo toast restores the previous slice if tapped before the new message write completes
  3. Undo is session-only and clears automatically after use or timeout
**Plans:** 2 plans
Plans:
- [ ] 04-01-PLAN.md - Add the undo toast action and restore path for the truncated slice
- [ ] 04-02-PLAN.md - Verify the persistence boundary and add a small check for the edit/undo branch

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 3. Inline Edit Entry | 0/2 | Pending | - |
| 4. Undo and Safety | 0/2 | Pending | - |

