# Phase 3: Accessibility - Research

**Researched:** 2026-06-27
**Domain:** Browser accessibility - WCAG 2.1 AA critical path, ARIA semantics, focus management, visual contrast
**Confidence:** HIGH

---

## User Constraints

### Phase Scope
- Phase 3 is the accessibility phase for the current vanilla JS chat UI.
- The work is a retrofit on the existing app, not a redesign or framework rewrite.
- No new packages are required. The changes are HTML, CSS, and JavaScript only.

### Locked Implementation Constraints
- `aria-live` regions must exist in static HTML before JavaScript writes to them.
- The settings modal must trap focus, restore focus on close, and ignore hidden elements.
- The send control must expose the current stream state to assistive tech.
- Icon-only controls need explicit accessible names.
- Placeholder text cannot be treated as a substitute for labels.
- The CSS layer needs a screen-reader-only utility and a visible `:focus-visible` rule.

### Current Code Reality
- Some accessibility work is already present in `freeforge/index.html`.
- The remaining work is mostly completion, consistency, and state synchronization.
- The modal semantics are already partially in place, so the phase is not starting from zero.

---

## Phase Requirements

| ID | Requirement | Current Status | Research Note |
|----|-------------|----------------|---------------|
| A11Y-01 | Add `role="log" aria-label="Chat history" aria-live="polite"` to `#msgs-list` | Missing | Message history needs a stable live region for completed assistant/user messages. |
| A11Y-02 | Add static `#sr-status` and `#sr-alert` regions before `</body>` | Missing | These must be in the initial HTML, not injected later. |
| A11Y-03 | Announce streaming lifecycle in `chat.js` | Missing | Use the static live regions for start, complete, and error announcements. |
| A11Y-04 | Fix settings modal semantics | Already present | `role="dialog"`, `aria-modal="true"`, `aria-labelledby="settings-title"`, and `id="settings-title"` already exist. |
| A11Y-05 | Implement focus trap in `settings.js` | Partial | Focus trapping exists, but hidden-element filtering and restore-focus behavior need to be treated as first-class. |
| A11Y-06 | Wire labels, descriptions, and invalid state for inputs | Missing | `ob-key-input` and `settings-new-key` need `for`, `aria-describedby`, and `aria-invalid` handling. |
| A11Y-07 | Add labels for icon-only interactive elements | Partial | Several buttons already have labels, but the stateful send control still needs a stream-aware name. |
| A11Y-08 | Sync send/stop accessible name with stream state | Partial | `setStreamMode()` already changes the label, but the string should match the requirement exactly. |
| A11Y-09 | Improve placeholder contrast | Missing | `placeholder-zinc-600` is too dim for the required contrast target. |
| A11Y-10 | Add skip link | Missing | This should be the first focusable element in `<body>`. |
| A11Y-11 | Add `aria-pressed` to password visibility toggle | Missing | A toggle needs explicit state, not just an action label. |
| A11Y-12 | Add `.sr-only` and `:focus-visible` styling | Missing | These utilities belong in `styles/app.css`. |

---

## Summary

Phase 3 is a semantic and interaction pass over an already functional interface. The work concentrates on making the chat flow perceivable to screen readers, making the settings modal keyboard-safe, and fixing labels and contrast so the UI meets WCAG AA expectations without changing the product shape.

The current codebase already has some of the modal and button semantics in place, which lowers the risk of the phase. The main hazards are not architectural. They are sequencing issues: live regions must be static, focus trap logic must not include hidden nodes, and stateful controls must update their accessible names when the UI changes.

---

## Architectural Responsibility Map

