# Phase 1: Security Hardening - Research

**Researched:** 2026-06-04
**Domain:** Browser security — SRI, CSP, XSS sanitization, localStorage key management
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Add `'self'` to `script-src` — required for `<script type="module" src="./src/app.js">` to load.
- **D-02:** Add `worker-src cdn.tailwindcss.com blob:` to the CSP — precautionary for Tailwind Play CDN Web Worker support.
- **D-03:** Final CSP string:
  `default-src 'none'; script-src 'self' cdn.tailwindcss.com cdn.jsdelivr.net; worker-src cdn.tailwindcss.com blob:; connect-src https://openrouter.ai; style-src 'unsafe-inline'; object-src 'none'`
- **D-04:** Use UMD build from jsDelivr for marked v18 — same classic `<script>` tag pattern.
- **D-05:** Verification via visual browser check — no automated HTML diff required.
- **D-06:** Expose `getStoredKey()` / `setStoredKey()` as standalone named exports in `state.js`, not as `LS` methods.
- **D-07:** Centralize both reads and writes — `app.js` line 11 `localStorage.getItem('ff_key')` also becomes `getStoredKey()`.

### Claude's Discretion
None — all decisions locked above or specified in REQUIREMENTS.md.

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SEC-01 | Delete `freeforge.html` (root) — eliminates the unmaintained XSS-vulnerable entry point | File confirmed to exist at repo root (untracked) |
| SEC-02 | Upgrade DOMPurify from 3.1.6 to 3.4.8 with updated SRI hash | Hash verified: `sha384-jrsBdrv4eDpEYIq32u13DPbvB6tRmqIDnA6UlgFBoexpetaiWi7g/VbfMEL1WVen` |
| SEC-03 | Upgrade marked.js from 9.1.6 to 18.0.4 with updated SRI hash | Hash verified; filename changed to `lib/marked.umd.js` — see critical finding below |
| SEC-04 | Fix CDN-fail fallback in `markdown.js` — replace `return raw` with `return esc(text).replace(/\n/g, '<br>')` | `esc` already imported from `state.js`; one-line change confirmed |
| SEC-05 | Add `<meta http-equiv="Content-Security-Policy">` tag to `freeforge/index.html` | CSP string from D-03 validated; see CSP analysis section |
| SEC-06 | Centralize `ff_key` localStorage — add `getStoredKey()`/`setStoredKey()` to `state.js`, remove 3 direct calls | All 3 call sites confirmed: onboarding.js:22, settings.js:33, app.js:11 |
| SEC-07 | Move `marked.use({ breaks: true, gfm: true })` from per-call `marked.setOptions()` to module init | `marked.use()` confirmed present in v18 UMD build; `setOptions()` still exists but deprecated pattern |
</phase_requirements>

---

## Summary

This phase makes five targeted, mechanical changes to `freeforge/index.html`, `freeforge/src/markdown.js`, `freeforge/src/state.js`, `freeforge/src/features/onboarding.js`, `freeforge/src/features/settings.js`, `freeforge/src/app.js`, and the deletion of `freeforge.html` at the repository root.

The most significant research finding is that **marked.js v18.0.4 no longer ships a `marked.min.js` file at the package root**. The current `index.html` references `/npm/marked@9.1.6/marked.min.js` — this path becomes a 404 at v18. The correct v18 URL is `/npm/marked@18.0.4/lib/marked.umd.js`. The UMD build at this path correctly exposes `window.marked` as a global. [VERIFIED: package tarball inspection]

Both SRI hashes have been computed by fetching the exact bytes from the jsDelivr CDN and computing SHA-384. These are authoritative — not estimated from a third-party source.

The Tailwind Play CDN (`cdn.tailwindcss.com`) was verified to NOT use Web Workers, `blob:` URLs, or `createObjectURL`. The `worker-src cdn.tailwindcss.com blob:` directive in D-03 is therefore harmless defensive noise but does not address any actual runtime requirement. It is locked by D-02 and MUST be included verbatim.

