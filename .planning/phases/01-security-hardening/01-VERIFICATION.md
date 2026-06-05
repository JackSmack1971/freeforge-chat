---
phase: 01-security-hardening
verified: 2026-06-04T00:00:00Z
status: complete
score: 5/5 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Open freeforge/index.html in a browser with DevTools open. Check the Console tab for any Content Security Policy violation errors on page load, and inspect the response headers for Content-Security-Policy and Referrer-Policy."
    expected: "No CSP violation errors appear. The app loads normally — the onboarding screen is visible."
    why_human: "CSP/referrer header enforcement is a runtime browser behavior. No static grep can confirm that Netlify serves the tightened headers and that all loaded resources (Tailwind JIT worker, ES module entry point, CDN scripts) satisfy them without violations."
  - test: "Open the app, paste a valid OpenRouter API key, and submit. Reload in the same browser tab, then open a brand-new tab or restart the browser."
    expected: "Same-tab reload keeps you in chat, but a new tab/browser restart returns you to onboarding, confirming getStoredKey() / setStoredKey() use session-scoped storage rather than persistent localStorage."
    why_human: "Browser sessionStorage lifecycle is runtime behavior. Static analysis confirms the helper logic, but only a live browser can prove same-tab persistence and cross-tab/browser-reset clearing."
  - test: "With DevTools Network open, send a chat message and inspect the https://openrouter.ai/api/v1/chat/completions request headers."
    expected: "The request contains Authorization and Content-Type, but does not contain HTTP-Referer, X-Title, or X-OpenRouter-Title."
    why_human: "Static analysis confirms the request code no longer sets attribution headers. A live network inspection confirms the deployed bundle matches source and that the browser does not add unexpected metadata on its own."
  - test: "Disconnect from the internet (or block cdn.jsdelivr.net in DevTools Network tab), then open the app and send a message containing a <script>alert(1)</script> fragment."
    expected: "The assistant reply renders the literal text '<script>alert(1)</script>' escaped as visible characters — no alert fires, no raw HTML injected."
    why_human: "The CDN-fail XSS fallback path (esc(text).replace) can only be exercised when DOMPurify is genuinely unavailable. Static analysis confirms the code path is correct; the live test confirms browser execution."
---

# Phase 1: Security Hardening Verification Report

**Phase Goal:** The app has no XSS vectors, no CVE-affected dependencies, and a Content Security Policy — a portfolio reviewer who audits the source finds nothing disqualifying
**Verified:** 2026-06-04T00:00:00Z
**Status:** incomplete_in_production
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #  | Truth                                                                                                   | Status     | Evidence                                                                                                                 |
|----|--------------------------------------------------------------------------------------------------------|------------|--------------------------------------------------------------------------------------------------------------------------|
| 1  | `freeforge.html` (root) no longer exists — only entry point is `freeforge/index.html`                 | VERIFIED   | `Glob("freeforge.html")` returns no files. `test -f freeforge.html` exits non-zero.                                     |
| 2  | DOMPurify loads at 3.4.8 and marked.js loads at 18.0.4 each with matching SRI hash                    | VERIFIED   | `index.html` line 11: `marked@18.0.4/lib/marked.umd.js` with hash `sha384-8RA8...`. Line 14: `dompurify@3.4.8` with hash `sha384-jrsB...`. No old version strings remain. |
| 3  | CSP is present restricting scripts, connections, framing, and objects | VERIFIED   | Delivered via HTTP header in `netlify.toml` `[[headers]]` (upgraded from meta tag — HTTP header cannot be bypassed by pre-header HTML injection). Directives cover `default-src`, `script-src`, `worker-src`, `connect-src`, `style-src`, `base-uri`, `frame-ancestors`, and `object-src`. |
| 4  | The `markdown.js` CDN-fail branch escapes text instead of returning raw HTML                           | VERIFIED   | `markdown.js` line 13: ternary else returns `esc(text).replace(/\n/g, '<br>')`. No `return raw` anywhere. `marked.use()` at module level (line 5), before export function (line 7). No `marked.setOptions` anywhere. |
| 5  | All `ff_key` storage access goes through `getStoredKey()` / `setStoredKey()` / `clearStoredKey()`; the key no longer persists in `localStorage` | VERIFIED   | `state.js` lines 31-50 contain the only `ff_key` storage operations: same-tab reads from `sessionStorage`, one-time migration from legacy `localStorage`, writes to `sessionStorage`, and explicit removal from both stores. `onboarding.js`, `settings.js`, and `app.js` all import and call the helpers. |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact                                       | Expected                                           | Status     | Details                                                                                  |
|------------------------------------------------|----------------------------------------------------|------------|------------------------------------------------------------------------------------------|
| `freeforge.html` (root)                        | DELETED — must not exist                           | VERIFIED   | File absent from repository root. Glob confirms no match.                                |
| `freeforge/index.html`                         | Single entry point; marked@18.0.4, DOMPurify@3.4.8 | VERIFIED | Both CDN library versions and hashes are correct. Old version strings absent.                    |
| `netlify.toml`                                 | Tightened browser security headers                | VERIFIED   | CSP header narrows `connect-src` to OpenRouter, denies framing with `frame-ancestors 'none'`, and sets `Referrer-Policy = "no-referrer"`. |
| `freeforge/src/markdown.js`                    | Safe renderer; `marked.use()` at module level; escape fallback; no rendered images | VERIFIED | `marked.use()` is at module scope. Both fallback paths use `esc()`. Sanitizer allowlist excludes `img` and `src`, so assistant output cannot trigger passive third-party image fetches. |
| `freeforge/src/state.js`                       | Exports `getStoredKey()`, `setStoredKey(key)`, and `clearStoredKey()`   | VERIFIED   | Lines 30-50: helpers use `sessionStorage` for the live key, migrate and remove any legacy `localStorage` copy, and clear both stores explicitly. |
| `freeforge/src/features/onboarding.js`         | Uses `setStoredKey()` for ff_key write             | VERIFIED   | Line 1 imports `setStoredKey`. Line 22 calls `setStoredKey(key)`. No direct `localStorage.setItem('ff_key')`. |
| `freeforge/src/features/settings.js`           | Uses key-storage helpers for ff_key write and clear | VERIFIED   | Line 1 imports `setStoredKey` and `clearStoredKey`. Line 33 calls `setStoredKey(key)`. Line 53 clears the key via `clearStoredKey()` before deleting `ff_msgs` and `ff_model`. |
| `freeforge/src/app.js`                         | Uses `getStoredKey()` for ff_key read              | VERIFIED   | Line 1 imports `getStoredKey`. Line 11 calls `const savedKey = getStoredKey()`. No direct `localStorage.getItem('ff_key')`. |

