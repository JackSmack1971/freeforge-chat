# Handoff State

Use this folder for explicit inter-agent state files when a task spans multiple sessions or requires manual handoff.

Recommended flow:

1. Run `/handoff "<objective>"` to update `.claude/handoff/current-task.json` before pausing.
2. Run `/resume-handoff` or let the session-start hook surface the saved state on the next session.

```json
{
  "objective": "",
  "updated_at": "",
  "changed_files": [],
  "validation_run": [],
  "open_risks": [],
  "next_actions": []
}
```
