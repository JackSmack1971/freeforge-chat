# Accessibility & ARIA Feature Requirements — FreeForge Chat

**Domain:** Vanilla ES-module chat app (dark theme, Tailwind CSS)
**Researched:** 2026-06-04
**WCAG target:** 2.1 Level AA
**Overall confidence:** HIGH (W3C APG + MDN + Sara Soueidan + makethingsaccessible.com cross-verified)

---

## Audit Scope

Six areas were audited against the live codebase at `freeforge/index.html` and the JS modules
under `freeforge/src/`. Every gap maps to a WCAG 2.1 criterion and a concrete fix.

---

## Area 1: aria-live Regions for Streaming Chat (WCAG 1.3.1, 4.1.3)

### What the current code does

`chat.js` `onToken` fires per SSE token and writes to `S.streamTarget.textContent = full`.
The `msgs-list` div and individual `msg-content` divs carry no `aria-live` attribute.
The `thinking` indicator has no accessible announcement. The toast container (`#toasts`) has
no live-region attributes.

### Gaps

| Gap | WCAG Criterion | Severity |
|-----|----------------|----------|
| No live region on message list — screen reader never knows a new assistant message arrived | 4.1.3 Status Messages | Critical |
| No live region on `#toasts` — toast notifications are invisible to AT | 4.1.3 Status Messages | Critical |
| Per-token textContent mutation floods potential live region — wrong granularity | 4.1.3 | High |
| `#thinking` indicator not announced — user has no feedback that a response is in progress | 4.1.3 | High |
| Live region must exist in DOM before content is inserted — dynamic creation breaks announcements | 4.1.3 | High |

### How aria-live should work for streaming chat (verified: MDN, Sara Soueidan, A11Y Collective)

**Rule 1 — Placement:** The live region container must be in the HTML on initial page load,
not created dynamically. Screen readers monitor regions from DOM-ready; dynamically created
regions may be ignored.

**Rule 2 — Politeness:** Use `aria-live="polite"` for the chat message list and toast
container. Reserve `aria-live="assertive"` only for hard errors (401, 429) — assertive
interrupts the user's current reading.

**Rule 3 — Streaming granularity:** Do NOT make the actively streaming `msg-content` element
a live region. Announcing every token produces a firehose. The correct pattern is:
- Silence the streaming element (no live region, no role).
- Keep a separate off-screen `role="status"` region. Announce only two events:
  1. When streaming begins: "FreeForge is responding…"
  2. When `onDone` fires: announce the complete message or a short summary like
     "Response complete. [first 120 chars]"

**Rule 4 — `aria-atomic`:** Use `aria-atomic="true"` on the status region so the full phrase
is spoken, not just the changed fragment.

**Rule 5 — `role="log"` on message list:** The completed message list (`#msgs-list`) should
carry `role="log"` which has an implicit `aria-live="polite"`. Add the redundant explicit
attribute `aria-live="polite"` for maximum AT compatibility (MDN guidance).

### Exact fixes

**index.html — add two static regions before `</body>`:**

```html
<!-- Streaming status announcer (off-screen, polite) -->
<div id="sr-status" role="status" aria-live="polite" aria-atomic="true"
     class="sr-only"></div>

<!-- Error announcer (assertive, for 401/429/network errors) -->
<div id="sr-alert" role="alert" aria-live="assertive" aria-atomic="true"
     class="sr-only"></div>
```

Add `.sr-only` to `styles/app.css`:
```css
.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;
  clip:rect(0,0,0,0);white-space:nowrap;border:0}
```

**index.html — `#msgs-list`:** add `role="log" aria-live="polite" aria-label="Chat messages"`

**index.html — `#toasts`:** add `role="status" aria-live="polite" aria-atomic="false"`

**chat.js — `streamCompletion` callbacks:**