### Key Link Verification

| From                                      | To                                              | Via                          | Status  | Details                                                       |
|-------------------------------------------|-------------------------------------------------|------------------------------|---------|---------------------------------------------------------------|
| `index.html script[src*=marked]`          | `cdn.jsdelivr.net/npm/marked@18.0.4/lib/marked.umd.js` | SRI-enforced script tag     | WIRED   | Line 11-13 in index.html; integrity hash present.             |
| `index.html script[src*=dompurify]`       | `cdn.jsdelivr.net/npm/dompurify@3.4.8/dist/purify.min.js` | SRI-enforced script tag   | WIRED   | Line 14-16 in index.html; integrity hash present.             |
| `netlify.toml [[headers]]`                | Browser CSP/referrer enforcement                | HTTP response headers            | WIRED | `Content-Security-Policy` and `Referrer-Policy` are defined centrally for all routes. |
| `markdown.js renderMd()` fallback         | `esc(text).replace`                             | DOMPurify-unavailable branch | WIRED   | Line 13 ternary else; line 15 catch block. Both use `esc()`.  |
| `onboarding.js` import                    | `state.js setStoredKey export`                  | Named import                 | WIRED   | `import { S, $, setStoredKey } from '../state.js'` on line 1. |
| `settings.js` import                      | `state.js setStoredKey/clearStoredKey exports`  | Named import                 | WIRED   | `import { S, $, LS, maskKey, setStoredKey, clearStoredKey } from '../state.js'` on line 1. |
| `app.js` import                           | `state.js getStoredKey export`                  | Named import                 | WIRED   | `import { S, $, LS, getStoredKey } from './state.js'` on line 1. |
| `api.js` request headers                   | OpenRouter chat completions                     | Minimal request header set   | WIRED   | Chat requests send only `Authorization` and `Content-Type`; no `HTTP-Referer` or `X-Title` remain. |

### Data-Flow Trace (Level 4)

Not applicable — this phase modifies entry point configuration, CDN library versions, a markdown utility, and localStorage accessor wiring. No new dynamic data rendering components were introduced.

### Behavioral Spot-Checks

