# Research Summary — FreeForge Quality Pass

**Project:** FreeForge (vanilla JS browser chat app)
**Domain:** Brownfield quality pass — functional to portfolio-quality
**Researched:** 2026-06-04
**Confidence:** HIGH (all findings from direct codebase inspection + verified external sources)

---

## Executive Summary

FreeForge is a working, architecturally sound vanilla ES-module chat app. The gap between "functional" and "portfolio-quality" is tractable: two categories of issues exist — a small number of critical security and correctness bugs that stop a reviewer immediately, and a larger surface of accessibility, mobile UX, and code hygiene gaps that collectively drag the impression of craft.

Security must come first: two issues (missing DOMPurify on root HTML, CVE-affected library version) are disqualifying in a portfolio context. Accessibility is second: 23 discrete WCAG 2.1 AA gaps including unlabeled inputs, no modal focus trap, and no screen reader announcements for streaming. Mobile UX and code quality are the third tier.

The main risk is the two diverged entry points (`freeforge.html` root vs `freeforge/index.html`). Delete the root file first. Every fix would otherwise need to be applied twice.

---

## Critical Issues — Ranked by Severity

| # | Issue | File(s) | Why It Disqualifies |
|---|-------|---------|---------------------|
| C1 | `freeforge.html` has no DOMPurify — `renderMd` injects raw `marked.parse()` output into `innerHTML` | `freeforge.html:450` | Any LLM response with `<img onerror=...>` executes immediately. Direct XSS. |
| C2 | DOMPurify 3.1.6 is affected by CVE-2025-26791 (mXSS via template literal) | `freeforge/index.html:13` | Public CVE visible in the pinned version. |
| C3 | `markdown.js` CDN-fail fallback returns raw unsanitized HTML | `freeforge/src/markdown.js:8` | `typeof DOMPurify !== 'undefined' ? DOMPurify.sanitize(raw) : raw` — the `: raw` branch is unescaped. |
| C4 | No Content Security Policy on either entry point | Both HTML files | No second line of XSS defence. |
| C5 | Settings modal has no `role="dialog"`, no focus trap, no `aria-modal` | `freeforge/index.html` | Screen reader tabs out of modal; WCAG 2.1.2 failure. |
| C6 | `<label>` elements have no `for` attribute — inputs are unlabeled for AT | `freeforge/index.html` | Screen reader announces nothing on input focus. WCAG 1.3.1 critical. |
| C7 | No `aria-live` regions — entire streaming chat is silent to screen readers | `index.html`, `chat.js` | WCAG 4.1.3 critical. |
| C8 | Raw `localStorage.setItem('ff_key')` without try/catch in Safari Private | `onboarding.js:22`, `settings.js:33` | Safari Private throws `SecurityError` — app crashes after successful key validation. |

---

## Key Stack Decisions

**Keep:** Vanilla ES modules, no build step, Tailwind Play CDN, OpenRouter API, localStorage.

**Upgrade (same CDN, new SRI):**

| Library | Current | Upgrade To | sha384 SRI |
|---------|---------|-----------|-----------|
| DOMPurify | 3.1.6 | 3.4.8 | `sha384-jrsBdrv4eDpEYIq32u13DPbvB6tRmqIDnA6UlgFBoexpetaiWi7g/VbfMEL1WVen` |
| marked.js | 9.1.6 | 18.0.4 | `sha384-8RA8Ah4c9upJmKfg5nH01OgjZoQ3mRX+ngrKYWXQYj2dHYxFqYz8POSlii33f0wB` |

**Add:** CSP `<meta>` tag; `getStoredKey()` / `setStoredKey()` helpers in `state.js`.

**Consolidate:** Delete `freeforge.html` (root). Canonical entry is `freeforge/index.html`.

---

## Quality Dimensions

### Security
- Root file: zero sanitization (critical)
- Module entry: DOMPurify present but CVE-affected version
- No CSP on either file
- `ff_key` localStorage access scattered across 3 direct call sites bypassing `LS` wrapper

### Accessibility (23 gaps, WCAG 2.1 AA target)

