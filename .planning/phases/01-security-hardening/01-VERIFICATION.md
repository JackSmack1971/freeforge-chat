---
phase: 01-security-hardening
verified: 2026-06-04T00:00:00Z
status: human_needed
score: 5/5 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Open freeforge/index.html in a browser with DevTools open. Check the Console tab for any Content Security Policy violation errors on page load."
    expected: "No CSP violation errors appear. The app loads normally — the onboarding screen is visible."
    why_human: "CSP enforcement is a runtime browser behavior. No static grep can confirm the CSP string produces zero violations for all loaded resources (Tailwind JIT worker, ES module entry point, CDN scripts)."
  - test: "Open the app, paste a valid OpenRouter API key, and submit. Then refresh the page."
    expected: "After refresh the app skips onboarding and goes directly to the chat screen, confirming getStoredKey() / setStoredKey() persist and retrieve the key correctly."
    why_human: "localStorage read/write round-trip correctness requires a running browser — static analysis confirmed the call sites but not the absence of JSON double-encoding bugs at runtime."
  - test: "Disconnect from the internet (or block cdn.jsdelivr.net in DevTools Network tab), then open the app and send a message containing a <script>alert(1)</script> fragment."
    expected: "The assistant reply renders the literal text '<script>alert(1)</script>' escaped as visible characters — no alert fires, no raw HTML injected."
    why_human: "The CDN-fail XSS fallback path (esc(text).replace) can only be exercised when DOMPurify is genuinely unavailable. Static analysis confirms the code path is correct; the live test confirms browser execution."
---

# Phase 1: Security Hardening Verification Report

**Phase Goal:** The app has no XSS vectors, no CVE-affected dependencies, and a Content Security Policy — a portfolio reviewer who audits the source finds nothing disqualifying
**Verified:** 2026-06-04T00:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #  | Truth                                                                                                   | Status     | Evidence                                                                                                                 |
|----|--------------------------------------------------------------------------------------------------------|------------|--------------------------------------------------------------------------------------------------------------------------|
| 1  | `freeforge.html` (root) no longer exists — only entry point is `freeforge/index.html`                 | VERIFIED   | `Glob("freeforge.html")` returns no files. `test -f freeforge.html` exits non-zero.                                     |
| 2  | DOMPurify loads at 3.4.8 and marked.js loads at 18.0.4 each with matching SRI hash                    | VERIFIED   | `index.html` line 11: `marked@18.0.4/lib/marked.umd.js` with hash `sha384-8RA8...`. Line 14: `dompurify@3.4.8` with hash `sha384-jrsB...`. No old version strings remain. |
| 3  | A `<meta http-equiv="Content-Security-Policy">` tag is present restricting scripts, connections, objects | VERIFIED   | `index.html` lines 6-7: CSP meta tag with `default-src 'none'; script-src 'self' cdn.tailwindcss.com cdn.jsdelivr.net; worker-src cdn.tailwindcss.com blob:; connect-src https://openrouter.ai; style-src 'unsafe-inline'; object-src 'none'` |
| 4  | The `markdown.js` CDN-fail branch escapes text instead of returning raw HTML                           | VERIFIED   | `markdown.js` line 13: ternary else returns `esc(text).replace(/\n/g, '<br>')`. No `return raw` anywhere. `marked.use()` at module level (line 5), before export function (line 7). No `marked.setOptions` anywhere. |
| 5  | All `ff_key` localStorage reads/writes go through `getStoredKey()` / `setStoredKey()`; no direct calls in `onboarding.js`, `settings.js`, or `app.js` | VERIFIED   | Grep for `localStorage.*ff_key` across `freeforge/src/` returns only `state.js` lines 31 and 34 (inside the helper functions). `onboarding.js`, `settings.js`, and `app.js` all import and call the helpers. `LS.del('ff_key')` at `settings.js:53` correctly unchanged (removeItem, not setItem). |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact                                       | Expected                                           | Status     | Details                                                                                  |
|------------------------------------------------|----------------------------------------------------|------------|------------------------------------------------------------------------------------------|
| `freeforge.html` (root)                        | DELETED — must not exist                           | VERIFIED   | File absent from repository root. Glob confirms no match.                                |
| `freeforge/index.html`                         | Single entry point; marked@18.0.4, DOMPurify@3.4.8, CSP | VERIFIED | All three attributes present and correct. Old version strings absent.                    |
| `freeforge/src/markdown.js`                    | Safe renderer; `marked.use()` at module level; escape fallback | VERIFIED | 17-line file. `marked.use()` on line 5. Ternary else on line 13. Catch on line 15. Both fallbacks use `esc()`. |
| `freeforge/src/state.js`                       | Exports `getStoredKey()` and `setStoredKey(key)`   | VERIFIED   | Lines 30-35: both functions exported at top level with direct `localStorage` calls, no `LS.get/LS.set`. |
| `freeforge/src/features/onboarding.js`         | Uses `setStoredKey()` for ff_key write             | VERIFIED   | Line 1 imports `setStoredKey`. Line 22 calls `setStoredKey(key)`. No direct `localStorage.setItem('ff_key')`. |
| `freeforge/src/features/settings.js`           | Uses `setStoredKey()` for ff_key write             | VERIFIED   | Line 1 imports `setStoredKey`. Line 33 calls `setStoredKey(key)`. Line 53 `LS.del` intact. No direct `localStorage.setItem('ff_key')`. |
| `freeforge/src/app.js`                         | Uses `getStoredKey()` for ff_key read              | VERIFIED   | Line 1 imports `getStoredKey`. Line 11 calls `const savedKey = getStoredKey()`. No direct `localStorage.getItem('ff_key')`. |

