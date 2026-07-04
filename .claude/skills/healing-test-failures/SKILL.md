---
name: healing-test-failures
description: Diagnoses failing tests, maps failure causes, applies minimal fixes, and reruns targeted verification.
disable-model-invocation: false
user-invocable: true
allowed-tools:
  - Read
  - Write
  - Edit
  - MultiEdit
  - Grep
  - Glob
  - Bash
  - Agent
---
# Healing Test Failures

## Procedure

1. Capture the failing test command and raw failure.
2. Use `codebase-cartographer` to map implementation and test dependencies.
3. Fix root cause, not test expectations, unless the test is demonstrably stale.
4. Rerun only the failing test first.
5. Escalate per `.claude/rules/failure-escalation.md` if the same failure repeats twice after edits.