| Area | Critical | High | Medium |
|------|---------|------|--------|
| aria-live regions (streaming) | 2 | 3 | 0 |
| Modal accessibility | 3 | 4 | 0 |
| Icon-only buttons | 0 | 4 | 0 |
| Form input labeling | 1 | 2 | 2 |
| Keyboard navigation | 0 | 1 | 4 |
| Color contrast | 1 | 0 | 2 |

Most impactful single fix: add two static `aria-live` regions to `index.html` before `</body>`. Must be in static HTML — dynamically created regions are ignored by NVDA and VoiceOver iOS. Worst contrast failure: `placeholder-zinc-600` at 1.93:1 ratio (minimum 4.5:1) — fix with `placeholder-zinc-400`.

### Code Quality
1. Two diverged entry points → delete `freeforge.html`
2. `api.js` assigns `S.abort = ctrl` — transport function should not write to state singleton; return the controller
3. `state.js` is a utility grab-bag → split into `state.js` + `utils.js`
4. 3 direct `localStorage` calls bypass `LS` wrapper
5. `marked.setOptions()` called on every `renderMd()` invocation → move to module init
6. `showInvalidBanner` sets both class and inline style — load-bearing CSS workaround
7. README is missing — non-negotiable for portfolio credibility

### Mobile UX
1. iOS keyboard hides input: `100vh` doesn't shrink when keyboard appears → `100dvh` with `100vh` fallback
2. No safe-area insets: iPhone X+ home indicator overlaps content → `viewport-fit=cover` + `env(safe-area-inset-bottom)`
3. Copy/Regen buttons ~20px tall (minimum 44pt) → `min-height: 44px` via padding

---

## Phase Sequencing Recommendation

### Phase 1: Security Hardening (delete root file first)
Delete `freeforge.html`; upgrade DOMPurify + marked with new SRI hashes; fix `markdown.js` fallback; add CSP meta tag; centralise `ff_key` storage; move `marked.use()` to module init.

### Phase 2: Mobile UX
`100dvh` + VisualViewport fallback; `viewport-fit=cover`; `env(safe-area-inset-bottom)`; `min-height: 44px` on touch targets; `content-visibility: auto` on messages.

### Phase 3: Accessibility — WCAG AA Critical Path
Static `#sr-status` + `#sr-alert` regions; `role="log"` on `#msgs-list`; `role="dialog" aria-modal="true"` on modal; `for` attributes on all labels; `aria-describedby` on inputs; `aria-label` on all icon-only buttons; focus trap in `settings.js`; stream lifecycle announcements in `chat.js`.

### Phase 4: Code Quality + Architecture Cleanup
`state.js` → `state.js` + `utils.js`; remove `S.abort` from `api.js`; fix `showInvalidBanner` style mixing; `reader.cancel()` on abort; mid-stream error detection; 402/404 explicit error messages; `navigator.clipboard` fallback; corrupted `ff_msgs` detection.

### Phase 5: README + Portfolio Polish
Screenshot (desktop + mobile); README with description, usage, "how it works" bullets, "why vanilla JS?" rationale.

---

## Watch Out For

1. **`aria-live` regions must be in static HTML before JS writes to them.** NVDA and VoiceOver iOS only monitor regions present at DOM-ready. Phase 3 HTML must land before or with Phase 3 JS.

2. **Delete `freeforge.html` before applying security fixes.** Separate commits avoid bisect ambiguity and reviewer confusion about which file the fix applies to.

3. **`state.js` → `utils.js` split touches 9 import paths.** Missing one produces a silent `$ is not a function` error with no bundler to catch it. Grep all variations of `from './state.js'` before starting.

4. **`trapFocus` must filter out `.hidden` elements (Tailwind), not just `[hidden]`.** Add `&& el.offsetParent !== null` to the focusable elements filter.

5. **`100dvh` and the VisualViewport listener must land together.** `dvh` covers iOS 15.4+; the listener covers 15.3 and below. Both belong in the same commit.

---

*Analysis: 2026-06-04*
