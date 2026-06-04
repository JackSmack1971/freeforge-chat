# Domain Pitfalls

**Domain:** Browser-only LLM chat app — SSE streaming + localStorage + vanilla JS
**Project:** FreeForge
**Researched:** 2026-06-04
**Scope:** Specific to SSE streaming, localStorage, LLM markdown output, and mobile UX

All pitfalls are tied to actual code locations in the existing implementation.

---

## Critical Pitfalls

Mistakes that cause silent data loss, broken UI state, or security regressions.

---

### Pitfall 1: OpenRouter SSE Comment Lines Silently Dropped, Mid-Stream Error Objects Cause Silent Empty Response

**What goes wrong:** OpenRouter sends two non-standard SSE line types that the current parser (api.js:68) ignores:

1. Keepalive comment lines: `: OPENROUTER PROCESSING` — these begin with `:`, not `data: `, so they pass harmlessly through the filter. No bug here, but worth noting they exist.
2. Mid-stream error objects: when a provider fails after tokens have already been sent (HTTP status is already 200), OpenRouter sends `data: {"error": {"code":"server_error","message":"..."}, "choices":[{"delta":{"content":""},"finish_reason":"error"}]}`. The current code parses this successfully, BUT `j.choices?.[0]?.delta?.content` is an empty string `""`, which is falsy — so the `if (delta)` guard on line 74 silently drops it. `onDone(full)` is called with whatever partial text was streamed, with no error surface.

**Why it happens:** The guard `if (delta)` was written to skip empty-string deltas in normal SSE padding, but it also swallows the error signal. The `finish_reason: "error"` field is never checked.

**Consequences:** User sees a truncated or empty assistant message with no error toast. For responses that error after a few tokens the user gets a garbage partial message saved to localStorage and replayed on reload.

**Prevention:**
```javascript
// In the SSE parse loop (api.js ~line 72):
const j = JSON.parse(raw);
// Check for mid-stream error before accessing delta
if (j.error) { onError(j.error.message || 'Provider error during stream.'); return; }
const finishReason = j.choices?.[0]?.finish_reason;
if (finishReason === 'error') { onError('Stream terminated by provider.'); return; }
const delta = j.choices?.[0]?.delta?.content;
if (delta) { full += delta; onToken(delta, full); }
```

**Detection:** Test by switching to a model that is at its free-tier daily limit mid-conversation. The stream returns HTTP 200 then sends an error object. Without the fix, the assistant bubble appears empty or partial, no toast fires.

**Phase:** QUAL-06 (Error resilience)

---

### Pitfall 2: AbortController Abort Does Not Release the ReadableStream Reader

**What goes wrong:** When the user clicks Stop (or `newChat()` calls `abort()`), the fetch is aborted via `S.abort.abort()`. The fetch rejects with `AbortError`, but the `reader` variable inside `streamCompletion` still holds a lock on `res.body`. The browser may not release the underlying TCP connection or stream resources until the reader is explicitly cancelled.

In `api.js` the outer try/catch on `reader.read()` catches the `AbortError` and returns — but `reader.cancel()` is never called. This means `res.body` remains locked. On browsers with strict stream lifecycle enforcement (Safari, some Chromium versions) this can cause "Failed to execute 'getReader' on 'ReadableStream': ReadableStream is already locked" on a subsequent request if any internal reference is retained.

**Why it happens:** `AbortController` cancels the fetch network request; it does not automatically call `reader.cancel()` on a reader that already holds the lock. These are separate lifecycles.

**Consequences:** Memory is not immediately freed. In extended sessions with many stop-and-restart cycles, stream reader objects accumulate. On Safari this can manifest as a visible memory increase over time.

**Prevention:**
```javascript
// Wrap the reader loop (api.js ~line 59):
const reader = res.body.getReader();
// Register abort handler to cancel the reader explicitly
const abortHandler = () => { reader.cancel().catch(() => {}); };
ctrl.signal.addEventListener('abort', abortHandler, { once: true });

try {
  // ... existing while loop ...
} catch (e) {
  if (e.name !== 'AbortError') onError('Stream interrupted.');
  return;
} finally {
  ctrl.signal.removeEventListener('abort', abortHandler);
}
```

**Detection:** Open DevTools Memory tab. Start a stream, click Stop, start again — repeat 10x. Watch for growing heap in Safari or Chromium memory inspector.

