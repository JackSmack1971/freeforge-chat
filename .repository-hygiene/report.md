# Repository Hygiene Audit

Generated: `2026-06-29T16:47:23+00:00`  
Repository: `C:/workspaces/DEPLOYED/NETLIFY/freeforge-chat`  
HEAD: `ddf4491b98e2affb50bc0680883aec2022e2c9c6`

## Executive summary

- Tracked files: **137**
- Findings: **13** (13 actionable)
- Severity: critical 0, high 2, medium 8, low 3, info 0

## Detected stack

- **github-actions** (high): `.github/workflows/`
- **javascript-typescript** (high): `freeforge/package.json`

## Coverage

- **complete** — `github-remote`: Read GitHub metadata for JackSmack1971/freeforge-chat.
- **complete** — `workflow-yaml-parse`: Parsed workflows with PyYAML.
- **complete** — `documentation-local-links`: Scanned 93 tracked Markdown documents for local references.
- **skipped** — `documentation-external-links`: External URL checking is disabled by default to preserve deterministic offline operation.
- **complete** — `github-rulesets`: Repository rulesets read successfully.
- **complete** — `github-branch-protection`: Default-branch protection endpoint read successfully.
- **complete** — `github-label-history`: Scanned 213 issues/pull requests; deletion candidates are suppressed when incomplete.

## Findings

### RH-C8C6BE687737E47C — Harden GitHub Actions workflow .github/workflows/biome-check.yml

**Severity:** high · **Confidence:** high · **Category:** github-actions

The workflow has one or more security, reliability, or governance gaps that share a single file-level change and verification boundary.

Evidence:
- `.github/workflows/biome-check.yml` — Workflow does not declare top-level permissions.
- `.github/workflows/biome-check.yml` — No job timeout-minutes declaration was found.

Recommended actions:
- [ ] Add explicit least-privilege top-level permissions and job overrides only where required.
- [ ] Set bounded timeout-minutes values appropriate to each job.

### RH-45CA769D9684DB19 — Harden GitHub Actions workflow .github/workflows/node-tests.yml

**Severity:** high · **Confidence:** high · **Category:** github-actions

The workflow has one or more security, reliability, or governance gaps that share a single file-level change and verification boundary.

Evidence:
- `.github/workflows/node-tests.yml` — Workflow does not declare top-level permissions.
- `.github/workflows/node-tests.yml` — No job timeout-minutes declaration was found.

Recommended actions:
- [ ] Add explicit least-privilege top-level permissions and job overrides only where required.
- [ ] Set bounded timeout-minutes values appropriate to each job.

### RH-F74CEFB2B6123A3A — Configure dependency update coverage for detected ecosystems

**Severity:** medium · **Confidence:** high · **Category:** dependencies

No Dependabot configuration exists for detected update ecosystems: github-actions, npm.

Evidence:
- `.github/workflows/` — Detected ecosystem github-actions
- `freeforge/package.json` — Detected ecosystem javascript-typescript

Recommended actions:
- [ ] Add one valid update entry per active package ecosystem and manifest directory.
- [ ] Choose a sustainable schedule, grouping policy, labels, and pull-request limit.
- [ ] Include github-actions when workflows exist.

### RH-402658E858798B19 — Align documented commands with package scripts in .planning/codebase/TESTING.md

**Severity:** medium · **Confidence:** medium · **Category:** documentation

The file invokes package scripts that are not defined in the nearest detected package manifest.

Evidence:
- `.planning/codebase/TESTING.md:11` — Documented command references missing package script 'test' for .
- `.planning/codebase/TESTING.md:50` — Documented command references missing package script 'test' for .

Recommended actions:
- [ ] Determine the canonical current command from manifests and CI.
- [ ] Update documentation/automation or restore the missing script when it remains part of the supported workflow.

### RH-F936BEAA8F3104DF — Align documented commands with package scripts in .planning/phases/01-security-hardening/01-RESEARCH.md

**Severity:** medium · **Confidence:** medium · **Category:** documentation

The file invokes package scripts that are not defined in the nearest detected package manifest.

