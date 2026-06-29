# Testing

## Summary

The repo has a narrow automated test suite focused on security, storage, and rendering invariants.
There is no browser automation framework in the tree.

## Test Runner

- Node’s built-in test runner (`node:test`)
- `freeforge/package.json` exposes the `test` script from the `freeforge/` package root
- Tests live in `tests/security/**/*.mjs`

## Current Coverage

- CSP and style-sink checks in `tests/security/style-csp.test.mjs`
- Storage helper behavior in `tests/security/state-storage.test.mjs`
- Escaping and key masking in `tests/security/state-utils.test.mjs`
- Markdown pipeline hardening in `tests/security/markdown-pipeline.test.mjs`
- HTML sink audits in `tests/security/innerhtml-audit.test.mjs`

## What the Tests Validate

- Local Tailwind stylesheet is used instead of a remote Tailwind CDN
- UI files avoid inline `style=` and `cssText` sinks
- `esc()` escapes the dangerous characters expected by the app
- `maskKey()` hides API keys in settings and onboarding UI
- Stored keys migrate from persistent localStorage to sessionStorage
- `renderMd()` sanitizes output or falls back to escaped text
- The app avoids raw document.write usage

## Test Style

- Assertions use `node:assert/strict`
- Tests read source files directly when checking static safety rules
- Some tests replace globals like `marked`, `DOMPurify`, `localStorage`, and `sessionStorage`
- Coverage is behavior-oriented at the module boundary, not at the browser UI boundary

## Gaps in Automation

- No Playwright/Cypress/Vitest suite
- No end-to-end browser harness
- No visual regression tests
- Manual UAT is still needed for modal focus, live regions, and palette behavior

## Validation Commands

- `node --test`
- `node --test tests/security`
- `cd freeforge && npm test`

## Risk Areas

- Browser-only regressions can slip past the Node tests
- Accessibility behavior needs manual confirmation
- CDN-delivered scripts are not covered by a package lockfile

## Key Paths

- `tests/security/style-csp.test.mjs`
- `tests/security/state-utils.test.mjs`
- `tests/security/state-storage.test.mjs`
- `tests/security/markdown-pipeline.test.mjs`
- `tests/security/innerhtml-audit.test.mjs`

