---
description: "Record structured task state before pausing or handing work to another agent."
argument-hint: "<objective or current task>"
allowed-tools:
  - Read
  - Write
  - Edit
  - Grep
  - Glob
---
# Handoff Capture

Task: **$ARGUMENTS**

1. Read `.claude/handoff/current-task.template.json` and any existing `.claude/handoff/current-task.json`.
2. Update `.claude/handoff/current-task.json` with the current objective, touched files, verification run, open risks, and next actions.
3. Keep entries factual and concise so another agent can resume without replaying the full session.
4. Return the updated handoff path and any critical blockers that remain open.