| Capability | Primary File | Secondary File(s) | Why It Belongs There |
|------------|--------------|-------------------|----------------------|
| Chat history live region | `freeforge/index.html` | `freeforge/src/ui/messages.js` | The region must exist before JS runs, while message rendering updates its contents. |
| Streaming announcements | `freeforge/index.html` | `freeforge/src/features/chat.js` | The live regions are static; the streaming lifecycle is announced from the chat flow. |
| Modal semantics | `freeforge/index.html` | `freeforge/src/features/settings.js` | The dialog role and label live in HTML; focus trapping and restore-focus live in JS. |
| Label wiring | `freeforge/index.html` | `freeforge/src/features/onboarding.js`, `freeforge/src/features/settings.js` | Labels and error associations must match the actual input controls. |
| Stream-state naming | `freeforge/src/ui/messages.js` | `freeforge/src/features/chat.js` | The send button name changes when the stream switches between send and stop modes. |
| Screen-reader-only utilities | `freeforge/styles/app.css` | `freeforge/index.html` | The utility class and focus styles are CSS, but the HTML uses them directly. |

---

## Verified Current State

### Already in place
- The settings modal already has `role="dialog"`, `aria-modal="true"`, and `aria-labelledby="settings-title"`.
- The settings heading already has `id="settings-title"`.
- Several icon-only controls already have explicit labels, including settings, new chat, close settings, and the onboarding eye toggle.
- The send button already toggles icon state in `setStreamMode()`.

### Still missing or incomplete
- No static screen-reader live regions exist in `index.html`.
- `#msgs-list` does not yet expose the chat history as a live log.
- Input labels are not tied to inputs with `for`.
- Validation messages are present but not consistently described by the inputs.
- The send button label uses a state change, but the wording is not aligned with the requirement.
- The password visibility toggle has a changing label but no pressed state.
- Placeholder color is still too low contrast.
- There is no skip link.
- There is no `.sr-only` utility or visible `:focus-visible` outline rule in `styles/app.css`.

---

## Standard Stack

No additional dependencies are needed.

| Layer | Tooling | Purpose |
|------|---------|---------|
| HTML | Native semantic elements and ARIA | Live regions, dialog semantics, skip link, label wiring |
| JavaScript | Vanilla DOM APIs | Focus trap, state announcements, accessible name updates |
| CSS | Existing stylesheet | `.sr-only`, visible focus indicators, placeholder contrast fixes |
| Assistive tech | Browser accessibility tree | Final validation target |

---

## Implementation Patterns

### Pattern 1: Static live regions in HTML

Use two always-present regions near the end of `<body>`:

```html
<div id="sr-status" class="sr-only" aria-live="polite" aria-atomic="true"></div>
<div id="sr-alert" class="sr-only" role="alert" aria-live="assertive" aria-atomic="true"></div>
```

Why this matters:
- Screen readers are much more reliable when the live regions exist before any JS writes to them.
- `polite` is appropriate for normal progress updates.
- `assertive` is reserved for errors that should interrupt the current flow.

### Pattern 2: Log semantics for chat history

The message list should become a live log:

```html
<div id="msgs-list" role="log" aria-label="Chat history" aria-live="polite"></div>
```

Why this matters:
- The chat transcript is a dynamic log, not a generic `div`.
- The accessible label gives the region a purpose when jumped to by a screen reader.

### Pattern 3: Stateful accessible names

The send button should expose its current function:

```javascript
$('send-btn').setAttribute('aria-label', active ? 'Stop generating' : 'Send message');
```

Why this matters:
- A single icon-only control changes meaning based on stream state.
- A static label makes the button misleading once streaming starts.

### Pattern 4: Hidden-element-safe focus trapping

The modal trap should ignore non-visible controls:

```javascript
const focusable = [...modal.querySelectorAll(
  'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
)].filter(el => !el.closest('.hidden') && el.offsetParent !== null);
```

Why this matters:
- Tailwind uses `.hidden` for display-none states.
- `offsetParent !== null` filters out elements that are not actually visible.

### Pattern 5: Explicit label and validation coupling

Use `for`, `aria-describedby`, and `aria-invalid` together:

```html
<label for="ob-key-input">API Key</label>
<input id="ob-key-input" aria-describedby="ob-key-error" aria-invalid="false">
<p id="ob-key-error" hidden></p>
```

Why this matters:
- Labels make the control discoverable.
- `aria-describedby` ties the error to the control.
- `aria-invalid` exposes validation state to assistive tech.

### Pattern 6: Non-color focus affordance