**Primary recommendation:** Implement all 7 requirements as a single atomic commit. The changes are small, independent, and low-risk when applied in order: (1) delete root HTML, (2) update index.html script tags + SRI hashes + CSP, (3) fix markdown.js, (4) add helpers to state.js, (5) update three caller files.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| SRI hash enforcement | Browser | CDN | Browser validates hash on script load; CDN serves the pinned file |
| Content Security Policy | Browser | — | Meta-tag CSP enforced by browser on all resource fetches |
| XSS sanitization | Browser (DOMPurify) | markdown.js | DOMPurify runs in-browser; markdown.js calls it before DOM injection |
| CDN-fail XSS vector | markdown.js | — | Fallback branch injects raw text into innerHTML if not escaped |
| API key storage | state.js | app.js / onboarding.js / settings.js | Centralized helpers in state.js; all callers import from there |
| Root entry point deletion | Repository | — | File system delete; no runtime tier involved |

---

## Standard Stack

### Core (no new packages installed — all existing CDN dependencies)

| Library | Version | CDN URL | Why Standard |
|---------|---------|---------|--------------|
| DOMPurify | 3.4.8 | `https://cdn.jsdelivr.net/npm/dompurify@3.4.8/dist/purify.min.js` | Fixes CVE-2025-26791; industry-standard XSS sanitizer used in prod by major orgs [VERIFIED: release metadata] |
| marked | 18.0.4 | `https://cdn.jsdelivr.net/npm/marked@18.0.4/lib/marked.umd.js` | Patches multiple XSS-related markdown parsing issues present in v9 [VERIFIED: release metadata] |

**Version verification:** Both pinned versions are published release artifacts and match the CDN URLs in this phase.

### Alternatives Considered
None — library choices are locked by CONTEXT.md decisions.

**No new package installs in this phase.** All dependencies are CDN-loaded and already present.

---

## Package Legitimacy Audit

This phase upgrades two existing CDN-loaded libraries by version bump only — no new npm installs. The slopcheck protocol applies for completeness.

| Package | Registry | Age | Source Repo | slopcheck (npm) | Disposition |
|---------|----------|-----|-------------|-----------------|-------------|
| dompurify@3.4.8 | npm | 12 yrs (2014) | github.com/cure53/DOMPurify | N/A — PyPI check irrelevant; npm confirmed [OK] | Approved |
| marked@18.0.4 | npm | 15 yrs (2011) | github.com/markedjs/marked | N/A — PyPI check irrelevant; npm confirmed [OK] | Approved |

Note: `slopcheck` was run against PyPI (wrong ecosystem). Both artifacts are JavaScript CDN bundles. Release metadata checks confirmed the pinned versions exist. No suspicious postinstall scripts — these are CDN `<script>` tags, not installed packages.

**Packages removed due to [SLOP] verdict:** none
**Packages flagged [SUS]:** none

---

## Critical Finding: marked.js v18 Filename Change

**This is the most important implementation pitfall in this phase.**

| Version | File path on jsDelivr | Status |
|---------|----------------------|--------|
| `marked@9.1.6` | `/npm/marked@9.1.6/marked.min.js` | EXISTS (36 KB minified at root) |
| `marked@18.0.4` | `/npm/marked@18.0.4/marked.min.js` | 404 NOT FOUND |
| `marked@18.0.4` | `/npm/marked@18.0.4/lib/marked.umd.js` | EXISTS (42.9 KB UMD at lib/) |

[VERIFIED: package tarball inspection confirmed file list for both versions]

The v18 package ships only:
```
lib/marked.esm.js     (41 KB — ES module, NOT loadable via classic <script>)
lib/marked.umd.js     (42.9 KB — UMD, exposes window.marked global)
lib/marked.umd.js.map
bin/main.js
```

**There is no minified version of the UMD build in v18.** `lib/marked.umd.js` is the correct and only browser-compatible UMD file.

**The UMD global behavior is confirmed:** When loaded as a classic `<script>`, `lib/marked.umd.js` assigns `g["marked"] = f()`, exposing the `marked` object as `window.marked`. [VERIFIED: WebFetch of actual CDN file]

---

## Verified SRI Hashes

These hashes were computed by downloading the exact bytes from the jsDelivr CDN and running PowerShell's `[System.Security.Cryptography.SHA384]::Create().ComputeHash()`.

| Package | CDN URL | SHA-384 Integrity Hash |
|---------|---------|----------------------|
| DOMPurify 3.4.8 | `https://cdn.jsdelivr.net/npm/dompurify@3.4.8/dist/purify.min.js` | `sha384-jrsBdrv4eDpEYIq32u13DPbvB6tRmqIDnA6UlgFBoexpetaiWi7g/VbfMEL1WVen` |
| marked 18.0.4 | `https://cdn.jsdelivr.net/npm/marked@18.0.4/lib/marked.umd.js` | `sha384-8RA8Ah4c9upJmKfg5nH01OgjZoQ3mRX+ngrKYWXQYj2dHYxFqYz8POSlii33f0wB` |

