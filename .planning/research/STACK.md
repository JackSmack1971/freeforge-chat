# Security Stack — FreeForge XSS Prevention & Hardening

**Project:** FreeForge (vanilla ES-module browser chat)
**Dimension:** Security & XSS Prevention
**Researched:** 2026-06-04
**Overall confidence:** HIGH (all claims verified against official sources or live CDN)

---

## Findings Summary

The codebase has a working security foundation in `freeforge/index.html` but contains five
distinct security gaps that a reviewer would flag, two of which are critical. The root entry
point `freeforge.html` is a standalone copy that has zero sanitization of AI output — a direct
XSS vector. The module-based entry point has DOMPurify wired correctly but uses an outdated
version that is affected by CVE-2025-26791. Neither entry point has a Content Security Policy.

---

## Security Issues — Severity-Ranked

### CRITICAL-1: freeforge.html has no DOMPurify — unsanitized innerHTML injection

**File:** `freeforge.html` lines 450–458 (`renderMd` function inside the inline `<script>`)

**What the code does:**
```javascript
function renderMd(text) {
  if (!text) return '';
  try {
    marked.setOptions({ breaks: true, gfm: true });
    return marked.parse(text);   // raw HTML, no sanitization
  } catch {
    return esc(text).replace(/\n/g, '<br>');
  }
}
```

That raw return value is then written to the DOM via `wrap.innerHTML = ... ${content} ...` at
line 521. Any LLM response containing `<script>`, `<img onerror="...">`, `javascript:` hrefs,
or mutation-XSS payloads will execute in the user's browser.

**Severity:** CRITICAL

**Fix:** Mirror the module entry point's guard exactly:
```javascript
function renderMd(text) {
  if (!text) return '';
  try {
    marked.setOptions({ breaks: true, gfm: true });
    const raw = marked.parse(text);
    return typeof DOMPurify !== 'undefined'
      ? DOMPurify.sanitize(raw, PURIFY_CONFIG)
      : esc(text).replace(/\n/g, '<br>');  // safe fallback, not raw HTML
  } catch {
    return esc(text).replace(/\n/g, '<br>');
  }
}
```

And add the DOMPurify `<script>` tag to `freeforge.html` head (see SRI values below).

---

### CRITICAL-2: DOMPurify version 3.1.6 is affected by CVE-2025-26791

**File:** `freeforge/index.html` line 11–14, `freeforge.html` (if DOMPurify is added)

**Vulnerability:** CVE-2025-26791 — DOMPurify < 3.2.4 has an incorrect template literal
regular expression (the `TMPLIT_EXPR` regex matched `/${[\w\W]}/gm` but the closing brace
was optional in practice, allowing a bypass). An attacker can craft a payload that passes
through DOMPurify unmodified when `SAFE_FOR_TEMPLATES` is set, or in certain custom element
scenarios. The fix changes the regex to `/${[\w\W]/gm`.

**Current app hash (3.1.6):**
```
sha384-+VfUPEb0PdtChMwmBcBmykRMDd+v6D/oFmB3rZM/puCMDYcIvF968OimRh4KQY9a
```
This version is vulnerable. The app does not set `SAFE_FOR_TEMPLATES`, which reduces (but does
not eliminate) risk. Upgrading is still mandatory.

**Severity:** HIGH (CVE-2025-26791, published Feb 2025)

**Fix:** Upgrade to 3.4.8 (latest stable as of June 2026, verified via jsDelivr API).

**Verified SRI hash for DOMPurify 3.4.8 (sha384, computed from live CDN):**
```
sha384-jrsBdrv4eDpEYIq32u13DPbvB6tRmqIDnA6UlgFBoexpetaiWi7g/VbfMEL1WVen
```

**Replacement `<script>` tag:**
```html
<script src="https://cdn.jsdelivr.net/npm/dompurify@3.4.8/dist/purify.min.js"
        integrity="sha384-jrsBdrv4eDpEYIq32u13DPbvB6tRmqIDnA6UlgFBoexpetaiWi7g/VbfMEL1WVen"
        crossorigin="anonymous"></script>
```

---

### HIGH-1: DOMPurify fallback silently renders unsanitized HTML

**File:** `freeforge/src/markdown.js` lines 9–11

**Current code:**
```javascript
return typeof DOMPurify !== 'undefined' ? DOMPurify.sanitize(raw) : raw;
//                                                                    ^^^
//                                                         raw HTML injected if CDN fails
```

