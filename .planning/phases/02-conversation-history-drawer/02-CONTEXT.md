# Phase 2: Conversation History Drawer - Context

**Gathered:** 2026-07-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Add a browser-local conversation history drawer that captures the current thread when the user starts a new chat, lets the user browse archived chats, and restores one archived thread into the active chat shell with confirmation only when unsent composer text would be replaced.

</domain>

<decisions>
## Implementation Decisions

### Snapshot timing
- **D-01:** Capture a snapshot only when the user starts a new chat.
- **D-02:** The snapshot source is the current thread at the moment `newChat()` runs, before the active chat shell is cleared.

### Restore policy
- **D-03:** Restore immediately when the composer is empty.
- **D-04:** If the composer has unsent text, require an explicit replace confirmation before restoring the archived thread.

### Drawer presentation
- **D-05:** Keep each drawer row minimal: title, timestamp, first-prompt preview, and a Restore button.
- **D-06:** Do not add extra per-item metadata in the MVP unless it is needed for identification.

### the agent's Discretion
None — the user selected concrete options for each gray area.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project and roadmap
- `.planning/PROJECT.md` — current project constraints, storage rules, and the top-level browser-local history direction.
- `.planning/ROADMAP.md` — Phase 2 goal, requirements, and success criteria for the conversation history drawer.
- `.planning/STATE.md` — current planning state and phase progression.

### Existing app architecture
- `CLAUDE.md` — repository engineering standards, code style, and storage constraints.
- `README.md` — product behavior, local-history notes, and current workflow summary.
- `freeforge/index.html` — existing modal surfaces, navigation, empty state, and live-region structure.
- `freeforge/src/app.js` — event wiring patterns for navigation, modal open/close, and delegated actions.
- `freeforge/src/features/chat.js` — `newChat()`, streaming lifecycle, and current message-storage behavior.
- `freeforge/src/features/settings.js` — shared modal/focus behavior and accessible status messaging.
- `freeforge/src/ui/focus-trap.js` — reusable focus-trap implementation for modal surfaces.
- `freeforge/src/state.js` — shared state singleton and local/session storage helpers.

### Tests and verification
- `tests/security/runtime-ui-features.test.mjs` — browser-style regression coverage for modal, focus, and chat behaviors.
- `tests/security/runtime-app.test.mjs` — app-wiring coverage for startup and shell interactions.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `newChat()` in `freeforge/src/features/chat.js`: already owns the clearing point where the prior thread can be archived before reset.
- `LS` and `S` in `freeforge/src/state.js`: enough for a browser-local capped archive without introducing new storage plumbing.
- `createFocusTrap()` in `freeforge/src/ui/focus-trap.js`: existing modal focus behavior can be reused for the drawer.
- `showScreen()`, `toast()`, and the live-region nodes in `freeforge/index.html`: provide the existing accessibility and feedback patterns to mirror.

### Established Patterns
- The app already uses modal-style surfaces with explicit open/close wiring in `freeforge/src/app.js`.
- `settings.js` shows the preferred pattern for accessible announcements, inline errors, and focus restoration after close.
- `chat.js` already treats storage quota failures as recoverable warnings rather than hard failures.

### Integration Points
- `freeforge/src/features/chat.js` is the archive-capture and restore application point.
- `freeforge/src/app.js` is the navigation and drawer trigger wiring point.
- `freeforge/index.html` is where the drawer markup and empty state will be added.
- `tests/security/runtime-ui-features.test.mjs` is the right place for the open/restore/focus regression checks.

</code_context>

<specifics>
## Specific Ideas

- Keep the archive local to the browser and bounded.
- Use the first user prompt as the visible label in the drawer.
- Present the drawer as a lightweight browsing surface, not as a management tool.
- Preserve the current composer unless the user explicitly confirms replacement.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 02-conversation-history-drawer*
*Context gathered: 2026-07-05*
