# Phase 2: Conversation History Drawer - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md - this log preserves the alternatives considered.

**Date:** 2026-07-05
**Phase:** 02-conversation-history-drawer
**Areas discussed:** Snapshot timing, Restore policy, Drawer presentation

---

## Snapshot timing

| Option | Description | Selected |
|--------|-------------|----------|
| Capture only when the user starts a new chat, using the current thread as the snapshot. | Archive the current conversation at the reset point only. | ✓ |
| Capture when a chat turn finishes and again before New Chat clears the thread. | Archive on multiple lifecycle points. | |
| Capture only on manual restore-worthy moments you trigger later. | Defer archive timing to a later action. | |

**User's choice:** Capture only when the user starts a new chat, using the current thread as the snapshot.
**Notes:** Keeps the archive bounded to a single obvious lifecycle boundary.

---

## Restore policy

| Option | Description | Selected |
|--------|-------------|----------|
| Always restore immediately when a thread is selected. | Replace the live chat as soon as a history item is clicked. | |
| Restore immediately only if the composer is empty; otherwise require a replace confirmation. | Avoid accidental loss of unsent text. | ✓ |
| Never overwrite the live composer; restore only into a new blank chat. | Force archive restoration to happen in a fresh thread. | |

**User's choice:** Restore immediately only if the composer is empty; otherwise require a replace confirmation.
**Notes:** Keeps restore fast when safe and gated when unsent text exists.

---

## Drawer presentation

| Option | Description | Selected |
|--------|-------------|----------|
| Keep it minimal: title, timestamp, first prompt preview, and a Restore button. | Lightweight rows with only the essentials. | ✓ |
| Add model or agent metadata on each item so users can distinguish similar chats. | Include extra context chips on each row. | |
| Show metadata plus a short empty state hint and a close action, but keep item rows compact. | Slightly richer list rows. | |

**User's choice:** Keep it minimal: title, timestamp, first prompt preview, and a Restore button.
**Notes:** Prioritizes a lightweight browsing surface over extra item detail.

---

## the agent's Discretion

None.

## Deferred Ideas

None.