```js
// onToken callback — announce start of response once
onToken(_delta, full) {
  if (firstToken) {
    firstToken = false;
    $('thinking').classList.add('hidden');
    $('sr-status').textContent = 'FreeForge is responding…';
    S.streamTarget = document.querySelector(`[data-id="${asstId}"] .msg-content`);
  }
  asstMsg.content = full;
  if (S.streamTarget) S.streamTarget.textContent = full;
  scrollBottom(false);
},

// onDone callback — announce completion
onDone(full) {
  // ... existing logic ...
  const preview = (full || asstMsg.content).slice(0, 120).replace(/\s+/g, ' ');
  $('sr-status').textContent = `Response complete. ${preview}`;
  // ... rest of existing logic ...
},

// onError callback — use assertive channel
onError(errMsg) {
  $('sr-alert').textContent = errMsg;
  // ... rest of existing logic ...
},
```

**Note on VoiceOver iOS:** Do NOT add both `role="alert"` and `aria-live="assertive"` on the
same element — VoiceOver iOS double-speaks it. `#sr-alert` above uses `role="alert"` which
has an implicit assertive live region; the explicit `aria-live="assertive"` attribute is
technically redundant but included for JAWS/NVDA compatibility. If VoiceOver iOS double-
announce is observed during testing, remove the explicit `aria-live="assertive"` attribute
and keep only `role="alert"`.

---

## Area 2: Modal Accessibility — Settings Modal (WCAG 2.1.2, 4.1.2)

### Current state

`#settings-modal` is a plain `<div>` that toggles `.open` to display. It has no ARIA role,
no `aria-modal`, no `aria-labelledby`, no focus trap, and no initial-focus management.

`app.js` handles Escape to close (correct) and backdrop click to close (correct).
`openSettings()` does not move focus into the modal; `closeSettings()` does not return focus
to the trigger.

### Gaps

| Gap | WCAG Criterion | Severity |
|-----|----------------|----------|
| No `role="dialog"` | 4.1.2 Name, Role, Value | Critical |
| No `aria-modal="true"` | 4.1.2 / 2.1.2 No Keyboard Trap (inverse) | Critical |
| No `aria-labelledby` pointing to "Settings" `<h2>` | 4.1.2 | High |
| No focus trap — Tab exits modal into background | 2.1.2 | Critical |
| `openSettings()` does not move initial focus | 2.4.3 Focus Order | High |
| `closeSettings()` does not return focus to trigger | 2.4.3 Focus Order | High |
| Close button has no accessible name (icon-only) | 4.1.2 | High |

### WAI-ARIA APG dialog pattern requirements (HIGH confidence — W3C APG)

- `role="dialog"` on the container
- `aria-modal="true"` on the same element (only when background is visually and interactively
  obscured — both conditions are met here via `.modal-bg` backdrop)
- `aria-labelledby` referencing the visible heading ID
- Focus moves to the first interactive element inside on open
- Tab/Shift+Tab cycle within the modal only (focus trap)
- Escape closes and returns focus to trigger
- On close, focus returns to the element that opened the modal

### Exact fixes

**index.html — modal container element** (the inner card div):

```html
<div role="dialog" aria-modal="true" aria-labelledby="settings-title"
     class="relative w-full max-w-md rounded-2xl border border-zinc-800 p-6 z-10 modal-card"
     style="background:#18181b">
```

**index.html — Settings heading** (add id):

```html
<h2 id="settings-title" class="text-lg font-semibold text-zinc-100">Settings</h2>
```

**index.html — close button** (add aria-label):

```html
<button id="close-settings-btn" aria-label="Close settings"
        class="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors">
```

**settings.js — `openSettings()`** (add focus management + store trigger ref):

