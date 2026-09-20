---
name: test-driven-development
description: Use a red-green-refactor TDD cycle for a requested feature, bug fix, refactor, or test change; gate each stage on a local test result.
compatibility: Requires Python 3.11+ and the project's existing test runner.
---

# Test-Driven Development

Write one behavior test first, run it, and require a genuine failure (`FAIL_CORRECT`) before implementation. Then implement the smallest change, run the target and full suite (`ALL_PASS`), refactor only under green, and run the full suite again. A passing red test or a test-runner error stops the cycle.

Run the portable verifier from this directory:

```text
python scripts/run_tdd_cycle.py --test-path <path> --stage red|green|refactor
```

The helper detects pytest, npm test, Vitest, or Jest from the current project. It emits one JSON result and never invokes a shell command through `eval`. Do not invent a test path or claim completion without all three stage results.