Add a visible keyboard focus style in CSS:

```css
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

:focus-visible {
  outline: 2px solid #818cf8;
  outline-offset: 2px;
}
```

Why this matters:
- Keyboard users need a visible focus indicator.
- A purely color-based hover treatment is not enough.

---

## Anti-Patterns To Avoid

- Do not create the live regions lazily in JavaScript.
- Do not use `title` as the only accessible name for an interactive control.
- Do not rely on placeholder text as a label.
- Do not trap focus across hidden modal elements.
- Do not leave the send button with a generic label once streaming starts.
- Do not omit `aria-pressed` for a toggle that changes visibility state.
- Do not treat settings modal semantics as complete just because `role="dialog"` is present.

---

## Common Pitfalls

### Pitfall 1: Dynamic live regions arrive too late

If `#sr-status` or `#sr-alert` are injected after load, some screen reader and browser combinations will not announce subsequent updates reliably.

### Pitfall 2: The modal looks accessible but still leaks focus

`role="dialog"` and `aria-modal="true"` help, but they do not trap keyboard focus by themselves. The JS trap and restore-focus behavior are still required.

### Pitfall 3: Hidden elements sneak into the tab order

Tailwind-managed `.hidden` nodes can still be found by naive selector logic unless the trap filters for visibility, not just markup presence.

### Pitfall 4: Icon-only buttons are not fixed by `aria-hidden` on the icon

Hiding the SVG does not label the button. The button itself needs a meaningful label.

### Pitfall 5: Placeholder contrast is not optional

Even if the placeholder is only advisory, it still needs to be readable enough to satisfy the intended accessibility target.

### Pitfall 6: Toggle buttons need state, not just action

The password visibility control should tell assistive tech whether the value is currently shown or hidden, not just what the button does.

---

## State of the Art

| Old Approach | Current Accessibility Pattern | Why It Is Better |
|--------------|-------------------------------|------------------|
| Injecting live regions on demand | Static `aria-live` regions in HTML | More reliable announcements across screen readers |
| Modal with only `role="dialog"` | Dialog role plus focus trap and restore-focus | Prevents keyboard escape and keeps context stable |
| Icon-only control with visual hint only | Icon-only control plus explicit accessible name | Works for screen readers and keyboard users |
| Placeholder used as a label substitute | Real label plus descriptive helper/error text | Better discoverability and validation feedback |
| Focus ring removed or weak | `:focus-visible` outline | Preserves keyboard navigation without visual clutter for mouse users |

---

## Assumptions Log

| # | Assumption | Risk if Wrong | Mitigation |
|---|------------|---------------|------------|
| A1 | The current modal markup is intentionally the base to extend, not replace | Low | The existing dialog semantics are already in place in `index.html`. |
| A2 | No new dependencies are needed for the accessibility pass | Low | The current stack already provides everything required. |
| A3 | The chat history should be treated as a log region rather than a generic container | Low | This matches the phase requirement and the dynamic nature of the UI. |
| A4 | The send control should use one button with a changing label, not separate send/stop buttons | Low | The current DOM structure already follows the single-button pattern. |

---

## Sources

### Primary
- `freeforge/index.html`
- `freeforge/src/app.js`
- `freeforge/src/features/chat.js`
- `freeforge/src/features/settings.js`
- `freeforge/src/ui/messages.js`
- `freeforge/styles/app.css`
- `.planning/workstreams/milestone/REQUIREMENTS.md`
- `.planning/research/SUMMARY.md`

### Notes
- All findings in this document come from direct codebase inspection.
- No new libraries, build steps, or runtime services are required for Phase 3.

---

## RESEARCH COMPLETE

Implementation constraints:
- Static HTML must own the live regions and skip link so assistive tech sees them at DOM-ready.
- JS should only handle announcements, focus trapping, restore-focus, and stateful accessible-name updates.
- CSS must provide `.sr-only`, visible keyboard focus styling, and higher-contrast placeholder text.
- The phase is a low-risk retrofit: no new dependencies, no layout rewrite, and no change to the app's core flow.
