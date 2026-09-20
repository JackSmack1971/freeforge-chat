# Repository Hygiene Audit

Generated: `2026-08-09T22:14:13+00:00`  
Repository: `C:/workspaces/DEPLOYED/NETLIFY/freeforge-chat`  
HEAD: `17910d54e38a14bf3195b6d3d2de97cccb73bb84`

## Executive summary

- Tracked files: **132**
- Findings: **6** (6 actionable)
- Severity: critical 0, high 0, medium 4, low 2, info 0

## Detected stack

- **github-actions** (high): `.github/workflows/`
- **javascript-typescript** (high): `freeforge/package.json`

## Coverage

- **complete** — `github-remote`: Read GitHub metadata for JackSmack1971/freeforge-chat.
- **complete** — `workflow-yaml-parse`: Parsed workflows with PyYAML.
- **degraded** — `docs:.claude/agents/aris-thorne.md`: Document exceeded scan limit or was unreadable.
- **degraded** — `docs:.claude/agents/elara-voss.md`: Document exceeded scan limit or was unreadable.
- **degraded** — `docs:.claude/agents/jax-holden.md`: Document exceeded scan limit or was unreadable.
- **degraded** — `docs:.claude/agents/kaelen-vance.md`: Document exceeded scan limit or was unreadable.
- **degraded** — `docs:.claude/agents/lead-engineer.md`: Document exceeded scan limit or was unreadable.
- **degraded** — `docs:.claude/agents/silas-mercer.md`: Document exceeded scan limit or was unreadable.
- **degraded** — `docs:.claude/audit-runs/repo-audit-25da978e9d2d/contracts/index.md`: Document exceeded scan limit or was unreadable.
- **degraded** — `docs:.claude/commands/control-plane-check.md`: Document exceeded scan limit or was unreadable.
- **degraded** — `docs:.claude/commands/gsd-profile-user.md`: Document exceeded scan limit or was unreadable.
- **degraded** — `docs:.claude/commands/handoff.md`: Document exceeded scan limit or was unreadable.
- **degraded** — `docs:.claude/commands/resume-handoff.md`: Document exceeded scan limit or was unreadable.
- **degraded** — `docs:.claude/handoff/README.md`: Document exceeded scan limit or was unreadable.
- **degraded** — `docs:.claude/output-styles/default.md`: Document exceeded scan limit or was unreadable.
- **degraded** — `docs:.claude/rules/control-plane.md`: Document exceeded scan limit or was unreadable.
- **degraded** — `docs:.claude/rules/failure-escalation.md`: Document exceeded scan limit or was unreadable.
- **degraded** — `docs:.claude/skills/healing-test-failures/SKILL.md`: Document exceeded scan limit or was unreadable.
- **degraded** — `docs:.codex/rules/control-plane.md`: Document exceeded scan limit or was unreadable.
- **degraded** — `docs:.planning/PROJECT.md`: Document exceeded scan limit or was unreadable.
- **degraded** — `docs:.planning/ROADMAP.md`: Document exceeded scan limit or was unreadable.
- **degraded** — `docs:.planning/STATE.md`: Document exceeded scan limit or was unreadable.
- **degraded** — `docs:.planning/phases/01-accessible-settings-key-management/01-01-CONTEXT.md`: Document exceeded scan limit or was unreadable.
- **degraded** — `docs:.planning/phases/01-accessible-settings-key-management/01-01-DISCUSSION-LOG.md`: Document exceeded scan limit or was unreadable.
- **degraded** — `docs:.planning/phases/01-accessible-settings-key-management/01-01-PLAN.md`: Document exceeded scan limit or was unreadable.
- **degraded** — `docs:.planning/phases/01-accessible-settings-key-management/01-01-SUMMARY.md`: Document exceeded scan limit or was unreadable.
- **degraded** — `docs:.planning/phases/02-conversation-history-drawer/02-01-PLAN.md`: Document exceeded scan limit or was unreadable.
- **degraded** — `docs:.planning/phases/02-conversation-history-drawer/02-01-SUMMARY.md`: Document exceeded scan limit or was unreadable.
- **degraded** — `docs:.planning/phases/02-conversation-history-drawer/02-CONTEXT.md`: Document exceeded scan limit or was unreadable.
- **degraded** — `docs:.planning/phases/02-conversation-history-drawer/02-DISCUSSION-LOG.md`: Document exceeded scan limit or was unreadable.
- **degraded** — `docs:.planning/phases/02-conversation-history-drawer/02-PATTERNS.md`: Document exceeded scan limit or was unreadable.
- **degraded** — `docs:.planning/phases/02-conversation-history-drawer/02-RESEARCH.md`: Document exceeded scan limit or was unreadable.
- **degraded** — `docs:.planning/phases/02-conversation-history-drawer/02-VERIFICATION.md`: Document exceeded scan limit or was unreadable.
- **degraded** — `docs:CLAUDE.md`: Document exceeded scan limit or was unreadable.
- **complete** — `documentation-local-links`: Scanned 45 tracked Markdown documents for local references.
- **skipped** — `documentation-external-links`: External URL checking is disabled by default to preserve deterministic offline operation.
- **complete** — `github-rulesets`: Repository rulesets read successfully.
- **complete** — `github-branch-protection`: Default-branch protection endpoint read successfully.
- **complete** — `github-label-history`: Scanned 364 issues/pull requests; deletion candidates are suppressed when incomplete.

