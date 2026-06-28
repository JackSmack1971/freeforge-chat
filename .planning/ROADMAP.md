# Roadmap: FreeForge Quality Pass

## Overview

FreeForge is a functional, feature-complete vanilla JS chat UI. Phase 1 (Security Hardening) is complete and deployed to Netlify, Phase 2 (Audit Cleanup) is complete, and Phase 3 (Accessibility) is now in progress.

## Phases

- [x] **Phase 1: Security Hardening** - Eliminate XSS vectors, upgrade CVE-affected libraries, add CSP, and delete the vulnerable root entry point
- [x] **Phase 2: Audit Cleanup** - Close the two remaining review warnings from v1.0 before milestone close
- [x] **Phase 3: Accessibility** - Retrofit the static accessibility primitives, live regions, labels, and focus styling for the chat UI (completed 2026-06-28)

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
| 3. Accessibility | 3/3 | Complete   | 2026-06-28 |

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

### Phase 3: Accessibility

**Goal**: The static chat shell exposes the right semantics to assistive tech before any JavaScript runs, and keyboard users can reach the chat input and visible focus states without friction.
**Mode:** execute
**Depends on**: Phase 2: Audit Cleanup
**Requirements**: A11Y-01, A11Y-02, A11Y-04, A11Y-06, A11Y-07, A11Y-09, A11Y-10, A11Y-12
**Success Criteria** (what must be TRUE):

  1. The message list is exposed as a named live log and the static screen-reader status/alert regions exist before scripts write to them
  2. The skip link jumps straight to the chat input, the settings dialog semantics remain intact, and the static icon-only controls have explicit names
  3. Placeholder text and keyboard focus are visibly distinguishable, with a reusable screen-reader-only utility available in the stylesheet

**Plans:** 3/3 plans complete
Plans:

- [x] 03-01-PLAN.md — Add the static accessibility primitives in `index.html` and `styles/app.css`
- [x] 03-02-PLAN.md — Wire streaming announcements and stateful accessibility updates in the chat flow
- [x] 03-03-PLAN.md — Tighten modal focus handling and validation-state feedback for settings/onboarding
