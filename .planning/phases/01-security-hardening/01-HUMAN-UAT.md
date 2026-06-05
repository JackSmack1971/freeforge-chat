---
status: complete
phase: 01-security-hardening
source: [01-VERIFICATION.md]
started: 2026-06-04T00:00:00Z
updated: 2026-06-05T02:15:00Z
---

## Current Test

Runtime verification is complete. Headless Chrome CDP probes on 2026-06-05 against `https://freeforge-chat.netlify.app/` confirmed the deployed site serves the hardened headers, updated privacy copy, session-scoped key behavior, minimal OpenRouter request metadata, and safe markdown fallback behavior from the shipped remediation set.

## Tests

### 1. CSP runtime enforcement
expected: No CSP violation errors appear in DevTools Console. The app loads normally.
result: passed

Observed in a real headless browser session against production: onboarding loads normally on a clean tab, and no console or log entry contains a CSP violation or blocked-resource enforcement message. Non-security console noise remains (`cdn.tailwindcss.com` production warning, password-field-not-in-form warnings, and a favicon 404), but none are CSP failures.

### 2. API key persistence round-trip
expected: Within the same browser tab, reload keeps you in chat (getStoredKey/setStoredKey work correctly, no JSON double-encoding). After a full browser restart or a brand-new tab, onboarding returns because the key is session-scoped.
result: passed

In the browser runtime probe, a clean tab starts on onboarding with both `sessionStorage.ff_key` and `localStorage.ff_key` absent. After injecting a test key into `sessionStorage` and reloading the same tab, the app opens the chat screen and the key remains only in `sessionStorage`. A brand-new top-level tab returns to onboarding with both stores empty, confirming the deployed behavior is tab-scoped rather than persistent.

### 3. Minimal OpenRouter request metadata
expected: OpenRouter requests contain the required auth/content headers but no `Referer`, `HTTP-Referer`, `X-Title`, or `X-OpenRouter-Title`.
result: passed

Real browser capture of the deployed app context shows:

- The CORS preflight carries `Origin: https://freeforge-chat.netlify.app` and no `Referer`
- The actual `POST https://openrouter.ai/api/v1/chat/completions` request carries `Authorization`, `Content-Type`, and `Origin`
- The actual request does not carry `Referer`, `HTTP-Referer`, `X-Title`, or `X-OpenRouter-Title`

### 4. CDN-fail XSS fallback
expected: The assistant reply renders the literal text `<script>alert(1)</script>` escaped as visible characters — no alert fires, no raw HTML injected.
result: passed

With the DOMPurify CDN URL blocked in a live browser session, `typeof DOMPurify` is `undefined` while `marked` still loads. Calling `renderMd('<script>alert(1)</script><img src=x onerror=alert(1)>')` returns escaped text, and inserting that output into a real DOM produces no `<script>` node, no `<img>` node, and no alert execution.

### 5. External production probe
expected: Production serves the tightened security headers and updated privacy copy from the current worktree.
result: passed

Observed on 2026-06-05 via direct HTTPS probe to `https://freeforge-chat.netlify.app/`:

- `Content-Security-Policy` now contains `connect-src https://openrouter.ai` and `frame-ancestors 'none'`
- `Referrer-Policy` is now `no-referrer`
- The HTML now contains "Your key stays in this browser tab only. Chat history stays local to your browser."
- The footer now contains "Powered by OpenRouter free models • Key kept to this tab • Chat history stays local"
- Served `src/api.js` contains no `HTTP-Referer` or `X-Title`
- Served `src/markdown.js` excludes `img`/`src`, `id`, and `class` from the sanitizer allowlist
- Served `src/state.js` uses `sessionStorage` plus full legacy/local cleanup via `clearStoredKey()`

This proves the deployed site has picked up the latest hardening changes that were previously local-only.

## Summary

total: 5
passed: 5
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

- None for Phase 1 security acceptance. Remaining console noise is non-blocking and outside the security-hardening scope.
