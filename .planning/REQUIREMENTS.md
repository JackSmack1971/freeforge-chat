# Requirements — FreeForge Quality Pass

**Version:** v1 (quality pass)
**Date:** 2026-06-04
**Method:** Brownfield audit — validated requirements inferred from existing code; active requirements from security/accessibility/architecture/pitfalls research

---

## v1 Requirements

### Security & Entry Point Consolidation

- [ ] **SEC-01**: Delete `freeforge.html` (root) — eliminates the unmaintained XSS-vulnerable entry point; `freeforge/index.html` is the sole canonical entry
- [ ] **SEC-02**: Upgrade DOMPurify from 3.1.6 (CVE-2025-26791) to 3.4.8 with updated SRI hash in `freeforge/index.html`
- [ ] **SEC-03**: Upgrade marked.js from 9.1.6 to 18.0.4 with updated SRI hash in `freeforge/index.html`
- [ ] **SEC-04**: Fix `markdown.js` CDN-fail fallback — replace `return raw` branch with `return esc(text).replace(/\n/g, '<br>')` so a CDN failure never injects raw HTML
- [ ] **SEC-05**: Add Content Security Policy `<meta>` tag to `freeforge/index.html` (`default-src 'none'; script-src cdn.tailwindcss.com cdn.jsdelivr.net; connect-src https://openrouter.ai; style-src 'unsafe-inline'; object-src 'none'`)
- [ ] **SEC-06**: Centralise `ff_key` localStorage access — add `getStoredKey()` / `setStoredKey()` to `state.js`; remove 3 direct `localStorage.setItem('ff_key')` calls in `onboarding.js`, `settings.js`, `app.js`
- [ ] **SEC-07**: Move `marked.use({ breaks: true, gfm: true })` from per-call `marked.setOptions()` to module initialisation in `markdown.js`

### Mobile UX

- [ ] **MOB-01**: Fix iOS virtual keyboard hiding input — replace `height: 100vh` on `#screen-chat` with `height: 100dvh` plus `100vh` fallback; add `visualViewport resize` listener for iOS ≤ 15.3
- [ ] **MOB-02**: Add safe-area inset support — add `viewport-fit=cover` to viewport meta; add `padding-bottom: env(safe-area-inset-bottom)` to the input bar container
- [ ] **MOB-03**: Fix touch target sizes — add `min-height: 44px` padding to Copy, Regenerate, and model selector elements (WCAG 2.5.5)
- [ ] **MOB-04**: Verify responsive layout — confirm model selector, nav bar, and chat bubbles render correctly on 375px viewport

### Accessibility — WCAG 2.1 AA Critical Path

- [ ] **A11Y-01**: Add `role="log" aria-label="Chat history" aria-live="polite"` to `#msgs-list` for completed messages
- [ ] **A11Y-02**: Add static `<div id="sr-status" class="sr-only" aria-live="polite" aria-atomic="true"></div>` and `<div id="sr-alert" class="sr-only" role="alert" aria-live="assertive" aria-atomic="true"></div>` before `</body>` in `index.html`
- [ ] **A11Y-03**: Announce streaming lifecycle — write "Assistant is responding…" to `#sr-status` on stream start, "Response complete" on done, error text to `#sr-alert` on error (in `chat.js` callbacks)
- [ ] **A11Y-04**: Fix settings modal — add `role="dialog" aria-modal="true" aria-labelledby="settings-title"` to the modal card; add `id="settings-title"` to the "Settings" heading
- [ ] **A11Y-05**: Implement focus trap in `settings.js` — trap Tab/Shift+Tab to modal focusable elements (filter by `offsetParent !== null` to exclude `.hidden` elements); return focus to `#settings-btn` on close
- [ ] **A11Y-06**: Wire `<label for>` attributes to all inputs — `ob-key-input` and settings key input; add `aria-describedby` pointing to error message elements; set `aria-invalid="true"` on validation failure
- [ ] **A11Y-07**: Add `aria-label` to all 7 icon-only interactive elements: settings gear, send button, stop button, password toggle (`ob-toggle-vis`), new-chat button, close-settings button, banner update button
- [ ] **A11Y-08**: Sync send/stop accessible name with stream state — update `aria-label` on `#send-btn` in `setStreamMode()` (`"Send message"` / `"Stop generating"`)
- [ ] **A11Y-09**: Fix placeholder contrast — replace `placeholder-zinc-600` with `placeholder-zinc-400` in all inputs (current ratio 1.93:1; minimum 4.5:1)
- [ ] **A11Y-10**: Add skip link — `<a href="#msg-input" class="sr-only focus:not-sr-only">Skip to chat input</a>` as first child of `<body>`
- [ ] **A11Y-11**: Add `aria-pressed` to password visibility toggle; announce toggle state to AT
- [ ] **A11Y-12**: Add `.sr-only` CSS class and `:focus-visible` outline rule to `styles/app.css`