**Phase:** QUAL-06 (Error resilience)

---

### Pitfall 3: localStorage Write in Private Browsing Throws SecurityError — Silently Swallowed but API Key Never Persisted

**What goes wrong:** Safari in Private Browsing mode, and some locked-down corporate browsers, throw a `SecurityError` (not `QuotaExceededError`) on any `localStorage.setItem()` call. The `LS.set()` wrapper in `state.js` catches all exceptions silently — which is correct. However, in `onboarding.js` line 22, the key is written with the raw `localStorage.setItem('ff_key', key)` call (not via `LS.set`), with no try/catch. This raw call throws and surfaces as an uncaught exception, crashing the onboarding flow after validation succeeds.

Similarly, `settings.js` line 32 uses raw `localStorage.setItem('ff_key', key)` without protection.

**Why it happens:** Two code paths bypass the safe `LS` wrapper and call `localStorage.setItem` directly.

**Consequences:** In Private Browsing, the user passes key validation, sees "Connected successfully!" toast, but the page crashes before transitioning to the chat screen. On reload, onboarding shows again — infinite loop. The user thinks their key is invalid.

**Prevention:**
Replace the two raw calls:
```javascript
// onboarding.js line 22 — replace:
localStorage.setItem('ff_key', key);
// with:
LS.set('ff_key', key);

// settings.js line 32 — replace:
localStorage.setItem('ff_key', key);
// with:
LS.set('ff_key', key);

// Also in app.js line 11, the initial key read uses raw localStorage.getItem.
// That is read-only and does not throw, so it is safe.
```

Additionally, after `LS.set('ff_key', key)` verify the write succeeded by reading it back:
```javascript
const wrote = LS.get('ff_key');
if (!wrote) toast('Note: key not persisted (private browsing mode)', 'warning');
```

**Detection:** Open Safari → Private Window → open freeforge → paste API key → click Save & Connect. Without fix: JavaScript error in console, screen does not transition.

**Phase:** QUAL-06 (Error resilience) — also touches QUAL-03 (code review)

---

### Pitfall 4: DOMPurify Version 3.1.6 Has Known mXSS Bypass (CVE-2025-26791)

**What goes wrong:** The project pins DOMPurify at 3.1.6 (freeforge/index.html line 13). CVE-2025-26791 is a confirmed mutation XSS in DOMPurify before 3.2.4, caused by a regex bug in template literal handling. LLM output is untrusted user-controlled content and the exact attack class (mXSS via template literals) is reachable via model-generated responses containing JavaScript template literal syntax inside HTML attributes.

The root HTML alias `freeforge.html` does not load DOMPurify at all — the fallback in `markdown.js` line 8 skips sanitization entirely if `typeof DOMPurify === 'undefined'`.

**Why it happens:** The SRI hash was set at pinning time and has not been updated. The root alias file pre-dates DOMPurify integration.

**Consequences:** A malicious LLM response (prompt injection) could execute arbitrary JavaScript in the user's browser, exfiltrate the API key from localStorage, or perform clickjacking. For a portfolio project this is a significant credibility issue if a reviewer notices the version is behind a public CVE.

**Prevention:**
1. Upgrade to DOMPurify >= 3.2.4 (current: 3.2.4 as of June 2026) and update the SRI hash.
2. Add DOMPurify to `freeforge.html` with the same version and SRI.
3. In `markdown.js`, treat missing DOMPurify as a hard failure rather than a silent skip:
```javascript
export function renderMd(text) {
  if (!text) return '';
  if (typeof DOMPurify === 'undefined') {
    // CDN failed — fall back to plain text, never raw HTML
    return `<pre class="text-zinc-200 text-sm whitespace-pre-wrap break-words">${esc(text)}</pre>`;
  }
  try {
    marked.setOptions({ breaks: true, gfm: true });
    return DOMPurify.sanitize(marked.parse(text));
  } catch {
    return esc(text).replace(/\n/g, '<br>');
  }
}
```

**Detection:** Check `https://cdn.jsdelivr.net/npm/dompurify@3.1.6/` — it exists. Search NVD for CVE-2025-26791 — confirmed.

**Phase:** QUAL-04 (Security hardening) — highest priority

---

## Moderate Pitfalls

---

### Pitfall 5: Model Deprecated or Removed Mid-Session Returns 404 — Treated as Generic Error

