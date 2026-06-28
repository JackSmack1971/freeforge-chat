---
status: testing
phase: 03-accessibility
source: [03-VERIFICATION.md]
started: 2026-06-28T00:28:17.6256852Z
updated: 2026-06-28T00:28:17.6256852Z
---

## Current Test

number: 1
name: Settings modal focus trap
expected: |
  Focus wraps only across visible controls and never escapes the modal.
awaiting: user response

## Tests

### 1. Settings modal focus trap
expected: Focus wraps only across visible controls and never escapes the modal.
result: [pending]

### 2. Settings close restore-focus
expected: Focus returns to the opener if it is still in the document.
result: [pending]

### 3. Onboarding password toggle state
expected: Assistive tech hears the state change and the name flips between Show API key and Hide API key.
result: [pending]

### 4. Validation sync
expected: The error text and aria-invalid state update together.
result: [pending]

### 5. Streaming live regions
expected: Status announces start/completion and the alert region receives failures.
result: [pending]

### 6. Send/stop name sync
expected: The send button label flips between Send message and Stop generating.
result: [pending]

## Summary

total: 6
passed: 0
issues: 0
pending: 6
skipped: 0
blocked: 0

## Gaps