### Code Quality & Architecture

- [ ] **CODE-01**: Split `state.js` into `state.js` (S singleton + LS wrapper + getStoredKey/setStoredKey) and `utils.js` ($ DOM helper, esc, uid, maskKey, fmtCtx) — update all 9+ import paths
- [ ] **CODE-02**: Remove `S.abort = ctrl` from `api.js` — return the `AbortController` from `streamCompletion`; assign in `chat.js` caller
- [ ] **CODE-03**: Fix `showInvalidBanner` in `screen.js` — remove inline `style.display = 'flex'` workaround; add `flex` to the element's CSS rule so class toggle is sufficient
- [ ] **CODE-04**: Fix `regenerate()` in `chat.js` — remove the notice message by ID not by `role === 'notice'` scan (more robust against future message types)
- [ ] **CODE-05**: Fix `AbortController` stream leak — register `signal.addEventListener('abort', () => reader.cancel())` in `api.js` `streamCompletion`
- [ ] **CODE-06**: Handle mid-stream OpenRouter error format — check `j.error` and `finish_reason === 'error'` before the `if (delta)` guard in `api.js`; show a toast with the provider error message
- [ ] **CODE-07**: Handle unhandled HTTP status codes — add explicit cases for 402 ("Daily free limit reached — try again tomorrow") and 404 ("Model not found — select a different model") in `api.js`
- [ ] **CODE-08**: Add `navigator.clipboard` fallback — use `document.execCommand('copy')` when clipboard API is unavailable (e.g., `file://` in Firefox)
- [ ] **CODE-09**: Detect and recover from corrupted `ff_msgs` — if `LS.get('ff_msgs')` is non-null but not an array, clear it and show a toast ("Previous chat data was corrupt and has been cleared")

### Documentation & Portfolio Polish

- [ ] **DOC-01**: Write `README.md` — one-sentence description, screenshot (desktop + mobile), three-step usage (`git clone` / open file / paste key), "how it works" technical bullets, "why vanilla JS?" rationale paragraph, link to OpenRouter free models
- [ ] **DOC-02**: Add `content-visibility: auto` hint to `.msg-bubble` in `styles/app.css` for long conversation performance
- [ ] **DOC-03**: Add "Powered by OpenRouter free models • Local storage only" footer to `index.html` (already in spec; verify it's present)

---

## v2 Requirements (deferred)

- Multi-conversation history with sidebar
- System prompt / persona configuration
- PWA / service worker for offline resilience
- Custom model entry (beyond `:free` filter)
- Syntax highlighting for code blocks (highlight.js / Prism)
- Export conversation as Markdown or JSON

---

## Out of Scope

- Backend / server component — client-only by design
- Authentication beyond API key localStorage — unnecessary for portfolio/personal use
- React / Vue rewrite — vanilla JS is the point of the portfolio demonstration
- Test suite — no test runner in the project; testing is manual/visual

---

## Traceability

| REQ-ID | Phase |
|--------|-------|
| SEC-01 – SEC-07 | Phase 1: Security Hardening |
| MOB-01 – MOB-04 | Phase 2: Mobile UX |
| A11Y-01 – A11Y-12 | Phase 3: Accessibility |
| CODE-01 – CODE-09 | Phase 4: Code Quality |
| DOC-01 – DOC-03 | Phase 5: Portfolio Polish |