**What goes wrong:** OpenRouter free-tier models are frequently retired. When a previously saved model ID (in localStorage `ff_model`) is no longer available, the API returns HTTP 404. The current error handler in `api.js` lines 44-52 has no 404 case — it falls through to `onError(\`Request failed (404)\`)`, which is accurate but not actionable.

More critically, during `loadModels()` at app startup the saved model ID is validated against the fetched list (models.js line 27-28). If the saved ID is gone from the list, the code correctly falls through to the preferred list and picks a new default. But if the user had a model selected in-session (no reload) and that model gets deprecated during their session, the next message uses the stale `S.selectedModel`. The API returns 404 and the user sees a generic error with no indication that changing the model would fix it.

**Why it happens:** The 404 path is unhandled. The preferred fallback list in models.js (lines 33-41) runs only at load time, not dynamically.

**Prevention:**
```javascript
// api.js — add to the !res.ok block:
else if (res.status === 404) {
  onError('Model not found — it may have been retired. Select a different model.');
  // Optionally trigger a model list refresh:
  // import { loadModels } from './features/models.js'; loadModels(S.apiKey);
}
```

Also add a model-change prompt: when 404 occurs, briefly highlight the model selector (CSS outline flash) so the user knows where to look.

**Detection:** Manually set `S.selectedModel` in console to a non-existent model ID (`"fake/model:free"`), then send a message.

**Phase:** QUAL-06 (Error resilience)

---

### Pitfall 6: OpenRouter 402 (Quota Exhausted) Is Indistinguishable from Billing Error to the User

**What goes wrong:** The API returns HTTP 402 when the account has insufficient credits — even for free-tier models if the free daily limit is exhausted. The current error handler has no 402 case. It falls through to `onError('Request failed (402)')`.

402 is semantically distinct from 429 (rate limit, temporary, retry later) and from 401 (bad key). A 402 means "your free quota is exhausted for today." The correct user action is to wait until daily reset or check account limits — not to retry or change the key.

**Prevention:**
```javascript
// api.js — add to the !res.ok block:
else if (res.status === 402) {
  onError('Free usage limit reached. Try again tomorrow or check your OpenRouter account.');
}
```

**Detection:** Check OpenRouter account usage against daily free limits, or search the response body for "insufficient credits" text.

**Phase:** QUAL-06 (Error resilience)

---

### Pitfall 7: SSE Buffer Splits `data:` Prefix Across Two Chunks

**What goes wrong:** The buffer logic in api.js splits on `\n` and processes complete lines. This correctly handles JSON split across chunks. However, it does not handle the case where the SSE `data: ` prefix itself is split across two reads — e.g., chunk 1 ends with `da` and chunk 2 starts with `ta: {...}`. After splitting on `\n`, the line `da` does not start with `data: ` and is silently dropped. The next line `ta: {...}` also does not start with `data: ` and is also dropped.

In practice this is rare but not impossible on very slow or heavily throttled mobile connections where TCP segments are tiny. The symptom is occasional missing tokens in a response.

**Why it happens:** The SSE spec defines lines as terminated by `\n`, `\r`, or `\r\n`. The current split uses only `\n`. If OpenRouter sends `\r\n` line endings (permitted by the spec), the `\r` remains attached to the end of each parsed line. `line.trim()` handles this correctly since trim() strips `\r`. So `\r\n` is safe. The split-prefix issue is the real concern.

The split-prefix scenario for the `data: ` keyword is essentially impossible in practice because OpenRouter sends complete SSE field-name lines — the chunk boundary would have to land precisely in the 6-byte prefix. The real concern is the documented case: JSON content split across chunks, which the buffer already handles correctly.

**Verdict:** The current buffering is correct for JSON split across chunks. The trim() call handles `\r\n` endings. Risk is LOW. Document for portfolio reviewers who may ask about it.

**Prevention:** Current implementation is adequate. Add a comment in the code explaining the buffer strategy to show awareness:
```javascript
// Buffer handles JSON split across network chunks. The pop() retains any
// incomplete line (no trailing \n yet) for the next iteration. trim() handles
// both \n and \r\n SSE line endings per spec.
```

**Phase:** QUAL-06 (Error resilience) — comment only, no logic change needed

---

### Pitfall 8: iOS Virtual Keyboard Pushes Chat Input Behind Keyboard (Fixed Bottom Positioning)