Evidence:
- `.planning/phases/01-security-hardening/01-RESEARCH.md:51` — Documented command references missing package script 'pack' for .
- `.planning/phases/01-security-hardening/01-RESEARCH.md:80` — Documented command references missing package script 'registry' for .
- `.planning/phases/01-security-hardening/01-RESEARCH.md:81` — Documented command references missing package script 'registry' for .
- `.planning/phases/01-security-hardening/01-RESEARCH.md:86` — Documented command references missing package script 'view' for .
- `.planning/phases/01-security-hardening/01-RESEARCH.md:87` — Documented command references missing package script 'view' for .
- `.planning/phases/01-security-hardening/01-RESEARCH.md:101` — Documented command references missing package script 'installs' for .
- `.planning/phases/01-security-hardening/01-RESEARCH.md:105` — Documented command references missing package script 'confirmed' for .
- `.planning/phases/01-security-hardening/01-RESEARCH.md:106` — Documented command references missing package script 'confirmed' for .
- `.planning/phases/01-security-hardening/01-RESEARCH.md:108` — Documented command references missing package script 'packages' for .
- `.planning/phases/01-security-hardening/01-RESEARCH.md:108` — Documented command references missing package script 'view' for .
- `.planning/phases/01-security-hardening/01-RESEARCH.md:108` — Documented command references missing package script 'view' for .
- `.planning/phases/01-security-hardening/01-RESEARCH.md:108` — Documented command references missing package script 'registry' for .
- `.planning/phases/01-security-hardening/01-RESEARCH.md:125` — Documented command references missing package script 'pack' for .
- `.planning/phases/01-security-hardening/01-RESEARCH.md:557` — Documented command references missing package script 'pack' for .
- `.planning/phases/01-security-hardening/01-RESEARCH.md:558` — Documented command references missing package script 'view' for .
- `.planning/phases/01-security-hardening/01-RESEARCH.md:558` — Documented command references missing package script 'view' for .
- `.planning/phases/01-security-hardening/01-RESEARCH.md:574` — Documented command references missing package script 'pack' for .

Recommended actions:
- [ ] Determine the canonical current command from manifests and CI.
- [ ] Update documentation/automation or restore the missing script when it remains part of the supported workflow.

### RH-E8CD98054FB5A172 — Align documented commands with package scripts in .planning/workstreams/milestone/phases/01-security-hardening/01-RESEARCH.md

**Severity:** medium · **Confidence:** medium · **Category:** documentation

The file invokes package scripts that are not defined in the nearest detected package manifest.

Evidence:
- `.planning/workstreams/milestone/phases/01-security-hardening/01-RESEARCH.md:51` — Documented command references missing package script 'pack' for .
- `.planning/workstreams/milestone/phases/01-security-hardening/01-RESEARCH.md:80` — Documented command references missing package script 'registry' for .
- `.planning/workstreams/milestone/phases/01-security-hardening/01-RESEARCH.md:81` — Documented command references missing package script 'registry' for .
- `.planning/workstreams/milestone/phases/01-security-hardening/01-RESEARCH.md:86` — Documented command references missing package script 'view' for .
- `.planning/workstreams/milestone/phases/01-security-hardening/01-RESEARCH.md:87` — Documented command references missing package script 'view' for .
- `.planning/workstreams/milestone/phases/01-security-hardening/01-RESEARCH.md:101` — Documented command references missing package script 'installs' for .
- `.planning/workstreams/milestone/phases/01-security-hardening/01-RESEARCH.md:105` — Documented command references missing package script 'confirmed' for .
- `.planning/workstreams/milestone/phases/01-security-hardening/01-RESEARCH.md:106` — Documented command references missing package script 'confirmed' for .
- `.planning/workstreams/milestone/phases/01-security-hardening/01-RESEARCH.md:108` — Documented command references missing package script 'packages' for .
- `.planning/workstreams/milestone/phases/01-security-hardening/01-RESEARCH.md:108` — Documented command references missing package script 'view' for .
- `.planning/workstreams/milestone/phases/01-security-hardening/01-RESEARCH.md:108` — Documented command references missing package script 'view' for .
- `.planning/workstreams/milestone/phases/01-security-hardening/01-RESEARCH.md:108` — Documented command references missing package script 'registry' for .
- `.planning/workstreams/milestone/phases/01-security-hardening/01-RESEARCH.md:125` — Documented command references missing package script 'pack' for .
- `.planning/workstreams/milestone/phases/01-security-hardening/01-RESEARCH.md:557` — Documented command references missing package script 'pack' for .
- `.planning/workstreams/milestone/phases/01-security-hardening/01-RESEARCH.md:558` — Documented command references missing package script 'view' for .
- `.planning/workstreams/milestone/phases/01-security-hardening/01-RESEARCH.md:558` — Documented command references missing package script 'view' for .
- `.planning/workstreams/milestone/phases/01-security-hardening/01-RESEARCH.md:574` — Documented command references missing package script 'pack' for .

Recommended actions:
- [ ] Determine the canonical current command from manifests and CI.
- [ ] Update documentation/automation or restore the missing script when it remains part of the supported workflow.

### RH-BE2A907B70417B78 — Align documented commands with package scripts in CLAUDE.md

**Severity:** medium · **Confidence:** medium · **Category:** documentation

The file invokes package scripts that are not defined in the nearest detected package manifest.

