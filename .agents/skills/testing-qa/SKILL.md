---
name: testing-qa
description: Design and execute proportionate unit, integration, end-to-end, browser, performance, security, and release-quality checks using the tools already present in a project.
compatibility: Requires the project's existing test and QA tools; no runner or dependency is assumed.
---

# Testing and QA

Use this workflow to choose the smallest test strategy that proves the requested behavior. Inspect the repository first, reuse its existing runner, and report unavailable tooling as UNKNOWN instead of installing a framework by default.

1. Define the risk and test pyramid: focused unit checks first, integration checks for boundaries, and E2E/browser checks only for critical user paths.
2. Run the project's documented test, lint, type-check, security, and build commands when they exist.
3. For browser work, use the in-app browser skill or the project's existing automation; do not assume Playwright, Jest, pytest, or coverage thresholds.
4. Record failures with the exact command and a short safe summary. Separate pre-existing failures from regressions.
5. Before completion, verify the acceptance criteria, error paths, security boundaries, accessibility basics, and changed documentation.

The related `test-driven-development`, `security-best-practices`, and `pr-review` skills may be invoked when their narrower scope is actually requested. Do not reference unavailable skills or use `@skill` launcher syntax.
