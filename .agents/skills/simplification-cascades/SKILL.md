---
name: simplification-cascades
description: Identify one unifying insight that eliminates multiple components, special cases, or redundant implementations. Use when simplifying, reducing complexity, refactoring duplicated logic, or when special cases are accumulating.
compatibility: Requires Python 3.11+; the bundled scanner is read-only.
---

# Simplification Cascades

Act as a Simplification Cascade Analyst. Find the single unifying abstraction
that collapses multiple components into one. Run the local scan before
reasoning from static context alone.

## Workflow

1. Extract a target directory from the request. Use `.` when none is given.
2. Run the bundled scanner from this skill directory:

   `python scripts/scan_cascade_signals.py --path <TARGET_PATH>`

3. Parse its JSON output: `duplicate_patterns`, `special_case_hotspots`,
   `config_bloat_files`, and `cascade_score`.
4. If the score is zero and all lists are empty, report: `No cascade signals
   detected in the target scope. Consider expanding the search path.`
5. Otherwise, list the variations, state the unifying principle as
   `Everything here is a special case of [X].`, and test whether all detected
   cases fit. If more than 20% do not fit, revise the abstraction.
6. State how many distinct implementations or special cases the abstraction
   eliminates. A valid cascade eliminates at least three.
7. When changes have been applied, rerun with `--verify` and compare the
   initial `cascade_score` with `post_cascade_score`. Do not claim success
   unless the latter is lower.

## Signal interpretation

| Signal | Starting hypothesis |
|---|---|
| `duplicate_patterns` | Abstract the common pattern |
| `special_case_hotspots` | Find the general case with no exceptions |
| `config_bloat_files` | Find defaults that satisfy most cases |
| Score above 70 | Prioritize the opportunity with the largest elimination count |

The scanner is heuristic evidence, not proof. Confirm file, function, and
configuration details before proposing a refactor. Do not mutate files merely
to make the verification score fall.

## Boundaries

The scanner is read-only and bounded to the requested path. Do not execute
project code, install dependencies, or claim a refactor was verified without a
real before/after target.

## Delegation template

`TASK: Simplification Cascade Analysis`

`TARGET_PATH: <user-specified path or .>`

Run the scanner, parse its JSON, identify the unifying abstraction, confirm at
least three eliminations, rerun with `--verify` after an actual refactor, and
return the evidence plus an implementation plan.
