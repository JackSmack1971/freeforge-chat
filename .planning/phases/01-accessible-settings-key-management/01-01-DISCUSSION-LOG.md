# Phase 1: Accessible Settings Key Management - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md - this log preserves the alternatives considered.

**Date:** 2026-07-05
**Phase:** 01-accessible-settings-key-management
**Areas discussed:** Initial focus and close behavior, Validation and saving feedback, Clear-key flow

---

## Initial focus and close behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Open on close button | Keep the current first-focus target on the close control. | |
| Open on API key field | Put keyboard users directly into the key-management task. | ✓ |
| Open on modal title | Start at the dialog heading before moving to the form. | |

**User's choice:** Open on API key field
**Notes:** The modal should return focus to the opener when valid, or to a deterministic fallback when the opener is no longer valid.

---

## Validation and saving feedback

| Option | Description | Selected |
|--------|-------------|----------|
| Inline only | Keep all feedback limited to field text. | |
| Live region only | Announce changes without visible helper text. | |
| Inline plus announcement | Show status next to the field and announce it accessibly. | ✓ |

**User's choice:** Inline plus announcement
**Notes:** Validation and saving states appear inline; errors stay attached to the field and explain recovery. Success is visibly confirmed and announced before close.

---

## Clear-key flow

| Option | Description | Selected |
|--------|-------------|----------|
| One-step clear | Clear immediately on first activation. | |
| Arm then clear | First click warns, second click removes the key. | ✓ |
| Clear and close | Remove the key and dismiss the modal right away. | |

**User's choice:** Arm then clear
**Notes:** The first activation only arms confirmation and announces the consequence. The second removes the key. The modal stays open after removal so the user can verify the state or enter a replacement key.

## the agent's Discretion

None - focus fallback, announcement mechanics, and clear-state UX were all specified.

## Deferred Ideas

None
