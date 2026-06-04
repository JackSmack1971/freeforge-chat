# Roadmap: FreeForge Quality Pass

## Overview

FreeForge is a functional, feature-complete vanilla JS chat UI. This quality pass takes it from "it works" to "impressive portfolio piece" in five ordered phases: eliminate disqualifying security issues first, fix mobile UX next, close all WCAG AA accessibility gaps, clean up the architecture, and finish with portfolio documentation. Each phase delivers a verifiable, demonstrable improvement with no regressions to prior work.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Security Hardening** - Eliminate XSS vectors, upgrade CVE-affected libraries, add CSP, and delete the vulnerable root entry point
- [ ] **Phase 2: Mobile UX** - Fix iOS keyboard occlusion, safe-area insets, and touch target sizing
- [ ] **Phase 3: Accessibility** - Close all 23 WCAG 2.1 AA gaps including aria-live regions, modal focus trap, and input labeling
- [ ] **Phase 4: Code Quality** - Split state/utils, fix AbortController leak, add error resilience for edge-case API responses
- [ ] **Phase 5: Portfolio Polish** - README with screenshot, performance hint, footer verification

## Phase Details

### Phase 1: Security Hardening
**Goal**: The app has no XSS vectors, no CVE-affected dependencies, and a Content Security Policy — a portfolio reviewer who audits the source finds nothing disqualifying
**Mode:** mvp
**Depends on**: Nothing (first phase)
**Requirements**: SEC-01, SEC-02, SEC-03, SEC-04, SEC-05, SEC-06, SEC-07
**Success Criteria** (what must be TRUE):
  1. `freeforge.html` (root) no longer exists in the repository — the only entry point is `freeforge/index.html`
  2. DOMPurify loads at version 3.4.8 and marked.js loads at version 18.0.4, each with a matching SRI hash in the script tag
  3. A `<meta http-equiv="Content-Security-Policy">` tag is present in `freeforge/index.html` restricting scripts, connections, and objects
  4. The `markdown.js` CDN-fail branch escapes text instead of returning raw HTML
  5. All `ff_key` localStorage reads and writes go through `getStoredKey()` / `setStoredKey()` in `state.js`; no direct `localStorage.setItem('ff_key')` calls remain in `onboarding.js`, `settings.js`, or `app.js`
**Plans**: TBD

### Phase 2: Mobile UX
**Goal**: The app is fully usable on iOS and Android — the virtual keyboard does not hide the input, safe-area insets protect content from the home indicator, and all interactive controls meet minimum touch-target size
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: MOB-01, MOB-02, MOB-03, MOB-04
**Success Criteria** (what must be TRUE):
  1. On an iPhone (or iOS Simulator), opening the keyboard does not push the message input off screen — the input bar remains visible and reachable
  2. On an iPhone X or later, the input bar sits above the home indicator without overlap
  3. Copy and Regenerate buttons, and the model selector, have a minimum tap target height of 44px
  4. On a 375px-wide viewport the nav bar, model selector, and chat bubbles render without horizontal overflow or clipping
**Plans**: TBD

### Phase 3: Accessibility
**Goal**: The app meets WCAG 2.1 AA across all 23 audited gaps — screen reader users receive streaming announcements, keyboard users are not trapped, and every interactive element has a programmatic label
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: A11Y-01, A11Y-02, A11Y-03, A11Y-04, A11Y-05, A11Y-06, A11Y-07, A11Y-08, A11Y-09, A11Y-10, A11Y-11, A11Y-12
**Success Criteria** (what must be TRUE):
  1. A screen reader (VoiceOver or NVDA) announces "Assistant is responding…" when a reply begins streaming and "Response complete" when it finishes, without the user taking any action
  2. When the Settings modal is open, Tab and Shift+Tab cycle only through modal controls; focus returns to the settings gear button on close
  3. Every icon-only button (settings gear, send, stop, password toggle, new chat, close settings, banner update) has a descriptive accessible name announced by screen readers
  4. Both key inputs (`ob-key-input` and the settings key input) have a visible `<label>` associated via `for`, and validation errors are announced via `aria-describedby`
  5. Placeholder text in all inputs passes a 4.5:1 contrast ratio; a skip link to `#msg-input` is the first focusable element in the page
**Plans**: TBD
**UI hint**: yes

### Phase 4: Code Quality
**Goal**: The codebase is clean, intentional, and resilient — architectural inconsistencies are resolved, resource leaks are closed, and edge-case API responses produce informative user feedback rather than silent failures
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: CODE-01, CODE-02, CODE-03, CODE-04, CODE-05, CODE-06, CODE-07, CODE-08, CODE-09
**Success Criteria** (what must be TRUE):
  1. `state.js` contains only the state singleton and localStorage helpers; all DOM/utility functions live in `utils.js`; all 9+ import paths resolve without errors
  2. `api.js` returns the `AbortController` from `streamCompletion` rather than writing to the state singleton, and registers `reader.cancel()` on the abort signal
  3. Navigating to a model that returns a mid-stream error (e.g., `finish_reason: "error"`) shows a toast with the provider error message rather than silently failing
  4. Pasting an API key on a `file://` origin (Firefox) successfully copies the confirmation toast — the clipboard fallback via `execCommand` fires without throwing
  5. On first load with a corrupted `ff_msgs` value in localStorage, a toast informs the user that previous chat data was cleared, and the app continues normally
**Plans**: TBD

### Phase 5: Portfolio Polish
**Goal**: The repository is immediately legible and impressive to anyone who lands on the GitHub page — a README with screenshot and clear usage instructions, a performance hint for long conversations, and a footer attribution that matches the spec
**Mode:** mvp
**Depends on**: Phase 1, Phase 2, Phase 3, Phase 4
**Requirements**: DOC-01, DOC-02, DOC-03
**Success Criteria** (what must be TRUE):
  1. `README.md` exists at the repository root and contains at minimum: a one-sentence description, a screenshot showing the desktop UI, a three-step usage section, a "how it works" technical summary, and a "why vanilla JS?" rationale
  2. `.msg-bubble` in `styles/app.css` has a `content-visibility: auto` rule — long conversations do not cause layout thrashing during scroll
  3. `freeforge/index.html` contains a visible footer with the text "Powered by OpenRouter free models" and a "Local storage only" attribution
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Security Hardening | 0/TBD | Not started | - |
| 2. Mobile UX | 0/TBD | Not started | - |
| 3. Accessibility | 0/TBD | Not started | - |
| 4. Code Quality | 0/TBD | Not started | - |
| 5. Portfolio Polish | 0/TBD | Not started | - |
