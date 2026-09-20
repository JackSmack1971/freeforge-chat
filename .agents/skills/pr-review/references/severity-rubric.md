# PR Review Severity Rubric

Use the highest severity justified by demonstrated merge risk. Do not inflate severity for general code smell.

## Critical
Blocks merge. A concrete exploit, data loss, privilege escalation, production outage, irreversible migration failure, or severe financial/domain correctness defect is likely if merged.

Required response: `REQUEST_CHANGES`. Include exact evidence, smallest safe fix, and verification. Recommend immediate maintainer attention.

## High
Blocks merge. The PR introduces a plausible severe defect in security, correctness, data integrity, reliability, or compatibility, but impact is bounded or requires specific conditions.

Required response: `REQUEST_CHANGES`. Include a concrete fix path and regression test requirement.

## Medium
Usually blocks merge when the affected behavior is user-facing, persistent, security-adjacent, or difficult to roll back. The defect is real but limited in blast radius.

Required response: `REQUEST_CHANGES` when the risk affects changed behavior; otherwise `COMMENT` if safe follow-up is acceptable.

## Low
Does not block merge. Minor maintainability, readability, non-critical test gap, documentation mismatch, or local inconsistency that does not threaten correctness or operations.

Required response: `COMMENT` or include as non-blocking note under an otherwise approving review.

## Nit
Never blocks merge. Formatting, naming, or style preference that is not tied to an enforced project rule or defect.

Required response: avoid unless the repository explicitly expects nit comments. Prefer omission.

## Confidence
- High confidence: directly supported by diff and adjacent code.
- Medium confidence: supported by diff plus likely call path, but runtime path not fully proven.
- Low confidence: possible issue requiring maintainer confirmation. Do not block merge solely on low confidence.

## Blocking rule
A blocking finding must satisfy all five conditions:
1. Within PR scope.
2. Supported by cited evidence.
3. Has a concrete failure mode.
4. Has a minimal remediation path.
5. Has a verification step a PR agent can run or implement.
