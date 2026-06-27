# Phase 1: Security Hardening - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-04
**Phase:** 1-Security Hardening
**Areas discussed:** CSP + Tailwind CDN risk, marked.js v9→v18 jump, getStoredKey/setStoredKey shape

---

## CSP + Tailwind CDN Risk

### Q1: How should the missing worker-src be handled?

| Option | Description | Selected |
|--------|-------------|----------|
| Add worker-src to CSP | Add `worker-src cdn.tailwindcss.com blob:` — stays within spirit of spec | ✓ |
| Implement as specified, test manually | Add CSP exactly per SEC-05, fix after if Tailwind breaks | |
| Switch to local Tailwind build | Replace CDN with locally-built app.css — eliminates conflict entirely, adds build step | |

**User's choice:** Add worker-src to CSP
**Notes:** Proactively handles the Tailwind Play CDN's Web Worker requirement rather than discovering it at test time.

---

### Q2: Should blob: workers be permitted?

| Option | Description | Selected |
|--------|-------------|----------|
| worker-src cdn.tailwindcss.com blob: | Permits blob: Worker URLs (what Tailwind Play CDN uses internally) | ✓ |
| worker-src 'self' cdn.tailwindcss.com | Slightly more permissive — also allows any self-origin worker | |
| Investigate before deciding | Let researcher confirm Tailwind worker creation mechanism first | |

**User's choice:** `worker-src cdn.tailwindcss.com blob:`
**Notes:** blob: workers are same-origin by definition; blast radius is contained.

---

### Q3: Should 'self' be included in script-src?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — add 'self' to script-src | Required for ES module entry point `<script type="module" src="./src/app.js">` | ✓ |
| Use a nonce instead of 'self' | Stricter but requires nonce generation at serve time — impractical for static file | |

**User's choice:** Add `'self'` to script-src
**Notes:** Without 'self', the app's own ES module script is blocked and the app fails to start.

---

## marked.js v9→v18 Jump

### Q1: How should the upgrade be verified?

| Option | Description | Selected |
|--------|-------------|----------|
| Visual check in the browser | Open app, send markdown with code/table/linebreaks, confirm rendering | ✓ |
| Diff rendered HTML on sample markdown | Run both versions on test markdown, compare output — more rigorous, needs Node script | |
| Trust the spec | breaks: true and gfm: true are explicit; minor drift is acceptable | |

**User's choice:** Visual check in the browser is sufficient
**Notes:** No automated diff needed for this portfolio project.

---

### Q2: UMD build vs ESM import?

| Option | Description | Selected |
|--------|-------------|----------|
| UMD build from jsDelivr (same pattern) | marked.min.js exposes window.marked — same script tag, new version | ✓ |
| Switch to ESM import in markdown.js | Import from CDN URL in ES module — cleaner architecture, requires more changes | |

**User's choice:** Use UMD build from jsDelivr
**Notes:** Minimal change to load pattern; only version and SRI hash change.

---

## getStoredKey/setStoredKey Shape

### Q1: How should ff_key helpers be exposed?

| Option | Description | Selected |
|--------|-------------|----------|
| Standalone exports in state.js | `export function getStoredKey()` / `export function setStoredKey(key)` | ✓ |
| Methods on the LS object | LS.getKey() / LS.setKey(key) — consistent with LS.get/LS.set pattern | |
| Named constant wrapping LS | `export const keyStore = { get, set }` — one import, adds indirection | |

**User's choice:** Standalone exports in state.js
**Notes:** Matches REQUIREMENTS.md wording exactly. Callers add names to existing import lines.

---

### Q2: Centralize reads AND writes, or only writes?

| Option | Description | Selected |
|--------|-------------|----------|
| Centralize reads AND writes | app.js getItem also becomes getStoredKey() — matches ROADMAP success criteria | ✓ |
| Only replace the three setItem writes | app.js keeps bare localStorage.getItem — fewer changes but incomplete per success criteria | |

**User's choice:** Centralize both reads and writes
**Notes:** ROADMAP success criteria says "all reads and writes go through getStoredKey/setStoredKey" — the more complete interpretation.

---

## Claude's Discretion

No areas deferred to Claude's discretion — all decisions were made by the user.

## Deferred Ideas

None — discussion stayed within Phase 1 scope.