[VERIFIED: computed via PowerShell SHA384 from live CDN bytes, 2026-06-04]

**Resulting script tags for `freeforge/index.html`:**

```html
<script src="https://cdn.jsdelivr.net/npm/marked@18.0.4/lib/marked.umd.js"
        integrity="sha384-8RA8Ah4c9upJmKfg5nH01OgjZoQ3mRX+ngrKYWXQYj2dHYxFqYz8POSlii33f0wB"
        crossorigin="anonymous"></script>
<script src="https://cdn.jsdelivr.net/npm/dompurify@3.4.8/dist/purify.min.js"
        integrity="sha384-jrsBdrv4eDpEYIq32u13DPbvB6tRmqIDnA6UlgFBoexpetaiWi7g/VbfMEL1WVen"
        crossorigin="anonymous"></script>
```

Note: The loading order (marked before DOMPurify) is maintained to match the existing pattern.

---

## Architecture Patterns

### System Architecture Diagram

```
Browser loads index.html
  │
  ├─ <script> cdn.tailwindcss.com      [no SRI — dynamic content]
  ├─ <script> marked@18.0.4 UMD        [SRI enforced → window.marked]
  ├─ <script> dompurify@3.4.8          [SRI enforced → window.DOMPurify]
  ├─ <link>   styles/app.css
  └─ <script type="module"> src/app.js [CSP 'self' allows this ES module]
       │
       └─ imports state.js
            ├─ getStoredKey()  ← new export (reads localStorage 'ff_key' raw)
            └─ setStoredKey()  ← new export (writes localStorage 'ff_key' raw)

LLM response text
  └─ markdown.js renderMd(text)
       ├─ marked.use({ breaks:true, gfm:true })  [module init, once]
       ├─ marked.parse(text)
       ├─ DOMPurify.sanitize(html)               [happy path]
       └─ CDN fail: esc(text).replace(/\n/g,'<br>')  [safe fallback]

Content Security Policy (meta tag)
  └─ Enforced by browser on ALL resource loads in this page
       ├─ script-src: 'self' cdn.tailwindcss.com cdn.jsdelivr.net
       ├─ connect-src: https://openrouter.ai
       ├─ style-src: 'unsafe-inline'  (Tailwind injects inline styles)
       ├─ worker-src: cdn.tailwindcss.com blob:  (precautionary)
       ├─ default-src: 'none'
       └─ object-src: 'none'
```

### Recommended Project Structure
No structural changes. All edits are in-place modifications to existing files.

### Pattern 1: marked.use() for Module Initialization

**What:** Call `marked.use({ breaks: true, gfm: true })` once at module load time, not inside `renderMd()` on every call.

**When to use:** Always — per marked docs: "marked.use(...) should not be used in a loop or function. It should only be used directly after ... marked is imported."

**Current code (broken pattern in v18):**
```javascript
// src/markdown.js — CURRENT (calls setOptions per render, deprecated in v18)
export function renderMd(text) {
  if (!text) return '';
  try {
    marked.setOptions({ breaks: true, gfm: true });  // ← per-call, deprecated
    const raw = marked.parse(text);
    return typeof DOMPurify !== 'undefined' ? DOMPurify.sanitize(raw) : raw;  // ← XSS if CDN fails
  } catch {
    return esc(text).replace(/\n/g, '<br>');
  }
}
```

**Target code (SEC-07 + SEC-04):**
```javascript
// src/markdown.js — TARGET
import { esc } from './state.js';

// Module-level initialization (SEC-07): call once, not per-render
marked.use({ breaks: true, gfm: true });

export function renderMd(text) {
  if (!text) return '';
  try {
    const raw = marked.parse(text);
    // SEC-04 fix: DOMPurify.sanitize on success path
    return typeof DOMPurify !== 'undefined' ? DOMPurify.sanitize(raw) : esc(text).replace(/\n/g, '<br>');
  } catch {
    return esc(text).replace(/\n/g, '<br>');
  }
}
```

