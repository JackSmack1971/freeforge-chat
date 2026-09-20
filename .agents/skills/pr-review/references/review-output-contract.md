# PR Review Output Contract

The review draft must use this exact Markdown structure.

```markdown
# PR Review Decision

Decision: APPROVE|COMMENT|REQUEST_CHANGES
Blocking findings: 0
Non-blocking findings: 0
Confidence: high|medium|low
Review mode: draft|submitted

## Summary
One concise paragraph describing what the PR changes and the merge-risk posture.

## Merge gate
- Status: pass|fail
- Reason: one sentence explaining why this decision is correct.
- Required before merge: none|list concrete required fixes.

## Findings

### PRR-001: Short actionable title
- Severity: Critical|High|Medium|Low|Nit
- Blocking: yes|no
- Confidence: high|medium|low
- Evidence: `path/to/file.ext:line-or-hunk`
- Impact: concrete failure mode and blast radius.
- Required action: smallest safe change.
- Verification: exact test, command, assertion, or review check.

Repeat finding blocks as needed. If there are no findings, write: `No findings.`

## Review comments
Ready-to-post inline or general comments. Each comment must map to a finding ID or say `General`.

## Verification performed
- Context collected from: `codex-pr-reviews/<run-id>/context.json`
- Diff reviewed: yes|partial, with truncation note if partial
- Tests/CI reviewed: yes|no|unavailable
- Additional files inspected: list paths or `none`

## Residual risk
State what was not verified and why. If none, write `No material residual risk identified from available evidence.`
```

Rules:
- The `Decision:` line must appear exactly once.
- `Blocking findings:` must equal the count of findings with `Blocking: yes`.
- `APPROVE` requires `Blocking findings: 0`.
- `REQUEST_CHANGES` requires at least one blocking finding.
- Every finding ID must be unique and use `PRR-001`, `PRR-002`, etc.
- No placeholders, TODOs, TBDs, or invented file paths.

