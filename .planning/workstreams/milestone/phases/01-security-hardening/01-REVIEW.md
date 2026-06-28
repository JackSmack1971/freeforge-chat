---
phase: 01-security-hardening
reviewed: 2026-06-04T23:25:00Z
depth: standard
files_reviewed: 6
files_reviewed_list:
  - freeforge/index.html
  - freeforge/src/app.js
  - freeforge/src/features/onboarding.js
  - freeforge/src/features/settings.js
  - freeforge/src/markdown.js
  - freeforge/src/state.js
findings:
  critical: 0
  warning: 2
  info: 2
  total: 4
status: issues_found
---

# Phase 01: Code Review Report

**Reviewed:** 2026-06-04T23:25:00Z
**Depth:** standard
**Files Reviewed:** 6
**Status:** issues_found

## Summary

Phase 01 hardening covers six files: CSP meta tag and CDN upgrades in `index.html`, module-level `marked.use()` and XSS fallback fix in `markdown.js`, new `getStoredKey`/`setStoredKey` helpers in `state.js`, and call-site migration in `app.js`, `onboarding.js`, and `settings.js`.

The SRI hashes for both marked@18.0.4 and DOMPurify@3.4.8 were verified against the live jsDelivr content via `curl | openssl dgst -sha384` — both match. The `getStoredKey`/`setStoredKey` design is correct: raw string storage avoids the double-JSON-encoding that `LS.get`/`LS.set` would cause, and the migration is internally consistent (no pre-existing users with the old JSON-encoded format, since `freeforge.html` was untracked).

Two warnings were found: a behavioral inconsistency in `settings.js` where an empty-models result is silently treated as success (unlike the same check in `onboarding.js`), and a missing `base-uri` CSP directive that leaves a minor defense-in-depth gap. Two informational items round out the review.

No critical/blocker issues were found.

---

## Warnings

### WR-01: `settings.js` `updateKey()` silently accepts a valid key that returns zero free models

**File:** `freeforge/src/features/settings.js:30-40`
**Issue:** `onboarding.js` line 19 explicitly guards against an empty models list and shows an error to the user before saving the key. `updateKey()` in `settings.js` contains no equivalent guard. If a user enters a key that authenticates successfully but has no free-tier models, `updateKey()` saves the key, sets `S.models = []`, calls `populateModelsFromState()` (which renders "No free models" in the dropdown), and toasts "API key updated!" — leaving the app in a state where the key is persisted but no models are available to select. The next fresh load via `init()` will succeed (key exists), but the user will be stuck at a "No free models" dropdown with no actionable feedback.

**Fix:** Mirror the guard from `onboarding.js`:
```js
// settings.js — inside updateKey(), after fetchFreeModels succeeds
const models = await fetchFreeModels(key);
if (!models.length) {
  const err = $('settings-key-error');
  err.textContent = 'No free models found for this key';
  err.classList.remove('hidden');
  return;
}
S.apiKey = key;
S.models = models;
setStoredKey(key);
```

---

### WR-02: CSP meta tag is missing `base-uri` directive

**File:** `freeforge/index.html:6-7`
**Issue:** The CSP does not include a `base-uri` directive. Without it, the default is `base-uri *`, meaning an attacker who can inject a `<base href="https://evil.example/">` tag into the document (e.g., via a stored XSS in rendered markdown before DOMPurify runs, or via a browser extension) could redirect all relative-URL script and resource loads to an attacker-controlled origin. In this application the risk vector is narrow (DOMPurify is present), but defense-in-depth practice requires locking down `base-uri`.

**Fix:** Add `base-uri 'self'` (or `base-uri 'none'` since the app uses no `<base>` tag):
```html
content="default-src 'none'; base-uri 'none'; script-src 'self' cdn.tailwindcss.com cdn.jsdelivr.net; worker-src cdn.tailwindcss.com blob:; connect-src https://openrouter.ai; style-src 'unsafe-inline'; object-src 'none'"
```

---

## Info

### IN-01: Tailwind CDN in `script-src` is not hash-pinned — represents an unmitigated supply-chain risk

**File:** `freeforge/index.html:9-10`
**Issue:** The comment acknowledges that `cdn.tailwindcss.com` cannot have a static SRI hash because it is a dynamic JIT loader. As a consequence, any JavaScript served from that domain — including a compromised or malicious version — would be unconditionally trusted by the browser and executed with full access to the DOM and the API key in `localStorage`. This is an accepted design trade-off for a CDN-first single-file app, but it should be a conscious documented risk rather than a silently accepted one.

**Fix:** No code change required unless `cdn.tailwindcss.com` is replaced with a self-hosted or fixed-version build. Consider adding a comment in the HTML or a note in `ROADMAP.md` that switching to a self-hosted Tailwind build in a future phase would eliminate this trust surface.

---

### IN-02: `renderAllMessages()` called in `onboarding.js` `validateAndConnect()` without a `scrollBottom()` call

**File:** `freeforge/src/features/onboarding.js:25`
**Issue:** After a successful first-time connect, `validateAndConnect()` calls `renderAllMessages()` (which renders any previously loaded messages from `S.messages`) but does not call `scrollBottom()`. By contrast, the equivalent path in `init()` (`app.js:22`) does call `scrollBottom(false)` after `renderAllMessages()`. In practice `S.messages` is always empty for first-time onboarding, so this has no observable impact — but the divergence is a latent bug if the call order ever changes.

**Fix:** Add `scrollBottom(false)` after `renderAllMessages()` in `validateAndConnect()`, and import `scrollBottom` from `../ui/messages.js`:
```js
// onboarding.js
import { renderAllMessages, scrollBottom } from '../ui/messages.js';

// inside validateAndConnect try block, after renderAllMessages():
renderAllMessages();
scrollBottom(false);
populateModelsFromState();
```

---

_Reviewed: 2026-06-04T23:25:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