**What goes wrong:** The chat input area uses `height: 100vh` (via `#screen-chat { height: 100vh }` in app.css line 9). On iOS Safari, when the virtual keyboard appears, the Layout Viewport height does not change — only the Visual Viewport shrinks. Elements with `position: fixed; bottom: 0` (the send bar) remain at the Layout Viewport bottom, which is behind the keyboard.

The current layout uses flexbox with the input at the flex end, not `position: fixed`. However, `height: 100vh` on the chat screen container still does not account for the keyboard. The messages area and input stay at their original sizes, with the input hidden behind the keyboard. The user must scroll the entire page down to see what they are typing.

**Why it happens:** iOS Safari's definition of `100vh` is the viewport height without the URL bar but also without accounting for the keyboard.

**Prevention:**
Use dynamic viewport height units, which were introduced precisely for this:
```css
/* app.css */
#screen-chat {
  flex-direction: column;
  height: 100vh;         /* fallback for browsers without dvh */
  height: 100dvh;        /* dvh = dynamic viewport height — shrinks with keyboard on iOS 15.4+ */
}
```

For iOS 15.3 and below (legacy fallback), add a VisualViewport resize listener:
```javascript
// app.js init(), after DOMContentLoaded:
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', () => {
    const chat = document.getElementById('screen-chat');
    if (chat) chat.style.height = window.visualViewport.height + 'px';
  });
}
```

`dvh` is supported in iOS Safari 15.4+ (released March 2022) and covers the overwhelming majority of active iOS devices.

**Detection:** Open on iPhone → tap message input → observe if input area is visible while keyboard is showing.

**Phase:** QUAL-02 (Mobile UX polish)

---

### Pitfall 9: No Safe-Area Inset on iPhone X+ — Input Cut Off by Home Bar

**What goes wrong:** iPhones with Face ID (iPhone X and later) have a home indicator bar at the bottom of the screen. Without `viewport-fit=cover` and `env(safe-area-inset-bottom)`, the send bar sits above the home indicator but the content may not account for the inset on all iPhone models and orientations.

The current `<meta name="viewport">` tag reads `width=device-width, initial-scale=1.0` — it does not include `viewport-fit=cover`, which is required to activate safe area CSS environment variables.

**Prevention:**
```html
<!-- freeforge/index.html -->
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
```

Then in the CSS for the input container (whatever element wraps `#msg-input` and the send button):
```css
.input-bar {
  padding-bottom: env(safe-area-inset-bottom, 0px);
}
```

The `env()` fallback of `0px` means desktop browsers are unaffected.

**Detection:** Open in iPhone Safari, rotate to landscape — check if send button overlaps home indicator.

**Phase:** QUAL-02 (Mobile UX polish)

---

### Pitfall 10: Touch Targets Below 44px on Mobile — Copy and Regenerate Buttons

**What goes wrong:** The Copy and Regenerate buttons in `messages.js` lines 78-86 use class `text-xs` with `flex items-center gap-1`. The rendered height of these buttons is approximately 20-24px — well below Apple's 44pt minimum and WCAG 2.5.5's 44x44px recommendation.

The model selector `<select>` element also lacks explicit min-height, likely rendering below 44px on mobile where the browser default is smaller.

**Prevention:**
Add minimum touch target sizing to small action buttons. The visual size can stay small; hit area is expanded with padding:
```css
/* app.css */
.copy-btn, .regen-btn {
  min-height: 44px;
  padding-top: 10px;
  padding-bottom: 10px;
}
```

Or using Tailwind: add `py-2.5` (10px top+bottom) to the button classes in `messages.js`.

For the model selector, add `min-h-[44px]` in the HTML.

**Detection:** Use Chrome DevTools mobile emulation. Inspect computed height of `.copy-btn`.

**Phase:** QUAL-02 (Mobile UX polish)

---

## Minor Pitfalls

---

### Pitfall 11: TextDecoder Instantiated on Every Chunk — No Impact on Correctness but Suboptimal

**What goes wrong:** `api.js` line 57 creates `new TextDecoder()` once per stream, which is correct. The `{ stream: true }` option on line 63 is also correct — it tells the decoder to buffer incomplete multi-byte sequences across chunks so emoji and non-ASCII characters are not corrupted. This is the right pattern.

However: if the TextDecoder were ever moved inside the loop (a common refactor mistake), every chunk would create a new stateless decoder, causing replacement characters (U+FFFD) for any multi-byte character (emoji, accented letters, CJK) that spans a chunk boundary.

