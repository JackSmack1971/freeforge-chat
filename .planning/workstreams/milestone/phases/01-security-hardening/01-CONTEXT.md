# Phase 1: Security Hardening - Context

**Gathered:** 2026-06-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Eliminate the disqualifying issues a security-conscious portfolio reviewer would find: delete the unprotected root entry point, upgrade two CVE-affected CDN libraries to patched versions with updated SRI hashes, add a Content Security Policy, fix the XSS-permitting CDN-fail fallback in `markdown.js`, and centralize all API key localStorage access through typed helpers in `state.js`.

The phase DOES NOT include: accessibility fixes, mobile UX changes, code architecture refactors (those are Phases 2–4), or any new feature work.

</domain>

<decisions>
## Implementation Decisions

### CSP Meta Tag (extends SEC-05)

- **D-01:** Add `'self'` to `script-src` — required for the ES module entry point `<script type="module" src="./src/app.js">` to load. Without it the app fails to start.
- **D-02:** Add `worker-src cdn.tailwindcss.com blob:` to the CSP — Tailwind Play CDN compiles classes in a Web Worker created from a blob: URL; without this directive `default-src 'none'` blocks the worker and styles fail silently.
- **D-03:** Final CSP string (replaces the one in REQUIREMENTS.md SEC-05):
  ```
  default-src 'none'; script-src 'self' cdn.tailwindcss.com cdn.jsdelivr.net; worker-src cdn.tailwindcss.com blob:; connect-src https://openrouter.ai; style-src 'unsafe-inline'; object-src 'none'
  ```

### marked.js v18 Upgrade (SEC-03, SEC-07)

- **D-04:** Use the UMD build from jsDelivr (`marked.min.js`) — same classic `<script>` tag pattern as today; no importmap or type=module change needed.
- **D-05:** Verification is a visual browser check — open the app, send a message with code blocks, a table, and multi-line text; if it renders correctly the upgrade is accepted. No automated HTML diff required.

### API Key Storage Helpers (SEC-06)

- **D-06:** Expose as standalone exported functions in `state.js`:
  ```js
  export function getStoredKey() { ... }
  export function setStoredKey(key) { ... }
  ```
  Not as methods on the `LS` object. Callers add the names to their `import { ... } from '../state.js'` line.
- **D-07:** Centralize **both reads and writes** — `app.js`'s `localStorage.getItem('ff_key')` (a read) also becomes `getStoredKey()`, matching the ROADMAP success criteria ("all reads and writes go through getStoredKey/setStoredKey"). Files affected: `onboarding.js`, `settings.js`, `app.js`.

### Claude's Discretion

No areas where implementation is left fully open — all decisions were locked above or are precisely specified in REQUIREMENTS.md.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Roadmap
- `.planning/ROADMAP.md` — Phase 1 goal, success criteria (5 items), list of requirements SEC-01..SEC-07
- `.planning/REQUIREMENTS.md` — Full precise specs for SEC-01 through SEC-07 including exact code changes, version numbers, SRI hash notes

### Target Files for This Phase
- `freeforge/index.html` — Receives: CSP meta tag (D-01, D-02, D-03), DOMPurify upgrade to 3.4.8 (SEC-02), marked.js upgrade to 18.0.4 (SEC-03), SRI hash updates
- `freeforge/src/markdown.js` — Receives: CDN-fail fallback fix (SEC-04), `marked.use()` migration (SEC-07)
- `freeforge/src/state.js` — Receives: new `getStoredKey()` / `setStoredKey()` exports (SEC-06, D-06)
- `freeforge/src/features/onboarding.js` — Direct `localStorage.setItem('ff_key')` on line 22 → replace with `setStoredKey(key)` (SEC-06, D-07)
- `freeforge/src/features/settings.js` — Direct `localStorage.setItem('ff_key')` on line 33 → replace with `setStoredKey(key)` (SEC-06, D-07)
- `freeforge/src/app.js` — Direct `localStorage.getItem('ff_key')` on line 11 → replace with `getStoredKey()` (SEC-06, D-07)
- `freeforge.html` (root) — To be deleted (SEC-01); exists as untracked file in the current working tree

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `state.js` `LS` object — `getStoredKey`/`setStoredKey` will be peer-level named exports (not methods on LS). They internally call `localStorage.getItem/setItem('ff_key')` directly (not through LS.get/LS.set, since LS wraps values in JSON.stringify — the key should be stored raw).
- `state.js` `esc()` utility — already exported; used in the SEC-04 CDN-fail fallback fix.

### Established Patterns
- Script loading order in `index.html`: Tailwind → marked → DOMPurify → app.css → module entry point. Upgrade SRI hashes for marked and DOMPurify in that order.
- `LS.get` wraps values with `JSON.parse` — API keys are stored as raw strings, so `getStoredKey`/`setStoredKey` MUST NOT route through `LS.get`/`LS.set` (that would double-encode the string).

### Integration Points
- After adding `getStoredKey`/`setStoredKey` to `state.js`, each caller file adds both names to its existing `import { S, $, ... } from '../state.js'` import.
- `markdown.js` imports `esc` from `state.js` — SEC-04's fallback `return esc(text).replace(/\n/g, '<br>')` already uses the imported `esc`, no new import needed.

</code_context>

<specifics>
## Specific Ideas

- SRI hash acquisition: researcher should compute/verify hashes for DOMPurify@3.4.8 and marked@18.0.4 from jsDelivr at plan time (not left as a TODO). jsDelivr exposes an integrity field via its API: `https://data.jsdelivr.com/v1/packages/npm/<pkg>@<ver>/flat` — the `files[].hash.integrity` field contains the SHA-384.
- The CSP in D-03 supersedes the one in REQUIREMENTS.md SEC-05 — planner should use D-03 verbatim.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 1-Security Hardening*
*Context gathered: 2026-06-04*