| Behavior                                              | Command                                                                  | Result                           | Status |
|-------------------------------------------------------|--------------------------------------------------------------------------|----------------------------------|--------|
| freeforge.html absent                                 | `test -f freeforge.html`                                                 | exit non-zero; "DELETED" output  | PASS   |
| marked@18.0.4 in index.html                           | Grep `marked@18.0.4/lib/marked.umd.js` in index.html                    | 1 match on line 11               | PASS   |
| dompurify@3.4.8 in index.html                         | Grep `dompurify@3.4.8` in index.html                                     | 1 match on line 14               | PASS   |
| CSP header configured                                  | Grep `Content-Security-Policy` in netlify.toml                           | 1 match in `[[headers]]`         | PASS   |
| No old version strings                                | Grep `marked@9.1.6\|dompurify@3.1.6\|marked.min.js` in index.html       | 0 matches                        | PASS   |
| marked.use() at module level before export            | Read markdown.js; line 5 vs line 7                                       | line 5 < line 7                  | PASS   |
| No marked.setOptions                                  | Grep `marked.setOptions` in src/                                         | 0 matches                        | PASS   |
| No `return raw` XSS vector                            | Grep `return raw` in markdown.js                                         | 0 matches                        | PASS   |
| esc(text) fallback appears twice                      | Read markdown.js lines 13 and 15                                         | 2 occurrences confirmed          | PASS   |
| getStoredKey / setStoredKey exported from state.js    | Read state.js lines 30-35                                                | Both exports present             | PASS   |
| No direct ff_key storage outside state.js            | Grep `ff_key` storage access across src/                                 | Only state.js helper block plus helper imports/calls in consumers | PASS   |
| Clear path removes session-scoped key                | Read settings.js + state.js                                              | `clearKey()` calls `clearStoredKey()`; helper removes both stores | PASS   |
| No OpenRouter attribution headers in chat requests   | Grep `HTTP-Referer\|X-Title` in `freeforge/src/`                         | 0 matches                        | PASS   |
| CSP connect-src narrowed to API origin only          | Read `netlify.toml`                                                      | `connect-src https://openrouter.ai` only | PASS   |
| CSP denies framing                                   | Read `netlify.toml`                                                      | `frame-ancestors 'none'` present | PASS   |
| Referrer policy suppresses browser referrers         | Read `netlify.toml`                                                      | `Referrer-Policy = "no-referrer"` | PASS   |
| Markdown sanitizer blocks DOM-clobbering attrs       | Read `markdown.js`                                                       | `ALLOWED_ATTR` excludes `id` and `class` | PASS   |
| Markdown renderer blocks passive remote images       | Read `markdown.js`                                                       | `ALLOWED_TAGS` excludes `img`; `ALLOWED_ATTR` excludes `src` | PASS   |

### Probe Execution

No probe scripts declared or present for this phase. Step 7c: SKIPPED (no probe-*.sh files found under scripts/).

### Requirements Coverage

| Requirement | Source Plan  | Description                                                      | Status    | Evidence                                                                  |
|-------------|-------------|------------------------------------------------------------------|-----------|---------------------------------------------------------------------------|
| SEC-01      | 01-01-PLAN  | Delete `freeforge.html` root entry point                         | SATISFIED | File absent from repository; Glob returns no match.                       |
| SEC-02      | 01-01-PLAN  | Upgrade DOMPurify 3.1.6 → 3.4.8 with SRI hash                   | SATISFIED | `index.html` line 14: `dompurify@3.4.8`, hash `sha384-jrsB...`.          |
| SEC-03      | 01-01-PLAN  | Upgrade marked.js 9.1.6 → 18.0.4 with SRI hash                  | SATISFIED | `index.html` line 11: `marked@18.0.4/lib/marked.umd.js`, hash `sha384-8RA8...`. |
| SEC-04      | 01-02-PLAN  | Fix markdown.js CDN-fail fallback (`return raw` → `esc(text)`)  | SATISFIED | `markdown.js` line 13: ternary else returns `esc(text).replace(...)`.     |
| SEC-05      | 01-01-PLAN  | Add CSP to the app entry point delivery path                    | SATISFIED | `netlify.toml` defines the authoritative `Content-Security-Policy` response header for all routes. It includes `'self'` in `script-src` (required for the ES module entry point), `worker-src` for Tailwind JIT, `connect-src https://openrouter.ai`, and tighter post-phase directives including `frame-ancestors 'none'`. |
| SEC-06      | 01-03-PLAN  | Centralise ff_key storage via helper exports        | SATISFIED | `state.js` exports `getStoredKey()`, `setStoredKey()`, and `clearStoredKey()`; all three caller files updated; no direct `ff_key` storage calls remain outside state.js. |
| SEC-07      | 01-02-PLAN  | Move `marked.use()` to module initialization                     | SATISFIED | `markdown.js` line 5: `marked.use({ breaks: true, gfm: true })` before `export function renderMd` on line 7. |

All 7 SEC requirements for Phase 1 are satisfied.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (none) | — | — | — | — |

No debt markers (TBD, FIXME, XXX), placeholder strings, stub returns, or hardcoded empty data found in any file modified by this phase.