```js
export function openSettings(triggerEl) {
  S._settingsTrigger = triggerEl || document.activeElement;
  $('settings-key-display').textContent = maskKey(S.apiKey);
  $('settings-new-key').value = '';
  $('settings-key-error').classList.add('hidden');
  $('settings-modal').classList.add('open');
  // Move focus to first interactive element in modal
  const first = $('settings-modal').querySelector(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  if (first) first.focus();
  // Install focus trap
  $('settings-modal').addEventListener('keydown', trapFocus);
}

export function closeSettings() {
  $('settings-modal').classList.remove('open');
  $('settings-modal').removeEventListener('keydown', trapFocus);
  // Return focus to trigger
  if (S._settingsTrigger) { S._settingsTrigger.focus(); S._settingsTrigger = null; }
}

function trapFocus(e) {
  if (e.key !== 'Tab') return;
  const modal = $('settings-modal');
  const focusable = Array.from(modal.querySelectorAll(
    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
  )).filter(el => !el.closest('[hidden]'));
  const first = focusable[0], last = focusable[focusable.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault(); last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault(); first.focus();
  }
}
```

**app.js** — pass trigger reference to `openSettings`:

```js
$('settings-btn').addEventListener('click', () => openSettings($('settings-btn')));
$('banner-update-btn').addEventListener('click', () => { hideInvalidBanner(); openSettings($('banner-update-btn')); });
```

---

## Area 3: Icon-Only Buttons (WCAG 4.1.2 Name, Role, Value)

### Current state

Multiple buttons have no text content and no `aria-label`, relying on a `title` attribute or
nothing at all. The `title` attribute is unreliable as an accessible name — it is not
consistently exposed by all screen readers and is invisible to touch/mobile users.

### Audit of every icon-only interactive element

| Element | ID / Class | Has aria-label? | Has title? | Status |
|---------|-----------|-----------------|------------|--------|
| Settings gear | `#settings-btn` | No | `title="Settings"` | FAIL — title only |
| Send/Stop button | `#send-btn` | No | None | FAIL — no name |
| Password toggle (onboarding) | `#ob-toggle-vis` | No | None | FAIL — no name |
| Close settings button | `#close-settings-btn` | No | None | FAIL — no name |
| New Chat button | `#new-chat-btn` | Partial — has text "New Chat" on sm+, hidden on mobile | Partial FAIL on mobile |
| Copy button (messages.js) | `.copy-btn` | No — has text "Copy" | PASS — has visible text |
| Regenerate button (messages.js) | `.regen-btn` | No — has text "Regenerate" | PASS — has visible text |
| Suggestion chips | `.suggestion` | No — has visible text | PASS |

### Best practice (HIGH confidence — Sara Soueidan, W3C APG, WCAG TECHS/ARIA6)

**Preferred pattern:** `aria-label` on the `<button>` element. Hide the SVG from AT using
`aria-hidden="true" focusable="false"` on the SVG. Do NOT label the SVG directly — this
pattern has documented failures across browser/AT combinations.

**State-changing buttons:** The send/stop button changes its icon to indicate two different
actions. Both states must have distinct accessible names.

### Exact fixes

**index.html — settings button:**

```html
<button id="settings-btn" aria-label="Settings"
        class="p-2 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors">
  <svg aria-hidden="true" focusable="false" class="w-4 h-4" ...>...</svg>
</button>
```

Remove `title="Settings"` (redundant and creates tooltip overlap).

**index.html — send/stop button** (two states managed by JS, needs aria-label update in JS):

```html
<button id="send-btn" aria-label="Send message"
        class="gradient-btn flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all">
  <svg id="send-icon" aria-hidden="true" focusable="false" ...>...</svg>
  <svg id="stop-icon" aria-hidden="true" focusable="false" class="hidden" ...>...</svg>
</button>
```

**messages.js — `setStreamMode`:** update aria-label when toggling icons:

```js
export function setStreamMode(active) {
  S.streaming = active;
  $('send-icon').classList.toggle('hidden', active);
  $('stop-icon').classList.toggle('hidden', !active);
  $('send-btn').setAttribute('aria-label', active ? 'Stop generation' : 'Send message');
}
```

**index.html — password toggle (onboarding):**

```html
<button id="ob-toggle-vis" type="button" aria-label="Show password" aria-pressed="false"
        aria-controls="ob-key-input"
        class="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors">
  <svg id="ob-eye-show" aria-hidden="true" focusable="false" ...>...</svg>
  <svg id="ob-eye-hide" aria-hidden="true" focusable="false" class="hidden" ...>...</svg>
</button>
```

