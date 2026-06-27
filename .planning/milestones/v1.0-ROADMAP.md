# Roadmap: FreeForge Quality Pass

## Overview

FreeForge is a functional, feature-complete vanilla JS chat UI. Phase 1 (Security Hardening) is complete and deployed to Netlify, and Phase 2 (Audit Cleanup) is complete. The milestone is ready to close.

## Phases

- [x] **Phase 1: Security Hardening** - Eliminate XSS vectors, upgrade CVE-affected libraries, add CSP, and delete the vulnerable root entry point
- [x] **Phase 2: Audit Cleanup** - Close the two remaining review warnings from v1.0 before milestone close

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
  5. All `ff_key` storage access goes through `getStoredKey()` / `setStoredKey()` / `clearStoredKey()` in `state.js`; the API key no longer persists in `localStorage`, and no direct `ff_key` storage calls remain in `onboarding.js`, `settings.js`, or `app.js`
**Plans:** 3 plans
Plans:
- [x] 01-01-PLAN.md — Delete freeforge.html + upgrade CDN libs (marked@18.0.4, DOMPurify@3.4.8) + add CSP meta tag
- [x] 01-02-PLAN.md — Fix markdown.js: module-level marked.use() and escape XSS fallback
- [x] 01-03-PLAN.md — Add getStoredKey/setStoredKey to state.js; update 3 caller files

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Security Hardening | 3/3 | Complete | 2026-06-04 |
| 2. Audit Cleanup | 2/2 | Complete | 2026-06-27 |

### Phase 2: Audit Cleanup
**Goal**: Close the remaining review warnings from the v1.0 audit: mirror the onboarding empty-models guard in settings, and lock down the CSP `base-uri` directive
**Mode:** mvp
**Depends on**: Phase 1: Security Hardening
**Requirements**: TBD
**Success Criteria** (what must be TRUE):
  1. `settings.js` rejects and surfaces a valid API key that returns zero free models, matching the onboarding guard
  2. `freeforge/index.html` CSP includes `base-uri 'none'` or `base-uri 'self'`
**Plans:** 2 plans
Plans:
- [x] 02-01-PLAN.md — Mirror onboarding empty-models guard in settings
- [x] 02-02-PLAN.md — Add `base-uri` to the CSP
