# Roadmap: FreeForge

## Overview

Refine the current browser chat app so the key-management path is easier to use with the keyboard and assistive tech, then add a local conversation history drawer that preserves prior chats without changing the browser-only storage model.

## Phases

- [x] **Phase 1: Accessible Settings Key Management** - Make the existing Settings modal task-focused, accessible, and recoverable. (completed 2026-07-05)
- [x] **Phase 2: Conversation History Drawer** - Add a browser-local archive and slide-over drawer for browsing and restoring prior conversations. (planned 2026-07-05) (completed 2026-07-05)

## Phase Details

### Phase 1: Accessible Settings Key Management

**Goal**: Refine the existing Settings modal so it opens on the key-management task, announces validation and clear-state changes clearly, and returns focus to the caller after close or success.
**Depends on**: Nothing
**Requirements**: [REQ-01, REQ-02, REQ-03]
**Success Criteria** (what must be TRUE):

  1. Keyboard users land on the key input when Settings opens.
  2. Validation, loading, clear confirmation, and success are announced accessibly.
  3. Closing the modal returns focus to the opener and storage behavior stays unchanged.

**Plans**: 1/1 plans complete

Plans:

- [x] 01-01-PLAN.md
- [x] 01-01: Accessible settings key management

### Phase 2: Conversation History Drawer

**Goal**: Capture recent local conversations before starting a new chat, show them in a slide-over history drawer, and restore one archived thread into the main chat shell.
**Depends on**: Phase 1
**Requirements**:

  1. Keep conversation history browser-local and do not send message content to analytics.
  2. Cap retained snapshots so the drawer does not grow without bound.
  3. Preserve the current chat until the user explicitly confirms a restore that would replace unsent text.
  4. Keep restore behavior compatible with the active model and agent context.

**Success Criteria** (what must be TRUE):

  1. The drawer shows the most recent archive first, exposes a clear way to restore it, and places focus inside the drawer.
  2. Restoring an archived conversation swaps the current shell to the archived messages and closes the drawer after restoring focus.
  3. The drawer shows an empty state when no history exists and never exposes the current draft unless the user confirms replacement.

**Plans**: 0/1 plans complete

Plans:

- [x] 02-01-PLAN.md
- [ ] 02-01: Conversation history drawer

## Progress

**Execution Order:**
Phases execute in numeric order: 1, 2

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Accessible Settings Key Management | 1/1 | Complete   | 2026-07-05 |
| 2. Conversation History Drawer | 1/1 | Complete    | 2026-07-05 |
