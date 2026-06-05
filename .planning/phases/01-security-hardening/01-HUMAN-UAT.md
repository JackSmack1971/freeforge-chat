---
status: stale
phase: 01-security-hardening
source: [01-VERIFICATION.md]
started: 2026-06-04T00:00:00Z
updated: 2026-06-04T00:00:00Z
---

## Current Test

The earlier manual checks were reported as passed, but they are no longer sufficient as production evidence. A direct HTTPS probe on 2026-06-04 against `https://freeforge-chat.netlify.app/` shows the deployed site matches the last committed `origin/main` state (`297896e`) rather than the newer uncommitted hardening in the current worktree. Production verification must be re-run after the current worktree changes are committed, shipped, and redeployed.

## Tests

### 1. CSP runtime enforcement
expected: No CSP violation errors appear in DevTools Console. The app loads normally.
result: stale

Earlier human verification reported the Netlify deployment as clean. Current external evidence contradicts the hardened header state in the worktree: production still serves `connect-src https://openrouter.ai https://cdn.jsdelivr.net`, lacks `frame-ancestors 'none'`, and still uses `Referrer-Policy: strict-origin-when-cross-origin`.

### 2. API key persistence round-trip
expected: Within the same browser tab, reload keeps you in chat (getStoredKey/setStoredKey work correctly, no JSON double-encoding). After a full browser restart or a brand-new tab, onboarding returns because the key is session-scoped.
result: partial

Confirmed by user on deployed Netlify instance. getStoredKey/setStoredKey round-trip works correctly.

However, the deployed HTML still shows the older copy "Your key stays in your browser only" and "Local storage only", so the production bundle is not aligned with the current session-scoped storage implementation in this worktree.

### 3. CDN-fail XSS fallback
expected: The assistant reply renders the literal text `<script>alert(1)</script>` escaped as visible characters — no alert fires, no raw HTML injected.
result: static_only

Code path confirmed correct via static analysis. esc(text) fallback in place in markdown.js.

### 4. External production probe
expected: Production serves the tightened security headers and updated privacy copy from the current worktree.
result: failed

Observed on 2026-06-04 via direct HTTPS probe to `https://freeforge-chat.netlify.app/`:

- `Content-Security-Policy` still contains `connect-src https://openrouter.ai https://cdn.jsdelivr.net`
- `frame-ancestors 'none'` is absent
- `Referrer-Policy` is still `strict-origin-when-cross-origin`
- The HTML still contains "Your key stays in your browser only" and "Powered by OpenRouter free models • Local storage only"

This proves the deployed site has not yet picked up the latest local hardening changes.

## Pending Deployment Delta

Compared with the current worktree, the live deployment is missing these additional local hardening changes:

- `netlify.toml`: remove jsDelivr from `connect-src`, add `frame-ancestors 'none'`, change `Referrer-Policy` to `no-referrer`
- `freeforge/index.html`: session-scoped privacy copy ("Key kept to this tab", no "Local storage only")
- `freeforge/src/api.js`: remove optional `HTTP-Referer` and `X-Title` request headers
- `freeforge/src/markdown.js`: remove `img`/`src`, `id`, and `class` from the sanitizer allowlist
- `freeforge/src/state.js` + `freeforge/src/features/settings.js`: add and use `clearStoredKey()` for full key clearing

## Summary

total: 4
passed: 0
issues: 1
pending: 3
skipped: 0
blocked: 0

## Gaps

- Production deployment matches committed `origin/main` but is out of sync with the newer uncommitted hardened worktree and must be redeployed after those changes are shipped.