## Findings

### RH-71F5C4956F6AA903 — Align documented commands with package scripts in AGENTS.md

**Severity:** medium · **Confidence:** medium · **Category:** documentation

The file invokes package scripts that are not defined in the nearest detected package manifest.

Evidence:
- `AGENTS.md:81` — Documented command references missing package script '--prefix' for .
- `AGENTS.md:84` — Documented command references missing package script '--prefix' for .
- `AGENTS.md:100` — Documented command references missing package script '--prefix' for .

Recommended actions:
- [ ] Determine the canonical current command from manifests and CI.
- [ ] Update documentation/automation or restore the missing script when it remains part of the supported workflow.

### RH-52860E285FFE74D7 — Align documented commands with package scripts in CONTRIBUTING.md

**Severity:** medium · **Confidence:** medium · **Category:** documentation

The file invokes package scripts that are not defined in the nearest detected package manifest.

Evidence:
- `CONTRIBUTING.md:18` — Documented command references missing package script '--prefix' for .
- `CONTRIBUTING.md:28` — Documented command references missing package script '--prefix' for .

Recommended actions:
- [ ] Determine the canonical current command from manifests and CI.
- [ ] Update documentation/automation or restore the missing script when it remains part of the supported workflow.

### RH-3670129D0C1701D9 — Align documented commands with package scripts in README.md

**Severity:** medium · **Confidence:** medium · **Category:** documentation

The file invokes package scripts that are not defined in the nearest detected package manifest.

Evidence:
- `README.md:49` — Documented command references missing package script '--prefix' for .
- `README.md:127` — Documented command references missing package script '--prefix' for .
- `README.md:132` — Documented command references missing package script '--prefix' for .
- `README.md:164` — Documented command references missing package script '--prefix' for .

Recommended actions:
- [ ] Determine the canonical current command from manifests and CI.
- [ ] Update documentation/automation or restore the missing script when it remains part of the supported workflow.

### RH-6F1EB4CFC06F3B12 — Repair broken local documentation references in README.md

**Severity:** medium · **Confidence:** high · **Category:** documentation

The document contains relative links, images, or heading anchors that do not resolve in the current repository snapshot.

Evidence:
- `README.md:17` — Missing local heading anchor: #testing--verification
- `README.md:20` — Missing local heading anchor: #reproducibility--maintenance

Recommended actions:
- [ ] Update each reference to the current path or anchor, or remove it when the target no longer exists.
- [ ] Preserve intentional links to generated documentation only with explicit build evidence.

### RH-A1E99F2570D86B40 — Normalize and document the GitHub label taxonomy

**Severity:** low · **Confidence:** high · **Category:** github-labels

The label inventory contains normalized duplicates or labels without descriptions.

Evidence:
- `GitHub labels` — Missing description: 7axes
- `GitHub labels` — Missing description: agent-ready
- `GitHub labels` — Missing description: axis:maintainability
- `GitHub labels` — Missing description: axis:operability_observability
- `GitHub labels` — Missing description: axis:performance_scalability
- `GitHub labels` — Missing description: axis:readability
- `GitHub labels` — Missing description: axis:reliability
- `GitHub labels` — Missing description: axis:security_compliance
- `GitHub labels` — Missing description: axis:testability_coverage
- `GitHub labels` — Missing description: escalated
- `GitHub labels` — Missing description: priority:critical
- `GitHub labels` — Missing description: priority:high
- `GitHub labels` — Missing description: priority:low
- `GitHub labels` — Missing description: priority:medium

Recommended actions:
- [ ] Choose canonical names for normalized duplicate groups and migrate issue/PR associations before deleting aliases.
- [ ] Add concise descriptions that define intended use and boundaries.
- [ ] Align issue forms and automation with the canonical taxonomy.

### RH-6CF6BD00DC5D6976 — Prune confirmed unused GitHub labels

**Severity:** low · **Confidence:** high · **Category:** github-labels

A complete history scan found labels with zero issue or pull-request use, no repository references, and no policy protection.

Evidence:
- `GitHub labels` — Unused candidate: escalated
- `GitHub labels` — Unused candidate: priority:critical

Recommended actions:
- [ ] Review the digest-bound label deletion plan.
- [ ] Retain any label with an undocumented external automation dependency and add that dependency to policy.
- [ ] Apply the plan only after the fresh zero-use and reference recheck succeeds.
