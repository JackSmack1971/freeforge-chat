# Phase 3: Inline Edit Entry - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-27
**Phase:** 03-Inline Edit Entry
**Areas discussed:** Inline edit activation, Dismiss behavior, Confirm resend semantics

---

## Inline edit activation

| Option | Description | Selected |
|--------|-------------|----------|
| Click only | Simplest path; bubble stays pointer-only and edit starts by mouse click. | ✓ |
| Click + keyboard | Bubble can be entered with Enter/Space too, so it is operable without a mouse. | |
| Let you decide | I will choose the smallest implementation that matches the current UI patterns. | |

**User's choice:** Click only
**Notes:** Keep inline edit entry mouse-initiated for this phase.

---

## Dismiss behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Cancel button only | Only the explicit cancel control closes the editor. | ✓ |
| Escape + cancel | Escape closes it, but outside clicks do not. | |
| Escape + outside | Either Escape or clicking elsewhere closes the editor, like a transient overlay. | |

**User's choice:** Cancel button only
**Notes:** Do not add overlay-style dismissal in this phase.

---

## Confirm resend semantics

| Option | Description | Selected |
|--------|-------------|----------|
| Match regenerate | Truncate the same slice, remove the notice the same way, and reuse the exact resend path. | |
| User-only cut | Remove only the edited user message and later turns; keep any notice/system row unless the code already drops it. | |
| Let you decide | I will follow the smallest safe behavior that preserves the current conversation flow. | ✓ |

**User's choice:** Let you decide
**Notes:** Use regenerate parity for the confirm path so the edit flow stays on the existing resend pipeline.

---

## the agent's Discretion

- Confirm resend semantics: follow regenerate parity for truncation and resend.

## Deferred Ideas

None.