If the jsDelivr CDN request for DOMPurify fails (network error, CDN outage, CSP block), the
guard falls through and `raw` — unprocessed marked.js output — is assigned to `innerHTML`.
This creates a window where an LLM response containing XSS payloads will execute.

**Severity:** HIGH

**Fix:** Return escaped plaintext instead of raw HTML when DOMPurify is unavailable:
```javascript
// freeforge/src/markdown.js
import { esc } from './state.js';

const PURIFY_CONFIG = {
  USE_PROFILES: { html: true },
  FORBID_TAGS: ['style', 'script'],
  FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover'],
};

export function renderMd(text) {
  if (!text) return '';
  try {
    marked.use({ breaks: true, gfm: true });    // marked.use() preferred over setOptions
    const raw = marked.parse(text);
    if (typeof DOMPurify === 'undefined') {
      // CDN failed — degrade gracefully, never inject raw HTML
      console.warn('[FreeForge] DOMPurify not loaded; rendering as plaintext');
      return `<pre class="text-sm text-zinc-300 whitespace-pre-wrap">${esc(text)}</pre>`;
    }
    return DOMPurify.sanitize(raw, PURIFY_CONFIG);
  } catch {
    return esc(text).replace(/\n/g, '<br>');
  }
}
```

---

### HIGH-2: No Content Security Policy on either entry point

**Files:** `freeforge/index.html`, `freeforge.html`

**Current state:** Neither file has a `<meta http-equiv="Content-Security-Policy">` tag.
Without CSP, DOMPurify is the only XSS defence. A DOMPurify bypass (like CVE-2025-26791)
gives an attacker direct script execution. CSP provides defence in depth.

**Severity:** HIGH (for a public portfolio app that handles user API keys)

**Constraint:** This app loads from `file://` or static hosting with no server. The
`Content-Security-Policy` HTTP header is not settable. A `<meta>` tag is the only option.

**CSP meta tag limitations vs HTTP header:**
The spec (CSP Level 3) prohibits the following directives in `<meta>` tags: `frame-ancestors`,
`report-uri`, `sandbox`, and `report-to`. All other directives including `script-src`,
`style-src`, `connect-src`, `img-src`, `default-src` are fully supported in meta tags.

**Recommended concrete CSP for this app:**

```html
<meta http-equiv="Content-Security-Policy" content="
  default-src 'none';
  script-src 'self' https://cdn.tailwindcss.com https://cdn.jsdelivr.net 'sha384-odPBjvtXVM/5hOYIr3A1dB+flh0c3wAT3bSesIOqEGmyUA4JoKf/YTWy0XKOYAY7' 'sha384-jrsBdrv4eDpEYIq32u13DPbvB6tRmqIDnA6UlgFBoexpetaiWi7g/VbfMEL1WVen';
  style-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com;
  connect-src https://openrouter.ai;
  img-src 'self' data:;
  font-src 'self';
  object-src 'none';
  base-uri 'self';
  form-action 'none';
">
```

**Directive-by-directive rationale:**

| Directive | Value | Reason |
|-----------|-------|--------|
| `default-src 'none'` | none | Deny everything not explicitly allowed |
| `script-src 'self'` | self | Allow ES module imports from same origin |
| `script-src cdn.tailwindcss.com` | CDN host | Tailwind Play CDN is a JS file |
| `script-src cdn.jsdelivr.net` | CDN host | marked.js + DOMPurify |
| `script-src sha384-...` hashes | inline hash | Inline `<script>` polyfill block in freeforge.html only |
| `style-src 'unsafe-inline'` | required | Tailwind CDN injects `<style>` tags at runtime; unavoidable with Play CDN |
| `connect-src openrouter.ai` | API origin | All fetch() calls go to openrouter.ai only |
| `img-src 'self' data:` | self + data | DOMPurify may allow `<img>` tags; data: needed for inline images in markdown |
| `object-src 'none'` | none | Flash/plugin execution blocked |
| `base-uri 'self'` | self | Prevents `<base>` tag injection attacks |
| `form-action 'none'` | none | No forms submit anywhere |