**app.js — ob-toggle-vis handler:** update aria-label and aria-pressed on toggle:

```js
$('ob-toggle-vis').addEventListener('click', () => {
  const inp = $('ob-key-input');
  const show = inp.type === 'password';
  inp.type = show ? 'text' : 'password';
  $('ob-eye-show').classList.toggle('hidden', show);
  $('ob-eye-hide').classList.toggle('hidden', !show);
  const btn = $('ob-toggle-vis');
  btn.setAttribute('aria-pressed', show ? 'true' : 'false');
  btn.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
  $('sr-status').textContent = show ? 'Password is now visible.' : 'Password is now hidden.';
});
```

**index.html — new-chat button** (visible text hidden on mobile — add aria-label for small screens, or unhide the span):

Simplest fix is to keep the visible `<span class="hidden sm:block">New Chat</span>` but also
add `aria-label="New chat"` at all times so AT always has a name regardless of screen width:

```html
<button id="new-chat-btn" aria-label="New chat"
        class="gradient-btn flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-all">
```

---

## Area 4: Form Input Labeling (WCAG 1.3.1, 4.1.2)

### Current state

Both password inputs (`#ob-key-input` and `#settings-new-key`) use a `<label>` element with
`class="block text-xs font-medium text-zinc-400 mb-1.5"` but the labels are **not programmatically
associated** with their inputs — they have no `for` attribute and the inputs have no `id`
matching a label. Screen readers may not announce "API Key" when focus enters the input.

The `#settings-key-display` (masked key display `div`) has no accessible label. The
`#ob-key-error` and `#settings-key-error` error paragraphs are not linked to their inputs
via `aria-describedby`.

### Gaps

| Gap | WCAG Criterion | Severity |
|-----|----------------|----------|
| `<label>` has no `for` attribute — inputs are unlabeled in AT | 1.3.1 Info and Relationships | Critical |
| Error message paragraphs not wired to inputs via `aria-describedby` | 1.3.1 | High |
| When error appears, no live announcement — user must navigate back to input | 4.1.3 | Medium |
| `#settings-key-display` masked key display has no label for AT | 1.3.1 | Medium |
| `aria-invalid` not set on input when error is shown | 4.1.2 | Medium |

### Exact fixes

**index.html — onboarding label + input association:**

```html
<label for="ob-key-input" class="block text-xs font-medium text-zinc-400 mb-1.5">API Key</label>
<input id="ob-key-input" type="password"
       aria-describedby="ob-key-error"
       aria-required="true"
       placeholder="sk-or-v1-..."
       autocomplete="new-password"
       spellcheck="false"
       class="w-full px-3 py-2.5 rounded-xl ..." >
<p id="ob-key-error" class="mt-1.5 text-xs text-red-400 hidden" aria-live="polite"></p>
```

Note: `autocomplete="new-password"` instead of `off` — browsers treat `off` inconsistently;
`new-password` correctly signals a new credential to password managers and AT.

**index.html — settings update-key label + input:**

```html
<label for="settings-new-key" class="block text-xs font-medium text-zinc-400 mb-1.5">Update API Key</label>
<input id="settings-new-key" type="password"
       aria-describedby="settings-key-error"
       aria-required="false"
       placeholder="sk-or-v1-…"
       autocomplete="new-password"
       class="w-full px-3 py-2.5 rounded-xl ..." >
<p id="settings-key-error" class="mt-1.5 text-xs text-red-400 hidden" aria-live="polite"></p>
```

**index.html — current key display:**

```html
<div class="flex items-center gap-2">
  <div id="settings-key-display"
       role="status"
       aria-label="Current API key (masked)"
       class="flex-1 px-3 py-2 rounded-xl text-sm bg-zinc-900 border border-zinc-800 text-zinc-500 font-mono truncate">
    ••••••••
  </div>
  ...
```