**Prevention:** Add a comment to the decoder declaration flagging this:
```javascript
// Reuse dec across chunks with {stream:true} — do NOT move inside the loop.
// A fresh TextDecoder per chunk would corrupt multi-byte chars spanning boundaries.
const dec = new TextDecoder();
```

**Phase:** QUAL-03 (Code review/cleanup) — comment only

---

### Pitfall 12: `navigator.clipboard.writeText` Fails on HTTP and in Iframes

**What goes wrong:** `messages.js` line 94 calls `navigator.clipboard.writeText()`. The Clipboard API requires a secure context (HTTPS or localhost). If a user opens the app via `file://` protocol directly from their filesystem (which works for everything else in this app), `navigator.clipboard` is `undefined` on some browsers (Firefox, older Safari). The code already has `.catch(() => toast('Copy failed', 'error'))` — this surfaces correctly. However, the app is also deployable as a GitHub Pages site where HTTPS is always present, so this is not a critical issue.

The real failure mode is opening `freeforge.html` locally via double-click in Windows (which opens as `file://`) on Firefox, where clipboard access requires a user gesture AND is explicitly blocked. The toast fires but offers no alternative.

**Prevention:**
Add a fallback using the legacy `execCommand` approach:
```javascript
// In messages.js copy button handler:
const tryClipboard = async (text) => {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
  } else {
    // Fallback for file:// or non-secure contexts
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  }
};
copyBtn.addEventListener('click', () => {
  tryClipboard(msg.content)
    .then(() => { /* show "Copied!" */ })
    .catch(() => toast('Copy failed', 'error'));
});
```

**Phase:** QUAL-03 (Code review/cleanup)

---

### Pitfall 13: `renderAllMessages()` Rebuilds the Entire DOM on Every Token

**What goes wrong:** During streaming, `onToken` in `chat.js` does NOT call `renderAllMessages()` — it only updates `S.streamTarget.textContent`. That is correct and efficient. However, `onDone` calls `renderAllMessages()` which tears down and rebuilds every message element via `list.innerHTML = ''`. For long conversations (50+ messages), this causes a brief but visible repaint flash and forces re-evaluation of all event listeners. The delegated `regen-btn` handler survives since it uses document-level delegation, but `copy-btn` handlers are re-attached on every rebuild.

For typical portfolio-length conversations (5-20 messages) this is imperceptible. For users who store long conversations in localStorage and reload, the initial `renderAllMessages()` call in `app.js` also fires with the full message set.

**Prevention:** For the current scope, add a `content-visibility: auto` hint to message containers to reduce paint cost on large lists:
```css
/* app.css */
.msg-bubble {
  content-visibility: auto;
  contain-intrinsic-size: 0 80px;
}
```

Full virtual rendering is QUAL-08 scope (Performance). Do not refactor the render architecture in QUAL-06.

**Phase:** QUAL-08 (Performance) — `content-visibility` CSS can be done in QUAL-02 or QUAL-05

---

### Pitfall 14: No Free Models Returned — Onboarding Blocks Without Useful Guidance

**What goes wrong:** `onboarding.js` line 19 checks `if (!models.length)` and shows "No free models found for this key." This can happen for a valid key with no free model access (e.g., a restricted org key). The error message is accurate but does not tell the user what to do — they can't distinguish "your key is broken" from "your account doesn't have free model access."

The OpenRouter free tier requires no payment, but some API keys generated under paid org accounts may not expose free models at all.

**Prevention:**
Update the error message to be actionable:
```javascript
// onboarding.js line 19:
showObError(
  'No free models found. Ensure your OpenRouter account has free model access — ' +
  'check openrouter.ai/models?max_price=0'
);
```

**Phase:** QUAL-05 (UX polish)

---

### Pitfall 15: Corrupted JSON in localStorage `ff_msgs` Silently Becomes Empty Conversation

**What goes wrong:** `LS.get()` in `state.js` wraps `JSON.parse` in try/catch and returns `null` on failure. In `app.js` line 16-18, a `null` result is handled by the `Array.isArray()` guard — it falls through to `S.messages = []`. This is correct behavior: corrupted persisted messages result in an empty conversation rather than a crash.

However, there is no user notification. If a user had a long conversation that was corrupted (e.g., by a previous write that was interrupted by a QuotaExceededError), they silently lose it on the next reload with no explanation.

