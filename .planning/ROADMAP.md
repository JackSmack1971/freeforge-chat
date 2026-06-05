# Roadmap: FreeForge Quality Pass

## Overview

FreeForge is a functional, feature-complete vanilla JS chat UI. Phase 1 (Security Hardening) is complete and deployed to Netlify. Remaining phases have been cleared — a new plan focused on client-side security is in progress.

## Phases

- [x] **Phase 1: Security Hardening** - Eliminate XSS vectors, upgrade CVE-affected libraries, add CSP, and delete the vulnerable root entry point

## Phase Details

### Phase 1: Security Hardening
**Goal**: The app has no XSS vectors, no CVE-affected dependencies, and a Content Security Policy — a portfolio reviewer who audits the source finds nothing disqualifying
**Mode:** mvp
**Depends on**: Nothing (first phase)
**Requirements**: SEC-01, SEC-02, SEC-03, SEC-04, SEC-05, SEC-06, SEC-07
**Success Criteria** (what must be TRUE):
  1. `freeforge.html` (root) no longer exists in the repository — the only entry point is `freeforge/index.html`
  2. DOMPurify loads at version 3.4.8 and marked.js loads at version 18.0.4, each with a matching SRI hash in the script tag
  3. A Content Security Policy is present restricting scripts, connections, and objects (delivered via HTTP header in `netlify.toml`)
  4. The `markdown.js` CDN-fail branch escapes text instead of returning raw HTML
  5. All `ff_key` localStorage reads and writes go through `getStoredKey()` / `setStoredKey()` in `state.js`; no direct `localStorage.setItem('ff_key')` calls remain in `onboarding.js`, `settings.js`, or `app.js`
**Plans:** 3 plans
Plans:
- [x] 01-01-PLAN.md — Delete freeforge.html + upgrade CDN libs (marked@18.0.4, DOMPurify@3.4.8) + add CSP meta tag
- [x] 01-02-PLAN.md — Fix markdown.js: module-level marked.use() and escape XSS fallback
- [x] 01-03-PLAN.md — Add getStoredKey/setStoredKey to state.js; update 3 caller files

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Security Hardening | 3/3 | Complete | 2026-06-04 |