**Important caveat on `style-src 'unsafe-inline'`:** The Tailwind Play CDN (`cdn.tailwindcss.com`)
is a runtime JavaScript JIT compiler that injects `<style>` blocks dynamically. There is no nonce
or hash mechanism available for these dynamic injections. `'unsafe-inline'` for styles is therefore
unavoidable when using the Play CDN. This is a known limitation documented by the Tailwind
maintainers (GitHub discussion #13326). The `'unsafe-inline'` in `style-src` does NOT weaken
script execution protection — it only affects stylesheet injection.

**Tailwind CDN and `'unsafe-inline'` for scripts:** `cdn.tailwindcss.com` is a JavaScript file
that executes at runtime. It is listed in `script-src` as a trusted origin. It does NOT require
`'unsafe-inline'` in `script-src`.

**Note on `strict-dynamic`:** `'strict-dynamic'` (CSP Level 3) allows trusted scripts to
dynamically load additional scripts without listing their URLs. It is NOT recommended here because
`cdn.tailwindcss.com` is already explicitly trusted, and `strict-dynamic` would additionally
require a nonce or hash on every `<script>` tag, which is impractical for static HTML without
a build step.

---

### MEDIUM-1: marked.setOptions is the deprecated API; use marked.use()

**File:** `freeforge/src/markdown.js` line 6, `freeforge.html` line 453

**Current code:**
```javascript
marked.setOptions({ breaks: true, gfm: true });
```

`marked.setOptions()` was deprecated in favour of `marked.use()` starting from the v5 era.
In marked v9.1.6 (current in app) it still works, and in v18.0.4 (latest) it is still present
and functional. However, `marked.use()` is the documented, forward-compatible API. Calling
`marked.setOptions()` inside `renderMd()` on every call is also wasteful — it mutates global
state on every render.

**Severity:** MEDIUM (works today, is a code quality / future-compat issue)

**Fix:** Move configuration to module initialization, use `marked.use()`:
```javascript
// At module top level, not inside renderMd()
marked.use({ breaks: true, gfm: true });

export function renderMd(text) { /* no setOptions call here */ }
```

---

### MEDIUM-2: localStorage stores API key in plaintext with inconsistent access patterns

**Files:** `freeforge/src/features/onboarding.js` line 22, `freeforge/src/features/settings.js`
line 33, `freeforge/src/app.js` line 11

**The inconsistency:**

```javascript
// onboarding.js line 22 — bypasses LS wrapper
localStorage.setItem('ff_key', key);

// settings.js line 33 — bypasses LS wrapper
localStorage.setItem('ff_key', key);

// app.js line 11 — bypasses LS wrapper
const savedKey = localStorage.getItem('ff_key');

// state.js — LS wrapper exists but is NOT used for ff_key writes
export const LS = {
  get(k) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
```

Note: The LS wrapper JSON-serializes values (`JSON.stringify`), which means `LS.get('ff_key')`
would return the key wrapped in quotes if `LS.set` were used. The direct calls are actually
intentional to avoid this, but this creates an undocumented inconsistency that will confuse
anyone attempting to centralize storage.

**The real security limitation:**
`localStorage` is accessible to any JavaScript running on the same origin. If an XSS exploit
bypasses DOMPurify, the first thing it would do is `localStorage.getItem('ff_key')` and
exfiltrate the API key. This is the primary threat model.

**What can actually be done in a no-server, client-only app:**

| Option | Realistic for this app | Protection level |
|--------|----------------------|-----------------|
| `localStorage` (current) | Yes | None against XSS |
| `sessionStorage` | Yes | Clears on tab close; same XSS risk |
| `HttpOnly` cookie | No (requires server) | Protected from JS reads |
| Web Crypto encrypted storage | Possible but complex | Protects at rest, not against live XSS |
| IndexedDB | Same origin risk as localStorage | Same as localStorage vs XSS |

**Honest assessment:** For a client-only app with no server, there is no storage mechanism
that protects an API key from a live XSS attack. The correct mitigation is to prevent XSS
entirely — via DOMPurify, CSP, and the fallback enforcement described above. `localStorage`
is acceptable given those controls are in place.

**What should be fixed regardless:**
1. Route all `ff_key` reads through a single function so future changes (e.g., obfuscation,
   migration) don't silently miss callsites. Create a dedicated accessor in `state.js`:

```javascript
// state.js — add these two functions
export function getStoredKey() {
  try { return localStorage.getItem('ff_key'); } catch { return null; }
}
export function setStoredKey(key) {
  try { localStorage.setItem('ff_key', key); } catch {}
}
```

2. Replace all three direct callsites with `getStoredKey()` / `setStoredKey(key)`.

**Severity:** MEDIUM (the inconsistency is the issue; the plaintext storage itself is a
known, accepted limitation of client-only apps with user-held credentials)

---

### LOW-1: SRI hash on marked@9.1.6 is correct — but version is nine major versions old

**File:** `freeforge/index.html` line 9–10, `freeforge.html` line 9–10

**Current hash verification result (computed live):**
```
sha384-odPBjvtXVM/5hOYIr3A1dB+flh0c3wAT3bSesIOqEGmyUA4JoKf/YTWy0XKOYAY7  ✓ MATCHES
```

The existing SRI hash is correct and the file is untampered on jsDelivr. Marked v9.1.6 does
NOT have known XSS vulnerabilities — the `sanitize` option was already removed in v8.0.0.
The library has no security-relevant known issues in v9.1.6.

The latest marked version is 18.0.4. The v9.1.6 → v18.x jump is large but the API for basic
usage (`marked.parse()`, `marked.use()`, `marked.setOptions()`) is backward compatible.
`setOptions()` is still present in v18.0.4 (confirmed by source inspection).

**Severity:** LOW (no security bug, version currency only)

**SRI hash for marked@18.0.4 UMD build (computed live):**
```
sha384-8RA8Ah4c9upJmKfg5nH01OgjZoQ3mRX+ngrKYWXQYj2dHYxFqYz8POSlii33f0wB
```

**CDN URL for latest:**
```html
<script src="https://cdn.jsdelivr.net/npm/marked@18.0.4/lib/marked.umd.js"
        integrity="sha384-8RA8Ah4c9upJmKfg5nH01OgjZoQ3mRX+ngrKYWXQYj2dHYxFqYz8POSlii33f0wB"
        crossorigin="anonymous"></script>
```

**Recommendation:** Update to 18.0.4 in the same pass as the DOMPurify upgrade. The
API surface used by this app (`marked.parse()`, `marked.use()`, `marked.setOptions()`) is
unchanged.

---

### LOW-2: cdn.tailwindcss.com cannot have an SRI hash and is a supply chain risk

**Files:** `freeforge/index.html` line 7–8, `freeforge.html` line 7–8

**The comment in the code is correct:**
```html
<!-- cdn.tailwindcss.com is a dynamic JIT loader; SRI is not applicable (content varies per request) -->
```

`cdn.tailwindcss.com` serves dynamically generated JavaScript — its content changes based on
which classes are used, and varies per request. SRI requires a stable hash. These are
incompatible. jsDelivr's own documentation confirms SRI should not be used with dynamic files.

**The actual risk:** Any compromise of `cdn.tailwindcss.com` would inject arbitrary JavaScript
into all users' browsers. The Tailwind maintainers have stated the Play CDN is "safe in a
security sense" but explicitly not recommended for production due to performance. For a
portfolio project deployed publicly, this is a real supply chain risk.

**Mitigation options (in priority order):**

Option A — Accept the risk with CSP mitigation (minimum viable):
- Add `https://cdn.tailwindcss.com` to `script-src` in the CSP (already shown above)
- This restricts which CDNs can load scripts but still trusts cdn.tailwindcss.com fully

Option B — Replace with prebuilt CSS (removes risk entirely, preferred for production):
- Run `npx tailwindcss -i input.css -o freeforge/styles/tailwind.css --minify`
- Replace the CDN `<script>` with `<link rel="stylesheet" href="styles/tailwind.css">`
- Add `<link>` SRI: `integrity="sha384-[computed hash]" crossorigin="anonymous"`
- This allows `script-src` to drop `cdn.tailwindcss.com` entirely
- This also removes the need for `'unsafe-inline'` in `style-src`
- **Trade-off:** Requires a one-time build step and a `package.json` / `node_modules`, which
  conflicts with the "zero-dependency" design philosophy

**Project fit:** Given the "no build step" constraint is core to this project's identity,
Option A (CSP + documented risk) is the pragmatic choice. Add a comment in the HTML noting
the known limitation and that the app's XSS protection relies on DOMPurify + CSP connect-src.

**Severity:** LOW (acknowledged in code; mitigated by CSP in script-src)

---

## DOMPurify Configuration — Recommended Config Object

```javascript
// Paste into freeforge/src/markdown.js and freeforge.html renderMd function
const PURIFY_CONFIG = {
  // Use the standard HTML profile (allows most formatting tags)
  USE_PROFILES: { html: true },
  // Block style tags entirely — they can be used for CSS injection
  FORBID_TAGS: ['style'],
  // Block all event handlers and navigation-hijacking attributes
  FORBID_ATTR: [
    'onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur',
    'onchange', 'onsubmit', 'onkeydown', 'onkeyup', 'onkeypress',
  ],
  // Keep <a> links but sanitize href values (DOMPurify removes javascript: by default)
  // Keep <img> but DOMPurify strips src="javascript:" automatically
  // ALLOW_DATA_ATTR: false  // Uncomment if you want to block data-* attributes too
};
```

**Why not use a restrictive allowlist instead?**
An allowlist like `ALLOWED_TAGS: ['p', 'b', 'i', 'code', 'pre', 'ul', 'ol', 'li', 'a',
'h1', 'h2', 'h3', 'blockquote', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'br', 'hr',
'strong', 'em']` is more secure but risks stripping legitimate markdown output (e.g., `<del>`,
`<ins>`, `<details>`, `<summary>`). The `USE_PROFILES: { html: true }` approach is less
restrictive but keeps the full markdown rendering intact. For an AI chat app where rendering
quality matters, the deny-list approach is the right balance.

**The "sanitize-then-modify" trap:** DOMPurify's documentation warns that if you sanitize
HTML and then modify it afterwards, you may void the sanitization. This app does not do this
— `renderMd()` assigns the sanitized string directly to `innerHTML`. Do not add any
post-sanitization string manipulation to this output.

---

## marked.js + DOMPurify Integration Pattern — 2025 Best Practice

The `sanitize` option in marked.js was removed in v8.0.0. The current recommended pattern
(documented at marked.js.org) is to call DOMPurify on the `marked.parse()` output:

```javascript
// CORRECT pattern (what freeforge/src/markdown.js already does — keep this)
const raw = marked.parse(text);
const clean = DOMPurify.sanitize(raw, PURIFY_CONFIG);
element.innerHTML = clean;
```

There is no "sanitizer hook" in marked.js v9 or v18 that intercepts during parse. Post-render
sanitization via DOMPurify is the only correct integration.

The `walkTokens` hook in marked.js is a token-level processing hook for custom extensions
(e.g., syntax highlighting). It is not a security mechanism and should not be used as a
substitute for DOMPurify.

---

## SRI Hash Summary Table

| Library | Version | CDN URL | SHA-384 Hash | Verified |
|---------|---------|---------|--------------|---------|
| DOMPurify | 3.1.6 (current, vulnerable) | `cdn.jsdelivr.net/npm/dompurify@3.1.6/dist/purify.min.js` | `sha384-+VfUPEb0PdtChMwmBcBmykRMDd+v6D/oFmB3rZM/puCMDYcIvF968OimRh4KQY9a` | YES — matches |
| DOMPurify | 3.4.8 (upgrade target) | `cdn.jsdelivr.net/npm/dompurify@3.4.8/dist/purify.min.js` | `sha384-jrsBdrv4eDpEYIq32u13DPbvB6tRmqIDnA6UlgFBoexpetaiWi7g/VbfMEL1WVen` | YES — computed live |
| marked.js | 9.1.6 (current) | `cdn.jsdelivr.net/npm/marked@9.1.6/marked.min.js` | `sha384-odPBjvtXVM/5hOYIr3A1dB+flh0c3wAT3bSesIOqEGmyUA4JoKf/YTWy0XKOYAY7` | YES — matches |
| marked.js | 18.0.4 (upgrade target) | `cdn.jsdelivr.net/npm/marked@18.0.4/lib/marked.umd.js` | `sha384-8RA8Ah4c9upJmKfg5nH01OgjZoQ3mRX+ngrKYWXQYj2dHYxFqYz8POSlii33f0wB` | YES — computed live |
| Tailwind CDN | dynamic | `cdn.tailwindcss.com` | N/A — content varies per request | N/A |

**How to re-verify any hash:**
```bash
curl -s "https://cdn.jsdelivr.net/npm/PACKAGE@VERSION/PATH" \
  | openssl dgst -sha384 -binary \
  | openssl base64 -A
```
Prepend `sha384-` to the output and compare to the `integrity` attribute.

---

## What a Security Reviewer Would Flag — In Priority Order

1. **`freeforge.html` renderMd has no DOMPurify call at all.** Any LLM response with
   `<img src=x onerror=alert(1)>` executes immediately. This is the most urgent fix.

2. **DOMPurify 3.1.6 is affected by CVE-2025-26791.** Upgrade to 3.4.8.

3. **`renderMd` fallback path in `markdown.js` injects raw HTML if CDN fails.** Change
   the fallback to return escaped plaintext.

4. **No CSP on either entry point.** Add the meta tag shown above. Without CSP,
   DOMPurify is the only barrier; a single bypass has no backstop.

5. **`localStorage.setItem('ff_key', key)` called directly in three places** (onboarding.js
   line 22, settings.js line 33, app.js line 11) instead of through a unified accessor.
   Not an immediate security risk but creates maintenance debt.

6. **`freeforge.html` contains a full inline `<script>` block** while `freeforge/index.html`
   uses ES modules. The inline script block is harder to apply CSP to (requires computing
   its SHA-256 hash and adding it to `script-src`). Consolidating the two entry points
   (QUAL-03) also resolves this.

7. **`uid()` uses `Math.random()`** — acceptable for DOM element IDs, not for any future
   security-sensitive use. Replace with `crypto.randomUUID()` as a zero-cost improvement.

---

## localStorage Security — Authoritative Position

For a client-only app that holds user-provided API keys:

- `localStorage` is not inherently "insecure" for credentials that the user knowingly
  provides and that are only used from that same origin.
- The threat model is: XSS → JavaScript reads localStorage → key exfiltrated.
- The defence is: prevent XSS (DOMPurify + CSP), not better storage.
- `sessionStorage` has the same XSS exposure as `localStorage`; it only helps against
  key persistence after tab close, which is not a meaningful improvement for a chat app
  where the user expects persistence.
- `IndexedDB` has the same origin-based XSS exposure.
- `HttpOnly` cookies cannot be set without a server — not applicable here.
- The app's existing note "Your key stays in your browser only" is accurate. Adding a
  note that the key is stored in plain text (not encrypted) would be complete disclosure
  if desired for portfolio transparency.

**Recommendation:** Keep `localStorage`, centralise access through `getStoredKey()` /
`setStoredKey()` helpers, and ensure DOMPurify + CSP are in place as the primary defence.

---

## Implementation Checklist (for QUAL-04)

- [ ] Upgrade DOMPurify to 3.4.8 in both HTML files (new SRI hash above)
- [ ] Add DOMPurify `<script>` tag to `freeforge.html` head
- [ ] Fix `renderMd` fallback in `freeforge/src/markdown.js` to return plaintext not raw HTML
- [ ] Fix `renderMd` in `freeforge.html` inline script to call DOMPurify with `PURIFY_CONFIG`
- [ ] Add PURIFY_CONFIG object to both locations (module file + inline script)
- [ ] Add `<meta http-equiv="Content-Security-Policy">` tag to both HTML files
- [ ] Replace `marked.setOptions()` call with `marked.use()` at module top level
- [ ] Add `getStoredKey()` / `setStoredKey()` to `state.js` and replace 3 direct callsites
- [ ] Upgrade marked to 18.0.4 (optional but recommended; update SRI hash)
- [ ] Verify SRI hashes after any CDN version change using the openssl command above

---

## Sources

- DOMPurify README & configuration reference: https://github.com/cure53/DOMPurify
- CVE-2025-26791 detail: https://nvd.nist.gov/vuln/detail/CVE-2025-26791
- CVE-2025-26791 analysis (mXSS details): https://www.cve.news/cve-2025-26791/
- Snyk DOMPurify vulnerability record: https://security.snyk.io/vuln/SNYK-JS-DOMPURIFY-8722251
- DOMPurify 3.4.8 on npm: https://www.npmjs.com/package/dompurify
- marked.js security model (sanitize removal in v8): https://marked.js.org/using_advanced
- marked.js marked.use() API: https://marked.js.org/using_advanced
- Subresource Integrity (MDN): https://developer.mozilla.org/en-US/docs/Web/Security/Subresource_Integrity
- jsDelivr SRI guidance: https://www.jsdelivr.com/using-sri-with-dynamic-files
- CSP quick reference: https://content-security-policy.com/
- Tailwind Play CDN production use: https://github.com/tailwindlabs/tailwindcss/discussions/7637
- Tailwind CSP nonce discussion: https://github.com/tailwindlabs/tailwindcss/discussions/13326
- localStorage vs alternatives: https://medium.com/@stanislavbabenko/just-stop-using-localstorage-for-secrets-honestly-ea9ef9af9022
- SRI hash generator reference: https://srihash.org/
- jsDelivr package API (used for live hash verification): https://data.jsdelivr.com/v1/packages/npm/dompurify@3.4.8
