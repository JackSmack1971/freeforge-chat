---
name: feature-implementation
description: Implement a specified feature as the smallest verified vertical change in an existing codebase. Use when a user asks to build, add, or implement product behavior from requirements or an issue.
compatibility: Requires a readable repository and its available local toolchain.
---

# Feature Implementation

Ship the smallest complete behavior that satisfies the specification, using
existing repository conventions and dependencies.

## Workflow

1. Read the specification and acceptance criteria; list missing decisions.
2. Inspect the relevant architecture, callers, data flow, and existing tests.
3. Choose one end-to-end slice and identify the fewest files it needs.
4. Implement behavior with input validation, error handling, and accessibility
   or security requirements required by the contract.
5. Add or update the smallest meaningful verification, then run focused tests,
   lint/type checks, and the relevant broader check if available.
6. Report changed files, verification results, and any deferred work.

## Boundary

Do not invent product scope, broad refactors, abstractions for one use, or new
dependencies without need. Stop and ask when requirements conflict or a safe
data migration is required but not specified.
