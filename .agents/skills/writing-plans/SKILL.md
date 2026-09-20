---
name: writing-plans
description: Create a concrete, TDD-first implementation plan from a specification or feature request, with an explicit file map and validation.
compatibility: Requires Python 3.11+; works from Codex runners on Windows or POSIX hosts.
---

# Writing Plans

Use this skill when the user asks for a plan, task list, implementation design, or a plan before coding. Extract a short hyphenated feature name, use today's date, and default to `docs/superpowers/plans/` unless the user gives another location.

Keep the plan independently executable: state the goal, architecture, stack, exact files, test-first steps, commands, expected results, and commit boundary. Reject specs that combine unrelated subsystems instead of hiding the split in one oversized plan.

Use the portable helper from this directory:

```text
python scripts/plan_tools.py date
python scripts/plan_tools.py validate --plan-path <path>
python scripts/plan_tools.py save --path <path> --content <plan>
```

The validator reports placeholder hits and task count as JSON. Fix every placeholder hit before saving. Do not require `run_command`, shell quoting, a specific shell, a subagent product, or a Git repository; Codex can execute the commands directly and the user chooses the handoff.