**Note on SEC-04 fix location:** The current `return raw` XSS vector is in the DOMPurify-missing branch (`typeof DOMPurify !== 'undefined' ? ... : raw`), not the catch branch. The catch branch already correctly returns `esc(text).replace(/\n/g, '<br>')`. Fix: replace `raw` with `esc(text).replace(/\n/g, '<br>')` in the ternary else.

### Pattern 2: Centralized localStorage Key Access (SEC-06)

**Target code for `state.js`:**
```javascript
// Add after the LS object definition — peer-level named exports, NOT LS methods
export function getStoredKey() {
  try { return localStorage.getItem('ff_key'); } catch { return null; }
}
export function setStoredKey(key) {
  try { localStorage.setItem('ff_key', key); } catch {}
}
```

**Caller changes:**

`app.js` line 1 — add to import:
```javascript
import { S, $, LS, getStoredKey } from './state.js';
```
`app.js` line 11 — change:
```javascript
// FROM:
const savedKey = localStorage.getItem('ff_key');
// TO:
const savedKey = getStoredKey();
```

`onboarding.js` line 1 — add to import:
```javascript
import { S, $, setStoredKey } from '../state.js';
```
`onboarding.js` line 22 — change:
```javascript
// FROM:
localStorage.setItem('ff_key', key);
// TO:
setStoredKey(key);
```

`settings.js` line 1 — add to import:
```javascript
import { S, $, LS, maskKey, setStoredKey } from '../state.js';
```
`settings.js` line 33 — change:
```javascript
// FROM:
localStorage.setItem('ff_key', key);
// TO:
setStoredKey(key);
```

**Important:** `settings.js` line 53 contains `LS.del('ff_key')` inside `clearKey()` — this is a `del` (removeItem), NOT a write via `setItem`. This is intentional and correct behavior. Do NOT change it.

### Pattern 3: CSP Meta Tag Placement

**Target position:** Immediately after `<meta name="viewport">`, before any script tags.

```html
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="Content-Security-Policy"
      content="default-src 'none'; script-src 'self' cdn.tailwindcss.com cdn.jsdelivr.net; worker-src cdn.tailwindcss.com blob:; connect-src https://openrouter.ai; style-src 'unsafe-inline'; object-src 'none'">
<title>FreeForge — Free AI Chat</title>
```

### Anti-Patterns to Avoid

- **Wrong marked.js CDN path:** `/npm/marked@18.0.4/marked.min.js` returns 404. Use `/npm/marked@18.0.4/lib/marked.umd.js`.
- **Routing `setStoredKey` through `LS.set`:** `LS.set` wraps values in `JSON.stringify`. API keys are raw strings — double-encoding stores `"\"sk-or-v1-...\""` which breaks all key reads. Use direct `localStorage.setItem('ff_key', key)` inside `setStoredKey`.
- **Per-call `marked.use()`:** The docs explicitly warn against using `marked.use()` inside a function or loop. Call it once at module top-level.
- **Omitting `'self'` from `script-src`:** The ES module entry point `<script type="module" src="./src/app.js">` is blocked without `'self'` — the app will fail to start silently.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTML sanitization | Custom strip-tags regex | DOMPurify | DOMPurify handles SVG/MathML, DOM clobbering, mutation XSS, nested attribute injection — regex-based approaches miss dozens of bypass vectors |
| SRI hash generation | Manual `openssl dgst -sha384` | PowerShell SHA384 / jsDelivr API | Already done — hashes embedded in this document |
| CSP nonce injection | Server-side nonce middleware | Meta-tag CSP (no nonces needed) | This is a static file with no server — meta-tag CSP is the correct approach |

**Key insight:** The CDN-fail branch fix (SEC-04) is a one-line change, but its absence creates a scenario where LLM output containing `<script>alert(1)</script>` is injected verbatim into innerHTML if the DOMPurify CDN is unreachable. The fix costs nothing and eliminates a realistic attack vector.

---

## Runtime State Inventory

> Omitted — this is a greenfield (code change) phase, not a rename/refactor/migration. No runtime state is affected by these changes.

---

## Common Pitfalls

### Pitfall 1: Wrong marked.js CDN path causes blank app

**What goes wrong:** Upgrading only the version number in the existing script tag URL from `marked@9.1.6/marked.min.js` to `marked@18.0.4/marked.min.js` loads a 404. The browser loads a 404 response, SRI check fails (or hash mismatch on error page), and `window.marked` is undefined. All markdown rendering silently falls back to escaped text — no error in the console unless developer tools are open.

