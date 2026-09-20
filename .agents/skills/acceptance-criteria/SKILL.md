---
name: acceptance-criteria
description: Turn ambiguous requirements into observable pass/fail acceptance criteria for features, issues, and user journeys. Use when implementation or testing needs a precise behavioral contract.
compatibility: Requires a requirement, issue, product specification, or user journey.
---

# Acceptance Criteria

Define behavior from the user's and system's observable perspective. Prefer a
small set of complete scenarios over a long checklist of vague statements.

## Workflow

1. Identify actor, preconditions, trigger, input, and expected outcome.
2. Cover the happy path, validation failures, boundary values, empty/loading/
   error states, permissions, retries, and recovery when applicable.
3. Express each criterion as a verifiable Given/When/Then scenario or an
   equivalent precise statement.
4. Check for contradictions, missing actors, and untestable language.

## Output

Return numbered criteria grouped by journey, followed by assumptions, out of
scope behavior, and unresolved questions. Include a compact trace from each
criterion to the requirement it proves.

## Boundary

Do not prescribe implementation, test framework, or UI styling unless the
requirement explicitly demands it.