### Key Link Verification

| From                                      | To                                              | Via                          | Status  | Details                                                       |
|-------------------------------------------|-------------------------------------------------|------------------------------|---------|---------------------------------------------------------------|
| `index.html script[src*=marked]`          | `cdn.jsdelivr.net/npm/marked@18.0.4/lib/marked.umd.js` | SRI-enforced script tag     | WIRED   | Line 11-13 in index.html; integrity hash present.             |
| `index.html script[src*=dompurify]`       | `cdn.jsdelivr.net/npm/dompurify@3.4.8/dist/purify.min.js` | SRI-enforced script tag   | WIRED   | Line 14-16 in index.html; integrity hash present.             |
| `index.html meta[http-equiv]`             | Browser CSP enforcement                         | Content-Security-Policy meta tag | WIRED | Lines 6-7; all required directives present.                   |
| `markdown.js renderMd()` fallback         | `esc(text).replace`                             | DOMPurify-unavailable branch | WIRED   | Line 13 ternary else; line 15 catch block. Both use `esc()`.  |
| `onboarding.js` import                    | `state.js setStoredKey export`                  | Named import                 | WIRED   | `import { S, $, setStoredKey } from '../state.js'` on line 1. |
| `settings.js` import                      | `state.js setStoredKey export`                  | Named import                 | WIRED   | `import { S, $, LS, maskKey, setStoredKey } from '../state.js'` on line 1. |
| `app.js` import                           | `state.js getStoredKey export`                  | Named import                 | WIRED   | `import { S, $, LS, getStoredKey } from './state.js'` on line 1. |

### Data-Flow Trace (Level 4)

Not applicable — this phase modifies entry point configuration, CDN library versions, a markdown utility, and localStorage accessor wiring. No new dynamic data rendering components were introduced.

### Behavioral Spot-Checks

| Behavior                                              | Command                                                                  | Result                           | Status |
|-------------------------------------------------------|--------------------------------------------------------------------------|----------------------------------|--------|
| freeforge.html absent                                 | `test -f freeforge.html`                                                 | exit non-zero; "DELETED" output  | PASS   |
| marked@18.0.4 in index.html                           | Grep `marked@18.0.4/lib/marked.umd.js` in index.html                    | 1 match on line 11               | PASS   |
| dompurify@3.4.8 in index.html                         | Grep `dompurify@3.4.8` in index.html                                     | 1 match on line 14               | PASS   |
| CSP meta tag present                                  | Grep `Content-Security-Policy` in index.html                             | 1 match on lines 6-7             | PASS   |
| No old version strings                                | Grep `marked@9.1.6\|dompurify@3.1.6\|marked.min.js` in index.html       | 0 matches                        | PASS   |
| marked.use() at module level before export            | Read markdown.js; line 5 vs line 7                                       | line 5 < line 7                  | PASS   |
| No marked.setOptions                                  | Grep `marked.setOptions` in src/                                         | 0 matches                        | PASS   |
| No `return raw` XSS vector                            | Grep `return raw` in markdown.js                                         | 0 matches                        | PASS   |
| esc(text) fallback appears twice                      | Read markdown.js lines 13 and 15                                         | 2 occurrences confirmed          | PASS   |
| getStoredKey / setStoredKey exported from state.js    | Read state.js lines 30-35                                                | Both exports present             | PASS   |
| No direct ff_key localStorage outside state.js        | Grep `localStorage.*ff_key` across src/                                  | Only state.js lines 31, 34       | PASS   |
| LS.del unchanged in settings.js                       | Grep `LS.del` in settings.js                                             | Line 53 intact                   | PASS   |

### Probe Execution

No probe scripts declared or present for this phase. Step 7c: SKIPPED (no probe-*.sh files found under scripts/).