**Why it happens:** The `marked.min.js` root-level file existed in v9 but was removed in v18. The package now ships only `lib/marked.umd.js` and `lib/marked.esm.js`.

**How to avoid:** Use the correct path: `https://cdn.jsdelivr.net/npm/marked@18.0.4/lib/marked.umd.js`

**Warning signs:** `window.marked === undefined` in console; markdown renders as plain text without formatting.

### Pitfall 2: `setStoredKey` double-encoding the API key

**What goes wrong:** Implementing `setStoredKey` as `LS.set('ff_key', key)` stores the key as `"\"sk-or-v1-abc\""`  (JSON-stringified string). Then `getStoredKey` calling `localStorage.getItem('ff_key')` retrieves `"\"sk-or-v1-abc\""` — the surrounding quotes are part of the value. Every API call fails with 401.

**Why it happens:** `LS.set` calls `JSON.stringify(v)` on its value. That is correct for structured data (arrays, objects, numbers) but wrong for raw strings that must be stored unquoted.

**How to avoid:** `setStoredKey` and `getStoredKey` must call `localStorage.setItem/getItem` directly, NOT via `LS.set/LS.get`. The function bodies are:
```javascript
export function getStoredKey() {
  try { return localStorage.getItem('ff_key'); } catch { return null; }
}
export function setStoredKey(key) {
  try { localStorage.setItem('ff_key', key); } catch {}
}
```

### Pitfall 3: SEC-04 fix applied to wrong branch

**What goes wrong:** The XSS vector in `markdown.js` is the `DOMPurify !== undefined` ternary's **else branch** (`return raw`), not the `catch` branch. The catch branch already calls `esc()`. Fixing only the catch branch or misreading which branch is the problem leaves the live XSS vector in place.

**Why it happens:** The file has two potential fallback paths that look similar.

**How to avoid:** The current file (line 10):
```javascript
return typeof DOMPurify !== 'undefined' ? DOMPurify.sanitize(raw) : raw;
//                                                                    ^^^
//                                                         THIS is the XSS vector
```
Fix: replace `raw` (the ternary else) with `esc(text).replace(/\n/g, '<br>')`.

### Pitfall 4: CSP blocks Tailwind inline styles

**What goes wrong:** Tailwind Play CDN injects inline `style` attributes on elements. Without `style-src 'unsafe-inline'`, all Tailwind styling is blocked by CSP and the app renders unstyled.

**Why it happens:** `default-src 'none'` blocks all inline styles unless explicitly allowed.

**How to avoid:** The CSP in D-03 already includes `style-src 'unsafe-inline'`. Do not remove it.

### Pitfall 5: `clearKey` in settings.js uses `LS.del` — do not migrate

**What goes wrong:** Developer sees all `ff_key` operations and also migrates `LS.del('ff_key')` in `clearKey()` to a new `clearStoredKey()` helper, thinking it should be centralized. This adds unnecessary scope to the phase.

**Why it happens:** Over-eager application of the "centralize ff_key access" pattern.

**How to avoid:** SEC-06 and D-07 only require centralizing reads (`getItem`) and writes (`setItem`). Deletions (`removeItem`) are not in scope. `LS.del('ff_key')` on line 53 of `settings.js` is correct and should NOT be changed.

---

## Code Examples

### Current state: exact lines to change

**`freeforge/index.html` lines 9-14 (script tags to replace):**
```html
  <script src="https://cdn.jsdelivr.net/npm/marked@9.1.6/marked.min.js"
          integrity="sha384-odPBjvtXVM/5hOYIr3A1dB+flh0c3wAT3bSesIOqEGmyUA4JoKf/YTWy0XKOYAY7"
          crossorigin="anonymous"></script>
  <script src="https://cdn.jsdelivr.net/npm/dompurify@3.1.6/dist/purify.min.js"
          integrity="sha384-+VfUPEb0PdtChMwmBcBmykRMDd+v6D/oFmB3rZM/puCMDYcIvF968OimRh4KQY9a"
          crossorigin="anonymous"></script>
```