**Prevention:**
Detect the corruption and inform the user:
```javascript
// app.js init():
const savedMsgs = LS.get('ff_msgs');
if (savedMsgs === null && localStorage.getItem('ff_msgs') !== null) {
  // Item exists but failed to parse — it's corrupted
  toast('Previous conversation could not be restored (corrupted data).', 'warning', 5000);
  LS.del('ff_msgs');
} else if (Array.isArray(savedMsgs)) {
  S.messages = savedMsgs.filter(m => !m.streaming);
}
```

**Phase:** QUAL-06 (Error resilience)

---

## Phase-Specific Warnings

| Phase Topic | Specific File/Line | Likely Pitfall | Mitigation |
|-------------|-------------------|---------------|------------|
| QUAL-04: Security hardening | index.html:13, markdown.js:8 | DOMPurify 3.1.6 has CVE-2025-26791; root alias skips sanitizer entirely | Upgrade to 3.2.4+, update SRI, add DOMPurify to freeforge.html, fail-safe fallback in markdown.js |
| QUAL-06: Error resilience | api.js:72-75 | Mid-stream error object swallowed by `if (delta)` guard | Check `j.error` and `finish_reason === 'error'` before delta check |
| QUAL-06: Error resilience | onboarding.js:22, settings.js:32 | Raw localStorage.setItem throws in Safari Private Browsing | Replace with LS.set() |
| QUAL-06: Error resilience | api.js:44-52 | 402 (quota) and 404 (deprecated model) unhandled | Add explicit cases to !res.ok handler |
| QUAL-06: Error resilience | api.js:55+ | reader.cancel() never called on abort | Add abort signal handler calling reader.cancel() |
| QUAL-02: Mobile UX | app.css:9 | 100vh ignores iOS keyboard — input hidden | Change to 100dvh with 100vh fallback |
| QUAL-02: Mobile UX | index.html:5 | Missing viewport-fit=cover — safe-area-inset-bottom inactive | Add to viewport meta tag |
| QUAL-02: Mobile UX | messages.js:78-86 | Copy/Regen buttons ~20px tall on mobile | Add min-height:44px via padding |
| QUAL-03: Code review | api.js:57,63 | TextDecoder {stream:true} pattern is correct — add comment to prevent future regression | Comment the decoder instantiation |
| QUAL-05: UX polish | onboarding.js:19 | "No free models" error is not actionable | Add link to openrouter.ai/models?max_price=0 |
| QUAL-08: Performance | messages.js:16-34 | Full DOM rebuild on every onDone — slow for long chats | Add content-visibility:auto as near-term mitigation |

---

## Sources

- OpenRouter SSE streaming format and mid-stream error spec: https://openrouter.ai/docs/api/reference/streaming
- OpenRouter error codes including 402: https://openrouter.ai/docs/api/reference/errors-and-debugging
- CVE-2025-26791 DOMPurify mXSS: https://www.cve.news/cve-2025-26791/
- DOMPurify bypasses research: https://mizu.re/post/exploring-the-dompurify-library-bypasses-and-fixes
- iOS keyboard and dvh: https://www.franciscomoretti.com/blog/fix-mobile-keyboard-overlap-with-visualviewport
- VisualViewport API: https://dev.to/franciscomoretti/fix-mobile-keyboard-overlap-with-visualviewport-3a4a
- Safe area insets CSS env(): https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/env
- localStorage SecurityError in Private Browsing: https://mattburke.dev/dom-exception-22-quota-exceeded-on-safari-private-browsing-with-localstorage/
- localStorage safe write patterns: https://mmazzarolo.com/blog/2022-06-25-local-storage-status/
- ReadableStream reader.cancel() on abort: https://developer.mozilla.org/en-US/docs/Web/API/ReadableStreamDefaultReader/cancel
- SSE comment lines causing parser bugs: https://github.com/docker/docker-agent/issues/2349
- OpenRouter free model 404 deprecation: https://dev.to/josh_green_dev/free-llms-on-openrouter-keep-going-404-i-fixed-it-with-120-lines-of-python-43i1
- TextDecoder stream:true multi-byte fix: https://github.com/vercel/next.js/pull/35724
- navigator.clipboard secure context requirement: https://web.dev/articles/async-clipboard
- WCAG touch target sizes: https://www.smashingmagazine.com/2023/04/accessible-tap-target-sizes-rage-taps-clicks/