### Human Verification Required

#### 1. CSP Enforcement — No Runtime Violations

**Test:** Open `freeforge/index.html` in a browser (Chrome or Firefox) with DevTools open, Console tab visible. Load the page and inspect the document response headers in DevTools Network.
**Expected:** No Content Security Policy violation warnings or errors appear in the console. The app renders the onboarding screen normally. The served headers include `Content-Security-Policy` with `connect-src https://openrouter.ai`, `frame-ancestors 'none'`, and `Referrer-Policy: no-referrer`.
**Why human:** Header delivery and CSP enforcement are browser/runtime behaviors. Static analysis confirms the configured header strings, but cannot prove that the deployed server returns them and that all loaded resources satisfy them without violations.

#### 2. API Key Persistence Round-Trip

**Test:** Open the app, enter a valid OpenRouter API key, click "Save & Connect". Reload in the same tab, then open a new tab or restart the browser.
**Expected:** Same-tab reload skips onboarding and goes directly to the chat screen. A new tab or full browser restart returns to onboarding, confirming the API key is session-scoped rather than persisted on disk.
**Why human:** `getStoredKey()` / `setStoredKey()` now target `sessionStorage` with one-time migration cleanup of old `localStorage` state. Static analysis verified the code path; only a live browser round-trip can confirm the intended session lifecycle.

#### 2b. Minimal OpenRouter Request Metadata

**Test:** With DevTools Network open, send a chat message and inspect the `https://openrouter.ai/api/v1/chat/completions` request headers.
**Expected:** The request contains `Authorization` and `Content-Type`, but does not contain `HTTP-Referer`, `X-Title`, or `X-OpenRouter-Title`.
**Why human:** Static analysis confirms the request code no longer sets attribution headers. A live network inspection confirms the browser does not add unexpected metadata on its own and that the deployed bundle matches source.

#### 3. CDN-Fail XSS Fallback Execution

**Test:** In DevTools Network tab, block `cdn.jsdelivr.net` (or disconnect network). Reload the app (it may error during load but the markdown module will initialize without DOMPurify). Trigger a scenario where a message is rendered containing `<script>alert(1)</script>` or `<img src=x onerror=alert(1)>`.
**Expected:** The dangerous HTML is rendered as visible escaped text characters, not executed. No alert fires. No raw HTML is injected into the DOM.
**Why human:** The CDN-fail code path (`typeof DOMPurify !== 'undefined'` evaluating to false) can only be truly exercised when DOMPurify fails to load. Static analysis confirms the code path returns `esc(text)` — this runtime test confirms the browser executes that path correctly under CDN failure conditions.

### Gaps Summary

Static source inspection verifies the hardened worktree, but a direct external probe on 2026-06-04 shows the live deployment at `https://freeforge-chat.netlify.app/` is still serving older headers and older privacy copy:

- `Content-Security-Policy` still allows `https://cdn.jsdelivr.net` in `connect-src`
- `frame-ancestors 'none'` is absent from the live CSP
- `Referrer-Policy` is still `strict-origin-when-cross-origin`
- The rendered page still says "Your key stays in your browser only" and "Local storage only"

Therefore the codebase remediation is ahead of production, and runtime verification cannot currently prove the hardened state is deployed.

The deployment boundary is now clear:

- Live production matches the last committed `origin/main` / `HEAD` state (`297896e`)
- The stronger hardening described in this report exists only in the current uncommitted worktree
- A fresh commit/push/redeploy cycle is required before the runtime checks can verify the newer hardening externally

### Post-Phase Hardening Addendum

The current codebase also includes several additional hardening measures beyond the original seven SEC requirements:

- Browser security headers are tightened in `netlify.toml`: `connect-src` is limited to OpenRouter, `frame-ancestors 'none'` is present, and `Referrer-Policy` is `no-referrer`.
- OpenRouter chat requests no longer send optional app-attribution headers (`HTTP-Referer`, `X-Title`).
- The markdown sanitizer allowlist no longer permits arbitrary `id` or `class` attributes, reducing DOM-clobbering risk from untrusted model output.
- Assistant-rendered markdown no longer allows `<img>` tags, preventing passive third-party image beacons from model output even when the app is opened outside the Netlify header environment.
- Key clearing now removes `ff_key` from both `sessionStorage` and any legacy `localStorage` copy.

At present these addendum items are verified in the worktree but not yet in the deployed Netlify artifact.

The four human verification items above remain the required runtime confirmations after a fresh deployment. Until the deployed site reflects the current worktree, they cannot be treated as satisfied for the real end-to-end audit claim.

---

_Verified: 2026-06-04T00:00:00Z_
_Verifier: Claude (gsd-verifier)_