### Requirements Coverage

| Requirement | Source Plan  | Description                                                      | Status    | Evidence                                                                  |
|-------------|-------------|------------------------------------------------------------------|-----------|---------------------------------------------------------------------------|
| SEC-01      | 01-01-PLAN  | Delete `freeforge.html` root entry point                         | SATISFIED | File absent from repository; Glob returns no match.                       |
| SEC-02      | 01-01-PLAN  | Upgrade DOMPurify 3.1.6 → 3.4.8 with SRI hash                   | SATISFIED | `index.html` line 14: `dompurify@3.4.8`, hash `sha384-jrsB...`.          |
| SEC-03      | 01-01-PLAN  | Upgrade marked.js 9.1.6 → 18.0.4 with SRI hash                  | SATISFIED | `index.html` line 11: `marked@18.0.4/lib/marked.umd.js`, hash `sha384-8RA8...`. |
| SEC-04      | 01-02-PLAN  | Fix markdown.js CDN-fail fallback (`return raw` → `esc(text)`)  | SATISFIED | `markdown.js` line 13: ternary else returns `esc(text).replace(...)`.     |
| SEC-05      | 01-01-PLAN  | Add CSP meta tag to `freeforge/index.html`                       | SATISFIED | `index.html` lines 6-7: CSP meta with all required directives. Note: implementation adds `'self'` to `script-src` (required for ES module) and `worker-src` (required for Tailwind JIT) versus the REQUIREMENTS.md spec — both additions are correct and necessary. |
| SEC-06      | 01-03-PLAN  | Centralise ff_key via `getStoredKey()` / `setStoredKey()`        | SATISFIED | `state.js` exports both; all three caller files updated; no direct calls outside state.js. |
| SEC-07      | 01-02-PLAN  | Move `marked.use()` to module initialization                     | SATISFIED | `markdown.js` line 5: `marked.use({ breaks: true, gfm: true })` before `export function renderMd` on line 7. |

All 7 SEC requirements for Phase 1 are satisfied.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (none) | — | — | — | — |

No debt markers (TBD, FIXME, XXX), placeholder strings, stub returns, or hardcoded empty data found in any file modified by this phase.

### Human Verification Required

#### 1. CSP Enforcement — No Runtime Violations

**Test:** Open `freeforge/index.html` in a browser (Chrome or Firefox) with DevTools open, Console tab visible. Load the page.
**Expected:** No Content Security Policy violation warnings or errors appear in the console. The app renders the onboarding screen normally.
**Why human:** CSP enforcement is a browser runtime behavior. Static analysis confirms the CSP string is syntactically correct and present, but cannot confirm that all loaded resources (Tailwind CDN JIT worker, ES module entry point `./src/app.js`, DOMPurify and marked from jsDelivr) actually satisfy the policy at runtime without any violations.

#### 2. API Key Persistence Round-Trip

**Test:** Open the app, enter a valid OpenRouter API key, click "Save & Connect". After successfully connecting, refresh the page.
**Expected:** The app skips the onboarding screen after refresh and goes directly to the chat screen, confirming `setStoredKey()` stored the key and `getStoredKey()` retrieved it correctly on reload.
**Why human:** `getStoredKey()` / `setStoredKey()` use raw `localStorage` calls (no JSON encoding), which is the correct behavior — but only a live browser round-trip confirms there is no double-encoding or key corruption at runtime. Static analysis verified the code path; this confirms actual storage behavior.

#### 3. CDN-Fail XSS Fallback Execution

**Test:** In DevTools Network tab, block `cdn.jsdelivr.net` (or disconnect network). Reload the app (it may error during load but the markdown module will initialize without DOMPurify). Trigger a scenario where a message is rendered containing `<script>alert(1)</script>` or `<img src=x onerror=alert(1)>`.
**Expected:** The dangerous HTML is rendered as visible escaped text characters, not executed. No alert fires. No raw HTML is injected into the DOM.
**Why human:** The CDN-fail code path (`typeof DOMPurify !== 'undefined'` evaluating to false) can only be truly exercised when DOMPurify fails to load. Static analysis confirms the code path returns `esc(text)` — this runtime test confirms the browser executes that path correctly under CDN failure conditions.

### Gaps Summary

No gaps found. All 5 ROADMAP success criteria are verified and all 7 SEC requirement IDs are satisfied by the codebase.

The three human verification items above are precautionary runtime confirmations of behavior that static analysis has already validated — they do not represent code defects. The CSP string is correct and present; the localStorage helpers are implemented correctly; the esc() fallback is in place. Human tests confirm browser runtime behavior matches the static code evidence.

---

_Verified: 2026-06-04T00:00:00Z_
_Verifier: Claude (gsd-verifier)_