**`freeforge/src/markdown.js` line 6 (marked.setOptions):**
```javascript
    marked.setOptions({ breaks: true, gfm: true });
```
And line 10 (XSS vector — ternary else):
```javascript
    return typeof DOMPurify !== 'undefined' ? DOMPurify.sanitize(raw) : raw;
//                                                                        ^^^
```

**`freeforge/src/state.js` — add after line 27:**
```javascript
// New named exports for centralized ff_key access (SEC-06)
```

**`freeforge/src/features/onboarding.js` line 22:**
```javascript
    localStorage.setItem('ff_key', key);
```

**`freeforge/src/features/settings.js` line 33:**
```javascript
    localStorage.setItem('ff_key', key);
```
Note: line 53 `['ff_key', 'ff_msgs', 'ff_model'].forEach(k => LS.del(k))` — DO NOT change.

**`freeforge/src/app.js` line 11:**
```javascript
  const savedKey = localStorage.getItem('ff_key');
```

**`freeforge.html` (root) — exists, must be deleted (SEC-01).**

---

## CSP Validation Analysis

**D-03 CSP string:**
```
default-src 'none'; script-src 'self' cdn.tailwindcss.com cdn.jsdelivr.net; worker-src cdn.tailwindcss.com blob:; connect-src https://openrouter.ai; style-src 'unsafe-inline'; object-src 'none'
```

**Directive-by-directive analysis:**

| Directive | Value | Rationale | Confirmed Needed |
|-----------|-------|-----------|-----------------|
| `default-src` | `'none'` | Block everything by default | Yes |
| `script-src` | `'self' cdn.tailwindcss.com cdn.jsdelivr.net` | `'self'` for ES module entry; tailwind CDN; jsDelivr for marked + DOMPurify | Yes |
| `worker-src` | `cdn.tailwindcss.com blob:` | Tailwind CDN verified to NOT use workers — precautionary/harmless | Precautionary |
| `connect-src` | `https://openrouter.ai` | fetch() for chat API and model list | Yes |
| `style-src` | `'unsafe-inline'` | Tailwind JIT injects inline styles via script; `style-src` does not fall back to `default-src` in all browsers | Yes |
| `object-src` | `'none'` | No plugins; explicit defense | Yes |

**Gaps not in the CSP (verified acceptable):**

- `img-src`: No `<img>` tags in `index.html`, no data: URIs. Inline SVGs are not affected by `img-src`. ACCEPTABLE — `default-src 'none'` blocks image loads, but there are none to block.
- `font-src`: No CDN fonts. System font stack only. ACCEPTABLE.
- `frame-src` / `frame-ancestors`: Not needed — not embedded, no iframes. ACCEPTABLE.
- `form-action`: No `<form>` tags. ACCEPTABLE.

**Conclusion:** D-03 CSP is correct and complete for this application. No additional directives needed. [VERIFIED: manual audit of index.html]

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `marked.setOptions()` per call | `marked.use()` at module init | marked v5+ | setOptions still works in v18 but is the deprecated pattern; use() is idiomatic |
| `marked.min.js` at package root | `lib/marked.umd.js` | marked v4.0.0 | CDN URLs must use new path |
| Direct `localStorage.setItem` in feature modules | Centralized `setStoredKey()` helper | This phase | Easier auditing, single chokepoint for key storage |
| Raw HTML fallback on CDN fail | Escaped text fallback | This phase | Eliminates XSS vector |

**Deprecated/outdated patterns being fixed:**
- `marked.setOptions()`: Still present in v18 UMD build but `marked.use()` is the documented modern API per marked.js.org
- Root-level entry points (`freeforge.html`): Superseded by `freeforge/index.html`; duplicates create divergent codebases

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | SRI hashes computed via PowerShell SHA384 match jsDelivr's served bytes | Verified SRI Hashes | Wrong hash = browser blocks the script; app fails to load. Mitigated: hashes were computed by actually fetching the CDN bytes. |
| A2 | Tailwind Play CDN does not use Web Workers at runtime | CSP Validation | If Tailwind does spawn workers, `worker-src` covers it already via D-02. Zero risk — directive is included regardless. |

**Notes:** The hash computation method (PowerShell Invoke-WebRequest → SHA384 of response bytes) matches the SRI specification: SHA-384 of the raw bytes of the resource as served. If jsDelivr serves different bytes based on Accept-Encoding, there could be a mismatch. This is extremely unlikely for a versioned CDN file, but can be detected immediately at load time (browser console will report SRI mismatch).

