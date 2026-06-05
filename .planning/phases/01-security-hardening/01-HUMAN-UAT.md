---
status: partially_verified
phase: 01-security-hardening
source: [01-VERIFICATION.md]
started: 2026-06-04T00:00:00Z
updated: 2026-06-05T02:02:00Z
---

## Current Test

The deployment gap is closed. A direct HTTPS probe on 2026-06-05 against `https://freeforge-chat.netlify.app/` shows production now serves the hardened headers, updated privacy copy, and the hardened `src/api.js`, `src/markdown.js`, and `src/state.js` bundle content from commit `8f94d48`.

## Tests

### 1. CSP runtime enforcement
expected: No CSP violation errors appear in DevTools Console. The app loads normally.
result: partial

Direct production probe confirms the served headers are now aligned with the hardened worktree: `connect-src https://openrouter.ai`, `frame-ancestors 'none'`, and `Referrer-Policy: no-referrer` are live. A real browser console check is still pending, so runtime CSP cleanliness is not fully human-verified yet.

### 2. API key persistence round-trip
expected: Within the same browser tab, reload keeps you in chat (getStoredKey/setStoredKey work correctly, no JSON double-encoding). After a full browser restart or a brand-new tab, onboarding returns because the key is session-scoped.
result: partial

Confirmed by user on deployed Netlify instance. getStoredKey/setStoredKey round-trip works correctly.

Production HTML and served `state.js` are now aligned with the session-scoped storage model. Remaining gap: a fresh same-tab/new-tab/browser-restart round-trip has not been re-run after the final deployed hardening set.

### 3. CDN-fail XSS fallback
expected: The assistant reply renders the literal text `<script>alert(1)</script>` escaped as visible characters — no alert fires, no raw HTML injected.
result: static_only

Code path confirmed correct via static analysis. esc(text) fallback in place in markdown.js.

### 4. External production probe
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

total: 4
passed: 1
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps

- Remaining gaps are browser-executed checks, not deployment drift: DevTools confirmation of zero CSP violations, a fresh same-tab/new-tab key lifecycle round-trip on the deployed app, and the true CDN-fail DOMPurify fallback path.
