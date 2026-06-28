# Phase 1: Security Hardening - Pattern Map

**Mapped:** 2026-06-04
**Files analyzed:** 7 (6 modifications + 1 deletion)
**Analogs found:** 6 / 6 (deletion has no analog requirement)

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `freeforge/index.html` | config | request-response | self (existing file) | self |
| `freeforge/src/markdown.js` | utility | transform | self (existing file) | self |
| `freeforge/src/state.js` | utility/store | CRUD | self (existing file) | self |
| `freeforge/src/features/onboarding.js` | feature | request-response | `freeforge/src/features/settings.js` | exact |
| `freeforge/src/features/settings.js` | feature | request-response | `freeforge/src/features/onboarding.js` | exact |
| `freeforge/src/app.js` | controller | request-response | self (existing file) | self |
| `freeforge.html` (root) | — | — | — | DELETE — no analog needed |

---

## Pattern Assignments

### `freeforge/index.html` (config — SEC-02, SEC-03, SEC-05)

**Change type:** In-place edits to `<head>` section only.

**Current script tags** (lines 9-14 — to be replaced):
```html
  <script src="https://cdn.jsdelivr.net/npm/marked@9.1.6/marked.min.js"
          integrity="sha384-odPBjvtXVM/5hOYIr3A1dB+flh0c3wAT3bSesIOqEGmyUA4JoKf/YTWy0XKOYAY7"
          crossorigin="anonymous"></script>
  <script src="https://cdn.jsdelivr.net/npm/dompurify@3.1.6/dist/purify.min.js"
          integrity="sha384-+VfUPEb0PdtChMwmBcBmykRMDd+v6D/oFmB3rZM/puCMDYcIvF968OimRh4KQY9a"
          crossorigin="anonymous"></script>
```

**Target script tags** (SEC-02 + SEC-03 with verified hashes):
```html
  <script src="https://cdn.jsdelivr.net/npm/marked@18.0.4/lib/marked.umd.js"
          integrity="sha384-8RA8Ah4c9upJmKfg5nH01OgjZoQ3mRX+ngrKYWXQYj2dHYxFqYz8POSlii33f0wB"
          crossorigin="anonymous"></script>
  <script src="https://cdn.jsdelivr.net/npm/dompurify@3.4.8/dist/purify.min.js"
          integrity="sha384-jrsBdrv4eDpEYIq32u13DPbvB6tRmqIDnA6UlgFBoexpetaiWi7g/VbfMEL1WVen"
          crossorigin="anonymous"></script>
```

**Current `<head>` meta block** (lines 4-6 — insertion point for CSP):
```html
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>FreeForge — Free AI Chat</title>
```

**Target `<head>` meta block** (SEC-05 — CSP inserted after viewport, before title):
```html
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy"
        content="default-src 'none'; script-src 'self' cdn.tailwindcss.com cdn.jsdelivr.net; worker-src cdn.tailwindcss.com blob:; connect-src https://openrouter.ai; style-src 'unsafe-inline'; object-src 'none'">
  <title>FreeForge — Free AI Chat</title>
```

**Critical note:** The marked v18 path changed. `/marked.min.js` at the root is a 404 in v18. Use `/lib/marked.umd.js`. Loading order (marked → DOMPurify) must be preserved.

---

### `freeforge/src/markdown.js` (utility, transform — SEC-04, SEC-07)

**Analog:** self (entire file is 14 lines — full content already in context)

**Current full file** (`freeforge/src/markdown.js` lines 1-14):
```javascript
import { esc } from './state.js';

export function renderMd(text) {
  if (!text) return '';
  try {
    marked.setOptions({ breaks: true, gfm: true });
    const raw = marked.parse(text);
    // Sanitize LLM-generated HTML before injecting into the DOM.
    // DOMPurify is loaded via CDN in index.html.
    return typeof DOMPurify !== 'undefined' ? DOMPurify.sanitize(raw) : raw;
  } catch {
    return esc(text).replace(/\n/g, '<br>');
  }
}
```

**Target full file** (SEC-07: move marked.use() to module init; SEC-04: fix XSS in ternary else):
```javascript
import { esc } from './state.js';

// Module-level initialization (SEC-07): call once at module load, not per-render.
// marked.use() must not be called inside a function or loop per marked.js docs.
marked.use({ breaks: true, gfm: true });

export function renderMd(text) {
  if (!text) return '';
  try {
    const raw = marked.parse(text);
    // Sanitize LLM-generated HTML before injecting into the DOM.
    // SEC-04: fallback to escaped text (not raw HTML) when DOMPurify is unavailable.
    return typeof DOMPurify !== 'undefined' ? DOMPurify.sanitize(raw) : esc(text).replace(/\n/g, '<br>');
  } catch {
    return esc(text).replace(/\n/g, '<br>');
  }
}
```

**Two precise changes:**
1. Remove `marked.setOptions({ breaks: true, gfm: true });` from inside `renderMd`. Add `marked.use({ breaks: true, gfm: true });` at module top-level (after the import, before the export).
2. In the ternary on line 10, change `: raw` to `: esc(text).replace(/\n/g, '<br>')`. The XSS vector is the ternary **else branch** (`raw`), NOT the catch branch (which already uses `esc`).

---

### `freeforge/src/state.js` (utility/store — SEC-06)

**Analog:** self (existing LS object on lines 20-24 — same try/catch localStorage pattern)