**onboarding.js — `showObError`:** set `aria-invalid` on the input:

```js
export function showObError(msg) {
  const el = $('ob-key-error');
  el.textContent = msg;
  el.classList.remove('hidden');
  $('ob-key-input').setAttribute('aria-invalid', 'true');
}

export function hideObError() {
  $('ob-key-error').classList.add('hidden');
  $('ob-key-input').removeAttribute('aria-invalid');
}
```

**settings.js — error display:** same pattern for settings input:

```js
// In catch block of updateKey():
const err = $('settings-key-error');
err.textContent = e.message || 'Invalid key';
err.classList.remove('hidden');
$('settings-new-key').setAttribute('aria-invalid', 'true');

// In finally / on success — clear invalid:
$('settings-new-key').removeAttribute('aria-invalid');
```

---

## Area 5: Keyboard Navigation Completeness (WCAG 2.1.1, 2.4.3, 2.4.7)

### Full keyboard path — chat screen (traced from DOM order)

Expected tab order starting from nav:

1. Model selector `<select>` (focusable natively)
2. Settings gear button `#settings-btn`
3. New Chat button `#new-chat-btn`
4. [Empty state: suggestion chip buttons — 4 chips] OR [message action buttons within msgs-list]
5. Message textarea `#msg-input`
6. Send/Stop button `#send-btn`

### Gaps found

| Gap | Location | WCAG Criterion | Severity |
|-----|----------|----------------|----------|
| No skip link to bypass nav and jump to `#msg-input` | Top of page | 2.4.1 Bypass Blocks | Medium |
| No visible focus indicator on several custom elements | Body, nav, chat | 2.4.7 Focus Visible | High |
| `suggestion` chip buttons inside `#empty-state` — receive tab focus but clicking one sets textarea value; focus stays on chip, not textarea | 2.4.3 Focus Order | Medium |
| Regenerate delegated click listener (`document.addEventListener('click', e => e.target.closest('.regen-btn')`) — works; OK | — | — |
| `#invalid-banner` "Update Key" button is before nav in DOM but after all nav visually — focus order is inconsistent with visual order | 2.4.3 Focus Order | Low |
| `#thinking` indicator has no role — AT sees "Thinking ···" dots as decorative text | 4.1.3 | Medium |
| During streaming, `#msg-input` and `#send-btn` remain focusable but send is blocked by `S.streaming` check — no `disabled` or `aria-disabled` to signal to AT | 4.1.2 | Medium |
| `<textarea>` `placeholder` only label — if label were removed, it would be unlabeled; currently has no visible label | 1.3.1 | Medium |

### Exact fixes

**Skip link (index.html — first element inside `<body>`):**

```html
<a href="#msg-input" class="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2
   focus:z-50 focus:px-4 focus:py-2 focus:bg-indigo-600 focus:text-white focus:rounded-lg
   focus:text-sm focus:font-medium">Skip to chat input</a>
```

This requires Tailwind's `focus:` variant on the `.sr-only` utility pattern. Equivalent CSS:

```css
.skip-link{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;
  clip:rect(0,0,0,0);white-space:nowrap;border:0}
.skip-link:focus{position:fixed;top:.5rem;left:.5rem;width:auto;height:auto;
  padding:.5rem 1rem;clip:auto;overflow:visible;white-space:normal;
  background:#4f46e5;color:#fff;border-radius:.5rem;font-size:.875rem;font-weight:500;z-index:9999}
```

**Textarea label (index.html):**

```html
<label for="msg-input" class="sr-only">Message</label>
<textarea id="msg-input" ...></textarea>
```

**Thinking indicator (index.html):**

```html
<div id="thinking" class="hidden px-4 pb-4 max-w-3xl mx-auto"
     role="status" aria-label="FreeForge is thinking">
```

**Streaming — disable send during stream (app.js send-btn handler):**
The existing guard `if (S.streaming) { abort }` is correct logic but AT does not know the
button is in a different mode. The `setStreamMode(true)` call already swaps to the stop icon;
the aria-label fix in Area 3 above handles the name change. No additional `disabled` needed
since the button is still actionable (it aborts). This is acceptable as-is once the aria-label
is updated.