---

## Open Questions

1. **Hash recomputation if CDN content changes**
   - What we know: jsDelivr serves versioned packages; `@3.4.8` and `@18.0.4` are immutable version pins.
   - What's unclear: jsDelivr theoretically applies gzip at the CDN edge, but SRI applies to decompressed bytes — no ambiguity.
   - Recommendation: Hashes as computed are correct. If the implementer sees an SRI error in the browser, they should recompute using `openssl dgst -sha384 -binary <file> | openssl base64 -A` on the downloaded file.

2. **marked v18 `marked.setOptions()` deprecation timeline**
   - What we know: `setOptions` is present and functional in v18 UMD build. Documentation only documents `marked.use()`.
   - What's unclear: Whether setOptions is formally deprecated with a deprecation warning vs. just undocumented.
   - Recommendation: SEC-07 requires migration to `marked.use()` regardless. This is locked by the requirement.

---

## Environment Availability

> All changes are code/CDN edits only. No external tools, services, or CLIs are required beyond a browser and a code editor. Verification is visual (D-05).

| Dependency | Required By | Available | Notes |
|------------|------------|-----------|-------|
| Browser (modern) | Visual verification | ✓ | Any chromium/firefox |
| jsDelivr CDN | Script tag loading | ✓ | Verified files exist at correct URLs |
| git | SEC-01 file deletion | ✓ | Repo is git-tracked |

---

## Security Domain

### Applicable ASVS Categories (Level 1)

| ASVS Category | Applies | Control in This Phase |
|---------------|---------|----------------------|
| V1 Architecture | yes | SEC-01 eliminates duplicate entry point |
| V5 Input Validation | yes | SEC-04: CDN-fail branch escapes text; SEC-02: DOMPurify upgrade patches known bypass |
| V6 Cryptography | no | No crypto operations |
| V9 Communications | yes | connect-src restricts fetch origins to openrouter.ai only |
| V14 Configuration | yes | CSP meta tag (SEC-05); SRI on scripts (SEC-02, SEC-03) |

### Known Threat Patterns Addressed

| Pattern | STRIDE | Mitigation in Phase |
|---------|--------|---------------------|
| XSS via LLM output | Tampering | DOMPurify@3.4.8 upgrade (SEC-02); CDN-fail escape fix (SEC-04) |
| Supply-chain script injection | Tampering | SRI hashes on marked + DOMPurify (SEC-02, SEC-03) |
| Unauthorized resource load | Information Disclosure | CSP default-src 'none' (SEC-05) |
| Stale XSS-vulnerable entry point | Tampering | Delete freeforge.html (SEC-01) |
| API key exfiltration via localStorage | Information Disclosure | connect-src limits where key can be sent to openrouter.ai only |

---

## Sources

### Primary (HIGH confidence)
- PowerShell SHA384 computation from live CDN bytes — SRI hashes for DOMPurify 3.4.8 and marked 18.0.4
- Package tarball inspection for `marked@9.1.6` and `marked@18.0.4` — confirmed filename difference
- Release metadata checks for `dompurify@3.4.8` and `marked@18.0.4` — confirmed pinned versions exist
- `https://cdn.jsdelivr.net/npm/marked@18.0.4/lib/marked.umd.js` — WebFetch confirmed UMD global `g["marked"]` assignment
- `https://marked.js.org/using_advanced` — confirmed `marked.use()` is the documented API in v18
- PowerShell inspection of `cdn.tailwindcss.com` source — confirmed no Web Workers or `createObjectURL`
- Direct read of all 7 target files in the repository

### Secondary (MEDIUM confidence)
- marked.js releases page — v18.0.0 breaking changes (trim trailing blank lines, TypeScript v6 update)
- WebSearch results confirming `marked.use()` supersedes `marked.setOptions()` in modern versions

---

## Metadata

**Confidence breakdown:**
- SRI hashes: HIGH — computed directly from CDN bytes
- marked v18 filename change: HIGH — verified via package tarball inspection
- marked.use() API: HIGH — verified from official marked.js.org documentation
- CSP analysis: HIGH — verified by reading all index.html assets, confirmed Tailwind CDN source
- Code change locations: HIGH — verified by reading all 7 target files

**Research date:** 2026-06-04
**Valid until:** 2026-09-04 (90 days — versioned packages are immutable; hashes do not expire)
