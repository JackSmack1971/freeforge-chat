# Phase 4: Undo and Safety - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-28
**Phase:** 04-undo and safety
**Areas discussed:** Undo timing, Undo snapshot lifecycle, Undo surface, Repeat edit behavior

---

## Undo timing

| Option | Description | Selected |
|--------|-------------|----------|
| Abort and restore | Cancel the in-flight request, restore the truncated slice immediately, and clear the undo slot. | ✓ |
| Restore only | Restore the previous slice locally, but leave the in-flight request behavior unchanged. | |
| Only after done | Undo is only valid after the request finishes, so tapping it during streaming does nothing. | |

**User's choice:** Abort and restore
**Notes:** Undo must work even if the edited response is still streaming.

---

## Undo snapshot lifecycle

| Option | Description | Selected |
|--------|-------------|----------|
| Overwrite on every confirmed edit | Replace any prior undo snapshot when a new edit is confirmed. | |
| Keep only the most recent snapshot | Retain one snapshot until it expires or is used. | ✓ |
| Clear after first token | Remove the snapshot as soon as the new response starts streaming. | |

**User's choice:** Keep only the most recent snapshot
**Notes:** The buffer is single-slot and session-only.

---

## Undo surface

| Option | Description | Selected |
|--------|-------------|----------|
| Existing toast action | Add an `Undo` button to the session-only toast. | ✓ |
| Separate inline control | Show a distinct control near the edited message instead of the toast action. | |
| Both | Toast action for undo, plus the toast also points back to the message. | |

**User's choice:** Existing toast action
**Notes:** Reuse the current toast action pattern rather than adding another control surface.

---

## Repeat edit behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Replace prior snapshot | A newer confirmed edit overwrites the older undo snapshot. | ✓ |
| Block second edit | Prevent another confirmed edit until the first undo window ends. | |
| Keep both snapshots | Allow the second edit and preserve the first undo snapshot too. | |

**User's choice:** Replace prior snapshot
**Notes:** The latest confirmed edit owns the undo slot.

---

## the agent's Discretion

None — the user chose all four undo/safety decisions explicitly.

## Deferred Ideas

None.