**Existing `LS` pattern to copy** (`freeforge/src/state.js` lines 20-24):
```javascript
export const LS = {
  get(k) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  del(k) { try { localStorage.removeItem(k); } catch {} },
};
```

**New exports to add** (after line 28 — after the `esc`/`uid` one-liners, before `maskKey`):
```javascript
export function getStoredKey() {
  try { return localStorage.getItem('ff_key'); } catch { return null; }
}
export function setStoredKey(key) {
  try { localStorage.setItem('ff_key', key); } catch {}
}
```

**Pattern notes:**
- Try/catch wrapping matches the existing `LS` style.
- Use `localStorage.getItem/setItem` directly — do NOT route through `LS.get/LS.set`. `LS.set` calls `JSON.stringify`, which double-encodes strings (stores `"\"sk-or-v1-...\""` instead of the raw key).
- These are peer-level named exports (like `maskKey`, `fmtCtx`), not methods on the `LS` object.

---

### `freeforge/src/features/onboarding.js` (feature — SEC-06)

**Analog:** `freeforge/src/features/settings.js` (identical pattern — both are async feature modules with `import { S, $ } from '../state.js'`)

**Current import line** (line 1):
```javascript
import { S, $ } from '../state.js';
```

**Target import line** (add `setStoredKey`):
```javascript
import { S, $, setStoredKey } from '../state.js';
```

**Current localStorage call** (line 22, inside `validateAndConnect` try block):
```javascript
    localStorage.setItem('ff_key', key);
```

**Target call:**
```javascript
    setStoredKey(key);
```

**Surrounding context for positioning** (lines 19-24):
```javascript
    const models = await fetchFreeModels(key);
    if (!models.length) { showObError('No free models found for this key'); return; }
    S.apiKey = key;
    S.models = models;
    localStorage.setItem('ff_key', key);   // ← line 22, this line changes
    toast('Connected successfully!', 'success');
```

---

### `freeforge/src/features/settings.js` (feature — SEC-06)

**Analog:** `freeforge/src/features/onboarding.js` (same pattern)

**Current import line** (line 1):
```javascript
import { S, $, LS, maskKey } from '../state.js';
```

**Target import line** (add `setStoredKey`):
```javascript
import { S, $, LS, maskKey, setStoredKey } from '../state.js';
```

**Current localStorage call** (line 33, inside `updateKey` try block):
```javascript
    localStorage.setItem('ff_key', key);
```

**Target call:**
```javascript
    setStoredKey(key);
```

**Surrounding context for positioning** (lines 30-35):
```javascript
    const models = await fetchFreeModels(key);
    S.apiKey = key;
    S.models = models;
    localStorage.setItem('ff_key', key);   // ← line 33, this line changes
    $('settings-key-display').textContent = maskKey(key);
    $('settings-new-key').value = '';
```

**Do NOT change** line 53: `['ff_key', 'ff_msgs', 'ff_model'].forEach(k => LS.del(k))` — this is a `removeItem` (delete), not a write. SEC-06 only centralizes reads and writes. The `LS.del` call is correct and out of scope.

---

### `freeforge/src/app.js` (controller — SEC-06)

**Current import line** (line 1):
```javascript
import { S, $, LS } from './state.js';
```

**Target import line** (add `getStoredKey`):
```javascript
import { S, $, LS, getStoredKey } from './state.js';
```

**Current localStorage call** (line 11, inside `init` function):
```javascript
  const savedKey = localStorage.getItem('ff_key');
```

**Target call:**
```javascript
  const savedKey = getStoredKey();
```

**Surrounding context for positioning** (lines 10-14):
```javascript
async function init() {
  const savedKey = localStorage.getItem('ff_key');   // ← line 11, this line changes
  if (!savedKey) { showScreen('onboarding'); return; }

  S.apiKey = savedKey;
```

---

### `freeforge.html` (root — SEC-01)

**Action:** Delete the file. No pattern extraction needed.

**Verification:** After deletion, confirm `freeforge.html` no longer exists at the repo root. The maintained entry point is `freeforge/index.html`.

---

## Shared Patterns

### try/catch for localStorage
**Source:** `freeforge/src/state.js` lines 20-24 (`LS` object)
**Apply to:** The new `getStoredKey` and `setStoredKey` functions in `state.js`
```javascript
// Wrap every localStorage call — throws in private browsing / storage-full scenarios
try { return localStorage.getItem(k); } catch { return null; }
try { localStorage.setItem(k, v); } catch {}
```

### Named export function style
**Source:** `freeforge/src/state.js` lines 30-40 (`maskKey`, `fmtCtx`)
**Apply to:** `getStoredKey` and `setStoredKey` in `state.js`
```javascript
export function maskKey(k) {
  if (!k || k.length < 8) return '••••••••';
  return k.slice(0, 6) + '••••••••••••' + k.slice(-4);
}
```
Pattern: named `export function`, no default exports, one concern per function.

### Import extension and path convention
**Source:** All existing feature files (e.g., `freeforge/src/features/onboarding.js` line 1)
**Apply to:** All import additions in this phase
```javascript
import { S, $ } from '../state.js';       // features use ../state.js
import { S, $, LS } from './state.js';    // app.js uses ./state.js
```
Always relative with `.js` extension; no barrel index files.

---

## No Analog Found

None — all files are in-place modifications to existing files with clear self-analogs or sibling-file analogs.

---

## Metadata

**Analog search scope:** `freeforge/src/` — all 7 target files read directly
**Files read:** 7 source files + 2 planning docs
**Pattern extraction date:** 2026-06-04
