# Phase 1: Accessible Settings Key Management - Context

**Gathered:** 2026-07-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Refine the existing Settings modal so API key management is easier to use with the keyboard and assistive tech, without changing storage semantics or adding a new preferences layer.

</domain>

<decisions>
## Implementation Decisions

### Initial focus and close behavior
- **D-01:** Settings opens with focus on `#settings-new-key`, not the close button.
- **D-02:** Closing Settings returns focus to the opener when that element is still valid.
- **D-03:** If the opener is no longer valid, closing Settings falls back to a deterministic focus target instead of leaving focus unset.

### Validation and saving feedback
- **D-04:** Validation and saving states are shown inline on the key field and are also announced accessibly.
- **D-05:** Field errors stay attached to the API key input and explain how to recover.
- **D-06:** Successful saving is both visibly confirmed and announced before the modal closes.

### Clear-key flow
- **D-07:** The first Clear activation only arms confirmation and announces the consequence.
- **D-08:** The second Clear activation removes the key.
- **D-09:** After removal, the modal stays open so the user can verify the cleared state or enter a replacement key.
- **D-10:** Closing after either saving or clearing uses the same focus-return behavior.

</decisions>

<specifics>
## Specific Ideas

- The flow should feel recoverable: the user can validate, save, clear, and verify without losing orientation.
- Status updates must never expose the raw API key.
- The modal should support a keyboard-first path from open to close.

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope and task breakdown
- `.planning/ROADMAP.md` - Phase goal, success criteria, and scope boundary for Accessible Settings Key Management.
- `.planning/phases/01-accessible-settings-key-management/01-01-PLAN.md` - Task breakdown, acceptance criteria, and files already targeted for this phase.

### Existing implementation context
- `CLAUDE.md` - Repository-level engineering standards, storage constraints, and code style.
- `README.md` - Product behavior summary and current app workflow.
- `freeforge/index.html` - Current Settings modal markup and live-region structure.
- `freeforge/src/features/settings.js` - Existing Settings modal behavior, validation, save, and clear flow.
- `freeforge/src/ui/focus-trap.js` - Shared modal focus-trap behavior used by Settings.
- `freeforge/src/ui/screen.js` - Screen switching and invalid-key banner behavior.
- `freeforge/src/ui/toast.js` - Current toast pattern for visible confirmation and announcements.
- `freeforge/src/state.js` - Shared storage helpers, API key masking, and global state shape.
- `freeforge/src/features/onboarding.js` - Parallel key-validation flow to keep messaging consistent.
- `tests/security/runtime-ui-features.test.mjs` - Existing browser-style coverage for Settings focus and key-management behavior.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `createFocusTrap()` in `freeforge/src/ui/focus-trap.js` already captures previous focus and restores it on close.
- `maskKey()`, `setStoredKey()`, and `clearStoredKey()` in `freeforge/src/state.js` preserve the current key-storage semantics.
- `clearPersistent()` and `toast()` in `freeforge/src/ui/toast.js` already support visible feedback without extra infrastructure.

### Established Patterns
- `settings.js` already keeps key validation inline with `#settings-key-error`.
- The onboarding flow in `freeforge/src/features/onboarding.js` already shows the app's preferred pattern for validation and loading states.
- Modal focus management already exists in the app, so this phase should extend the shared trap rather than invent a new one.

### Integration Points
- `freeforge/index.html` is where modal markup, helper text, and live-region hooks will need to line up with the behavior changes.
- `freeforge/src/features/settings.js` is the central behavior module for open, close, update, and clear.
- `tests/security/runtime-ui-features.test.mjs` is the right place to pin the keyboard and focus behavior.

</code_context>

<deferred>
## Deferred Ideas

None - discussion stayed within the Settings key-management phase.

</deferred>

---

*Phase: 01-accessible-settings-key-management*
*Context gathered: 2026-07-05*