**Suggestion chips — move focus to textarea after click (app.js):**

```js
document.addEventListener('click', e => {
  if (e.target.classList.contains('suggestion')) {
    inp.value = e.target.textContent;
    inp.dispatchEvent(new Event('input'));
    inp.focus(); // already present — PASS
  }
});
```

This is already implemented. PASS.

**Focus visibility — `styles/app.css`:** Tailwind's default focus ring is suppressed by the
`focus:outline-none` on several inputs. The `focus:ring-1 focus:ring-indigo-500` replacement
is present on inputs. Verify buttons have visible focus state. Add to CSS:

```css
/* Ensure all interactive elements have visible focus ring */
:focus-visible{outline:2px solid #6366f1;outline-offset:2px}
/* Override for elements that set their own focus styles */
input:focus-visible,textarea:focus-visible,select:focus-visible{outline:none}
```

This ensures the W3C-recommended `focus-visible` pseudo-class (supported in all modern
browsers) provides ring on keyboard navigation without disrupting mouse users.

---

## Area 6: Color Contrast — Indigo/Zinc Dark Palette (WCAG 1.4.3, 1.4.11)

### Contrast ratios calculated (WCAG 1.4.3: 4.5:1 normal text, 3:1 large text / UI components)

| Color Pair | Ratio | Result | Where Used |
|-----------|-------|--------|------------|
| zinc-100 (#F4F4F5) on body (#09090B) | 18.10:1 | PASS | Primary body text |
| zinc-200 (#E4E4E7) on body (#09090B) | 15.68:1 | PASS | Assistant message text |
| zinc-100 on card (#27272A) | 13.55:1 | PASS | Card content text |
| amber-300 (#FCD34D) on body | 13.80:1 | PASS | Invalid banner text |
| red-400 (#F87171) on body | 7.19:1 | PASS | Error text |
| emerald-300 (#6EE7B7) on body | 13.05:1 | PASS | Success toast text |
| indigo-400 (#818CF8) on body | 6.67:1 | PASS | Links in markdown |
| indigo-400 on card (#27272A) | 4.99:1 | PASS | Links in markdown |
| white on indigo-600 button | 6.29:1 | PASS | Primary CTA buttons |
| white on indigo-700 (hover) | 7.90:1 | PASS | Button hover state |
| zinc-400 (#A1A1AA) on body | 7.76:1 | PASS | Secondary text, labels |
| zinc-400 on card | 5.81:1 | PASS | Settings label text |
| **zinc-500 (#71717A) on body** | **4.12:1** | **FAIL (normal text)** | Placeholder text on body |
| zinc-500 on card | 3.08:1 | PASS-LARGE only | Hints, secondary card text |
| zinc-500 on panel (#18181B) | 3.67:1 | PASS-LARGE only | Nav secondary text |
| **zinc-600 (#52525B) on body** | **2.57:1** | **FAIL** | Divider text, metadata |
| **zinc-600 on card** | **1.93:1** | **FAIL** | Placeholder in inputs |
| zinc-700 (#3F3F46) on body | 1.91:1 | FAIL | Decorative dividers (not text — may be exempt as non-text) |
| indigo-500 (#6366F1) on body | 4.45:1 | PASS-LARGE only | Gradient text heading |

### Critical failures

**1. zinc-600 input placeholders (1.4.3):** `placeholder-zinc-600` on `#ob-key-input` and
`#settings-new-key` and `#msg-input` produces 1.93:1 on their respective backgrounds — far
below 4.5:1. Placeholders are not "inactive UI" exemptions; they must meet contrast.

Fix: Change `placeholder-zinc-600` to `placeholder-zinc-500` on all three inputs, which
achieves 3.08:1 (passes for large text / UI component threshold) or `placeholder-zinc-400`
for full 4.5:1 pass.

Best recommendation: `placeholder-zinc-400` (5.81:1 on card background, 7.76:1 on body).

**2. zinc-600 secondary/metadata text (1.4.3):** The following use `text-zinc-600`:
- "then paste it below" divider label in onboarding — 2.57:1 on body bg
- "Powered by OpenRouter…" footer note — 2.57:1 on panel bg
- Copy/Regenerate button text while in default (pre-hover) state — 1.93:1 on card bg

These are small normal-weight text. Fix: change to `text-zinc-500` (3.08:1 — passes for UI
component threshold) or `text-zinc-400` (5.81:1 — full AA pass for normal text).

Recommendation: use `text-zinc-500` for decorative/tertiary notes (meets 3:1 UI component)
and `text-zinc-400` for any functional text the user needs to read (meets 4.5:1).

**3. Gradient heading text — "FreeForge" title (1.4.3):** The `.gradient-text` class renders
indigo-500 to violet-500 gradient. Indigo-500 (#6366F1) on the body background measures
4.45:1 — a 0.05:1 miss for normal text AA. The heading is large (4xl = 36px, which exceeds
the 24px / 18pt threshold for large text), so **it currently passes as large text (3:1
minimum)**. No fix required, but note for AAA compliance.

**4. `text-zinc-700` divider lines and decorative borders** — these are non-text UI
components. The 3:1 requirement applies to UI components (1.4.11). At 1.91:1, these fail
1.4.11 as well, but decorative borders where the content is conveyed through other means
may qualify for the decorative exception. If the divider line is purely decorative (the "then
paste it below" separator), it is exempt. If the divider helps the user understand UI
structure, it should pass 3:1.

### Exact fixes summary (contrast)

1. All three password/message inputs: `placeholder-zinc-600` → `placeholder-zinc-400`
2. Copy/Regen buttons default state in `messages.js`: `text-zinc-600` → `text-zinc-500`
3. "then paste it below" divider: `text-zinc-600` → `text-zinc-500`
4. "Powered by OpenRouter…" footer: `text-zinc-700` → `text-zinc-500`

---

## Summary Table — All Gaps with WCAG Mapping

| # | Component | Gap | WCAG Criterion | Fix |
|---|-----------|-----|----------------|-----|
| A1 | Message list | No `role="log"` / `aria-live` on `#msgs-list` | 4.1.3 | Add `role="log" aria-live="polite" aria-label="Chat messages"` |
| A2 | Streaming | Per-token live region floods AT | 4.1.3 | Use separate `#sr-status` region; announce start + onDone only |
| A3 | Toast container | `#toasts` has no live region | 4.1.3 | Add `role="status" aria-live="polite"` |
| A4 | Thinking indicator | No announcement when streaming begins | 4.1.3 | Add `role="status" aria-label="FreeForge is thinking"` |
| B1 | Settings modal | No `role="dialog"` | 4.1.2 | Add `role="dialog"` to inner card div |
| B2 | Settings modal | No `aria-modal="true"` | 4.1.2 / 2.1.2 | Add `aria-modal="true"` |
| B3 | Settings modal | No `aria-labelledby` | 4.1.2 | Add `id="settings-title"` to h2 and `aria-labelledby="settings-title"` to dialog |
| B4 | Settings modal | No focus trap | 2.1.2 | Implement `trapFocus` keydown listener |
| B5 | Settings modal | No initial focus | 2.4.3 | Move focus to first focusable on `openSettings()` |
| B6 | Settings modal | No focus return | 2.4.3 | Store trigger, restore focus on `closeSettings()` |
| B7 | Close modal button | No accessible name | 4.1.2 | Add `aria-label="Close settings"` |
| C1 | Settings gear | `title` only, no `aria-label` | 4.1.2 | Add `aria-label="Settings"`; add `aria-hidden` to SVG |
| C2 | Send/Stop button | No accessible name; state change unannounced | 4.1.2 | Add `aria-label="Send message"`; update to `"Stop generation"` in `setStreamMode` |
| C3 | Password toggle (onboarding) | No accessible name or state | 4.1.2 | Add `aria-label="Show password" aria-pressed="false" aria-controls="ob-key-input"` |
| C4 | New Chat (mobile) | Visible text hidden by `hidden sm:block` | 4.1.2 | Add `aria-label="New chat"` to button |
| D1 | API key inputs | `<label>` not associated via `for` | 1.3.1 | Add `for="ob-key-input"` and `for="settings-new-key"` to labels |
| D2 | API key inputs | Error paragraphs not linked | 1.3.1 | Add `aria-describedby="ob-key-error"` / `"settings-key-error"` to inputs |
| D3 | API key inputs | `aria-invalid` not set on error | 4.1.2 | Set/remove `aria-invalid="true"` in showObError/hideObError and updateKey |
| D4 | Masked key display | No accessible name | 1.3.1 | Add `aria-label="Current API key (masked)"` to `#settings-key-display` |
| D5 | Textarea | No explicit label, placeholder only | 1.3.1 | Add `<label for="msg-input" class="sr-only">Message</label>` |
| E1 | Navigation | No skip link | 2.4.1 Bypass Blocks | Add skip link to `#msg-input` |
| E2 | All interactive elements | Inconsistent focus visibility | 2.4.7 Focus Visible | Add `:focus-visible` CSS rule |
| F1 | Input placeholders | zinc-600 placeholder = 1.93:1 contrast | 1.4.3 | Change to `placeholder-zinc-400` |
| F2 | Copy/Regen buttons | Default `text-zinc-600` = 1.93:1 on card | 1.4.3 | Change to `text-zinc-500` |
| F3 | Divider / footer text | `text-zinc-600` = 2.57:1 on backgrounds | 1.4.3 | Change to `text-zinc-500` |

---

## Phased Remediation Order

Phase 1 — Critical (blocks AT use entirely):
- A1, A2, A3 (live regions — without these, a screen reader user cannot follow the conversation)
- B1–B6 (modal traps focus in background without role/focus trap)
- D1, D2 (inputs are effectively unlabeled)
- F1 (placeholders at 1.93:1 — worst visual contrast)

Phase 2 — High (significantly degrades AT experience):
- A4 (thinking state feedback)
- B7, C1–C4 (all icon-only button names)
- D3, D4, D5 (error state and additional labeling)
- E1 (skip link)

Phase 3 — Medium (polish and WCAG completeness):
- E2 (focus visibility)
- F2, F3 (secondary text contrast)

---

## Sources

- [WAI-ARIA Authoring Practices Guide — Dialog Modal Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)
- [WAI-ARIA Authoring Practices Guide — Alert Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/alert/)
- [MDN — ARIA Live Regions](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Guides/Live_regions)
- [Sara Soueidan — Accessible Notifications with ARIA Live Regions Part 1](https://www.sarasoueidan.com/blog/accessible-notifications-with-aria-live-regions-part-1/)
- [Sara Soueidan — Accessible Icon Buttons](https://www.sarasoueidan.com/blog/accessible-icon-buttons/)
- [Make Things Accessible — Accessible Password Reveal Input](https://www.makethingsaccessible.com/guides/make-an-accessible-password-reveal-input/)
- [TestParty — Accessible Modal Dialogs: Focus Trapping and Screen Reader Support](https://testparty.ai/blog/modal-dialog-accessibility)
- [A11Y Collective — ARIA Live Regions Complete Guide](https://www.a11y-collective.com/blog/aria-live/)
- [A11Y Collective — Modal Accessibility](https://www.a11y-collective.com/blog/modal-accessibility/)
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
- [W3C WCAG 2.1 Understanding 1.4.3 Contrast Minimum](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html)
- [W3C WCAG 2.1 Understanding 4.1.3 Status Messages](https://www.w3.org/WAI/WCAG21/Understanding/status-messages.html)
- [NVDA issue #7906 — live regions created dynamically not announced](https://github.com/nvaccess/nvda/issues/7906)