Evidence:
- `CLAUDE.md:23` — Documented command references missing package script 'ci' for .
- `CLAUDE.md:24` — Documented command references missing package script 'lint' for .
- `CLAUDE.md:24` — Documented command references missing package script 'lint' for .
- `CLAUDE.md:25` — Documented command references missing package script 'typecheck' for .
- `CLAUDE.md:25` — Documented command references missing package script 'typecheck' for .
- `CLAUDE.md:27` — Documented command references missing package script 'build' for .
- `CLAUDE.md:27` — Documented command references missing package script 'build' for .

Recommended actions:
- [ ] Determine the canonical current command from manifests and CI.
- [ ] Update documentation/automation or restore the missing script when it remains part of the supported workflow.

### RH-SUP-434A64B0E3CA3D7D — Extend .gitignore to cover generated and session artifact directories

**Severity:** medium · **Confidence:** high · **Category:** git

Several generated output directories are not excluded by .gitignore and could be accidentally committed: coverage/, .session-feedback/, and .repository-hygiene/. These are agent session data, test coverage output, and hygiene audit output respectively.

Evidence:
- `.gitignore` — coverage/, .session-feedback/, .repository-hygiene/ are absent from .gitignore
- `git status --short` — coverage/ and .session-feedback/ appear as untracked directories alongside deliberate untracked work

Recommended actions:
- [ ] Add coverage/, .session-feedback/, and .repository-hygiene/ to .gitignore.
- [ ] Verify no tracked file under those paths would be silently excluded by the new rules.

### RH-4877A2CBB620C19E — Add repository-specific contribution guidelines

**Severity:** medium · **Confidence:** high · **Category:** governance

No recognized CONTRIBUTING.md exists in GitHub-supported repository locations.

Evidence:
- `git ls-files` — Missing CONTRIBUTING.md in .github/, repository root, and docs/

Recommended actions:
- [ ] Create CONTRIBUTING.md using repository-specific contacts, workflows, and commands.
- [ ] Cross-link it from the README where appropriate.

### RH-9B965B57FB2DE21C — Define maintainership boundaries with CODEOWNERS

**Severity:** medium · **Confidence:** medium · **Category:** governance

The repository has multiple contributors but no CODEOWNERS file in a supported location.

Evidence:
- `remote contributors` — Contributor count: 4
- `git ls-files` — No CODEOWNERS found

Recommended actions:
- [ ] Map high-risk and domain-specific paths to active maintainers or teams.
- [ ] Add fallback ownership and validate patterns against the current tree.

### RH-F22EC5735535B489 — Review local branches whose upstream is gone

**Severity:** low · **Confidence:** high · **Category:** git

Local branches reference remote-tracking branches that no longer exist.

Evidence:
- `git for-each-ref` — audit/F-001-test-script-path
- `git for-each-ref` — audit/F-002-copy-codeblock-continue
- `git for-each-ref` — audit/F-002-remove-dangling-csp-report-uri
- `git for-each-ref` — audit/F-003-explicit-uri-regexp
- `git for-each-ref` — audit/F-003-guard-marked-use-cdn-failure
- `git for-each-ref` — audit/F-004-fix-context-token-estimate
- `git for-each-ref` — audit/F-004-pin-actions-sha
- `git for-each-ref` — audit/F-005-remove-cdn-deps
- `git for-each-ref` — audit/F-006-csp-hash-src
- `git for-each-ref` — audit/F-006-nav-aria-label
- `git for-each-ref` — audit/F-007-settings-hidden-class
- `git for-each-ref` — audit/F-008-clear-persistent-toasts
- `git for-each-ref` — audit/F-009-claude-md-versions
- `git for-each-ref` — audit/F-009-label-model-select
- `git for-each-ref` — audit/F-010-label-msg-input
- `git for-each-ref` — audit/F-011-palette-aria-expanded
- `git for-each-ref` — audit/F-013-palette-focus-trap
- `git for-each-ref` — audit/F-103-context-tokens
- `git for-each-ref` — audit/F-104-stream-usage
- `git for-each-ref` — audit/F-105-palette-focus

Recommended actions:
- [ ] Check each branch for unique commits and active worktrees.
- [ ] Back up or push any work that must be retained.
- [ ] Delete only branches proven obsolete.

### RH-4D65F119F7CF7AB1 — Add a repository-specific pull request template

**Severity:** low · **Confidence:** high · **Category:** governance

No GitHub-recognized pull request template was found.

Evidence:
- `git ls-files` — No pull request template found

Recommended actions:
- [ ] Add a concise template covering intent, risk, tests, documentation, and linked issue.

### RH-0E154459E2AB453B — Add structured issue intake templates

**Severity:** low · **Confidence:** high · **Category:** governance

Issues are available or remote status is unknown, but no issue template or form was found.

Evidence:
- `.github/ISSUE_TEMPLATE/` — No issue templates found

Recommended actions:
- [ ] Create separate bug, feature, and support/security routing templates only where applicable.
- [ ] Use required fields sparingly and ensure referenced labels exist.
