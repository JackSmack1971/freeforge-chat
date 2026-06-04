# Architecture Patterns — FreeForge Vanilla JS Quality Pass

**Domain:** Browser-only chat UI, vanilla ES modules, no build step
**Researched:** 2026-06-04
**Source basis:** Direct codebase inspection of all 11 source files + 2 HTML entry points

---

## What Makes This Codebase Already Impressive

Before cataloguing problems, these things are genuinely good and should be preserved:

- The SSE streaming loop in `api.js` is correctly written: chunked `TextDecoder` with `{ stream: true }`, line-splitting with residual buffer, `[DONE]` sentinel handling, and `AbortController` wired through `S.abort`. This is non-trivial; most tutorials get it wrong.
- The module graph is real: `state.js` has no imports, `api.js` imports only from `state.js`, features import from api + ui, `app.js` is the only wiring layer. The dependency direction is disciplined.
- `LS` wrapping localStorage in try/catch is the right production habit — Safari private mode throws on write.
- Toast animations are CSS-driven with a forward-fill fade-out (`toastOut 2.75s forwards`), not a JS `setTimeout` visual trick.
- `buildMsgEl` attaches copy listener imperatively to the just-created element, not via a delegated selector on `document`. That's correct — the listener has a closure over `msg.content` which avoids a DOM re-read.

---

## Entry Point Situation: Concrete Verdict

**Decision: Delete `freeforge.html` at the repo root. `freeforge/index.html` is the canonical entry.**

### What the drift looks like today

`freeforge.html` (root) is a 915-line single-file app where all JS is inlined in a `<script>` tag. It has:
- No DOMPurify — `renderMd` (line 450–458) calls `marked.parse(text)` and injects the result directly into `innerHTML` with no sanitization. This is an XSS vector for any malicious content in LLM responses.
- `settings-clear-btn` logic is inlined in the event handler (lines 822–828) rather than extracted to a function. The modular version has it in `features/settings.js::clearKey()`.
- `new-chat-btn` logic is inlined (lines 860–868) rather than calling `newChat()` from `features/chat.js`.
- `loadModels` has the option-building loop inline (lines 676–683) instead of using the extracted `buildOptions()` helper from `features/models.js`.
- `showInvalidBanner` has a redundant `style.display = 'flex'` that fights with the `hidden` class, present in both files (root: line 708, modular: `screen.js` line 10). This is a double-source-of-truth for display state.

`freeforge/index.html` is the modular version: proper `<script type="module" src="src/app.js">`, external CSS via `<link rel="stylesheet" href="styles/app.css">`, DOMPurify loaded and used.

### Why the root file exists at all

It appears to be the original single-file version that predates the refactor into ES modules. It was never removed. It is now a maintenance liability: any fix applied to the modular version must be manually replicated to the root file or it silently diverges.

### Recommended consolidation

1. Delete `freeforge.html` from the repo root entirely.
2. Add a note in the README that the entry point is `freeforge/index.html`.
3. If a "one file you can just share" version is wanted for the portfolio story, that is a separate deliverable — generate it as a build artifact, not maintain it as a hand-synced source file.

There is no scenario where maintaining two diverged source-of-truth HTML files is correct.

---

## Anti-Patterns Specific to This Codebase

### Anti-Pattern 1: Mixed localStorage access styles

**Where:** `app.js` line 11 uses `localStorage.getItem('ff_key')` directly. Every other key access in the codebase uses the `LS` wrapper. `settings.js` line 33 and `onboarding.js` line 35 also call `localStorage.setItem('ff_key', key)` directly instead of `LS.set('ff_key', key)`.

**Why it matters:** The `LS` wrapper exists specifically to suppress `DOMException` in Safari private mode. Direct calls bypass that. A reviewer will see the inconsistency and correctly flag it as an oversight.

**Before:** `app.js:11` — `const savedKey = localStorage.getItem('ff_key');`
**After:** `const savedKey = LS.get('ff_key');`

Same fix in `settings.js:33` and `onboarding.js:35`.

---

### Anti-Pattern 2: `S.abort` is assigned inside `api.js::streamCompletion`

**Where:** `api.js` lines 22–23: `const ctrl = new AbortController(); S.abort = ctrl;`

`streamCompletion` is supposed to be a pure transport function — it takes a payload, returns tokens via callbacks, and signals completion. Instead it reaches into the global state singleton to register its own abort handle. This creates a hidden side effect: calling `streamCompletion` mutates `S`.

The caller (`chat.js`) already has the abort handle it needs because it holds the reference via `S.abort`, but the *assignment* is backwards — the function is choosing its own name in the global state, which is the caller's job.

**Before:** `api.js` assigns `S.abort = ctrl` internally.
**After:** `streamCompletion` returns `ctrl` (or accepts an `onAbort` callback), and `chat.js::sendMessage` assigns `S.abort = ctrl` after the call. The transport function no longer imports `state.js` at all.

This is the single highest-leverage architectural change in the codebase. It makes `api.js` a true utility module with no global state dependency, which is immediately visible as clean to any reviewer.

---

### Anti-Pattern 3: `showInvalidBanner` sets both a class and an inline style

**Where:** `screen.js` lines 9–10:
```js
b.classList.remove('hidden');
b.style.display = 'flex';
```

The `hidden` class (Tailwind) sets `display: none`. Removing it lets the element's CSS rule take over — but if the CSS rule doesn't specify `display: flex`, the element gets `display: block`. So the inline style is a load-bearing workaround for an incomplete CSS definition, not intentional layering.

**Before:** Two-step show requiring both a class and an inline style.
**After:** Add `flex` to `#invalid-banner`'s CSS (it already has `flex items-center` Tailwind classes on it in the HTML), then `showInvalidBanner` only does `b.classList.remove('hidden')`. `hideInvalidBanner` only does `b.classList.add('hidden')`. This makes the show/hide symmetrical.

---

### Anti-Pattern 4: `renderAllMessages` does a full `innerHTML = ''` rebuild on every token during streaming

**Where:** `chat.js::sendMessage` calls `renderAllMessages()` before streaming starts (line 24), and then `onDone` calls `renderAllMessages()` again (line 55). During the stream itself, `S.streamTarget.textContent = full` updates the live element directly — that part is correct.

The problem is the initial `renderAllMessages()` call and the `onDone` rebuild. For a conversation with 50 messages, each `renderAllMessages()` call destroys and recreates 50 DOM nodes including re-running `renderMd` (marked.js parse) on every assistant message. This is invisible at small scale but becomes measurable in longer sessions and is the kind of thing a senior reviewer will immediately ask "did you profile this?"

**Before:** Full re-render tears down and rebuilds all messages on send and on done.
**After:** `renderAllMessages` stays as the full rebuild for initial load and screen transitions. For the `sendMessage` flow: append only the new user bubble and assistant bubble individually using `buildMsgEl`. Only the final `onDone` re-renders the last assistant bubble (to switch from streaming to rendered markdown). This is ~10 lines of targeted DOM append vs a full rebuild.

This is a medium-priority change for portfolio impressiveness — the current code is not *wrong*, but the pattern signals unawareness of render cost.

---

### Anti-Pattern 5: `marked.setOptions` called on every `renderMd` invocation

**Where:** `markdown.js` line 6: `marked.setOptions({ breaks: true, gfm: true });`

`marked.setOptions` sets global marked configuration. Calling it inside a function that fires once per assistant message (and once per message during re-renders) is redundant after the first call. It also mutates global state of an external library on every render, which is a detectable code smell.

**Before:** Called inside the render function body.
**After:** Called once at module initialization level:
```js
marked.setOptions({ breaks: true, gfm: true });
export function renderMd(text) { ... }
```

One-line fix, signals awareness of initialization vs. per-call concerns.

---

### Anti-Pattern 6: `state.js` contains both app state and unrelated utilities

**Where:** `state.js` exports: `S` (app state), `LS` (storage wrapper), `$` (DOM shortcut), `esc` (HTML escaping), `uid` (ID generation), `maskKey` (display formatting), `fmtCtx` (context length formatting), and a polyfill for `Array.prototype.findLastIndex`.

This is a grab-bag module, not a state module. A module named `state.js` that a reviewer opens expecting to see the application state shape will instead find a polyfill, a DOM query alias, an escape function, and two formatters.

**Recommended split:**

- `state.js` — keeps only `S`, `LS`. Possibly the polyfill (it must run early).
- `utils.js` — `$`, `esc`, `uid`, `maskKey`, `fmtCtx`.

This is a pure rename/reorganization with zero behavior change. Import paths in all consumers need updating. The payoff: a reviewer opening `state.js` sees exactly the application data model.

**Caveat:** `$` is used in nearly every module. Keeping it in a single shared utility file avoids every module needing to define its own. The split is worth doing but should be done with a search-and-update pass, not incrementally.

---

### Anti-Pattern 7: `populateModelsFromState` is duplicated between `models.js` and `freeforge.html`

**Where:** `models.js::populateModelsFromState` (lines 51–58) and `freeforge.html` (lines 756–771) implement the same option-building logic. This was caught above in the entry point discussion, but the root cause is worth naming: the modular version also duplicates the option-building loop between `loadModels` and `populateModelsFromState` internally — the private `buildOptions(models)` function (lines 6–17) should be the only place this loop exists. `populateModelsFromState` calls `buildOptions(S.models)` which is correct, but `loadModels` also uses `buildOptions` which is also correct — this is actually fine in the modular version. The duplication is entirely in the unrelated root file.

---

### Anti-Pattern 8: `regenerate` in `chat.js` removes the notice message by searching forward from index 0

**Where:** `chat.js` lines 80–81:
```js
const noticeIdx = S.messages.findIndex(m => m.role === 'notice');
if (noticeIdx !== -1) S.messages.splice(noticeIdx, 1);
```

`findIndex` finds the *first* notice message. If the notice message is supposed to appear after the first user message (it is — inserted on line 16), and the conversation has progressed significantly, this is fragile. If a future feature ever adds a second notice type (e.g., a context-overflow warning), this will delete the wrong notice.

**Before:** `findIndex` on role match.
**After:** Either use a dedicated `role: 'system-notice'` with a specific sub-type field, or remove the notice by ID (the notice message already has an `id` from `uid()`). Storing the notice ID when it is created and targeting it by ID on regenerate is more robust.

This is a minor correctness issue today but signals incomplete thinking about the message type system.

---

## Module Boundary Assessment

The current boundary structure is good but has one real violation and one naming confusion:

**Real violation:** `api.js` imports `state.js` (to assign `S.abort`). This should be removed as described in Anti-Pattern 2. After removal, `api.js` has zero imports — it becomes a pure HTTP utility that any app could use.

**Naming confusion:** `features/` contains `models.js`, `onboarding.js`, `settings.js`, `chat.js`. These are all correct placements. `ui/` contains `messages.js`, `screen.js`, `toast.js`. However `messages.js` contains both pure rendering logic (`buildMsgEl`) and state-reading logic (directly reads `S.messages` and `S.streaming`). A strict boundary would have `messages.js` accept message arrays as arguments. In practice, for this scale of app, reading from `S` in a UI module is acceptable — but it's worth noting the line is blurry.

---

## README Quality Standards for This Project

A senior engineer reviewing this portfolio piece will spend ~60 seconds on the README before deciding whether to look at the source. The README needs to answer these questions in order:

1. **What does it do?** (one sentence, not a list)
2. **Does it actually work, and is it actually free?** (the key credibility question for "free AI chat")
3. **How do I run it?** (the answer must be "open index.html" — this is the project's strongest selling point)
4. **What's interesting about the code?** (this is where portfolio value lives)

**What to include:**

- A screenshot or short GIF. Non-negotiable. Portfolio viewers close tabs without one.
- The one-line open instruction: "No install. Open `freeforge/index.html` in any browser."
- A brief "how it works" section covering: ES modules without a bundler, streaming SSE via `ReadableStream`, localStorage-only persistence, DOMPurify sanitization of LLM output.
- A "Why vanilla JS?" section. Senior engineers will assume you couldn't figure out React. Get ahead of this: "Demonstrates that the browser platform is sufficient — no virtual DOM, no state manager, no transpiler. The source is the running code."

**What not to include:**

- A full feature list. The screenshot covers this.
- Installation instructions beyond "open the file." Any setup steps are a failure mode for this project.
- Badges (build status, coverage) — there is no CI and no tests. Badges pointing to nothing signal cargo-culting.

**Suggested README structure:**

```
# FreeForge

[Screenshot]

Chat with free AI models directly in your browser. No server, no account, no cost.

## Usage

1. Get a free API key at openrouter.ai/keys
2. Open freeforge/index.html
3. Paste your key and start chatting

## How it works

[4-5 bullet points on the interesting technical decisions]

## Why vanilla JS?

[2-3 sentences on the intentional choice]

## License
```

---

## Component Boundaries Summary

| Module | Current Responsibility | Actual Responsibility | Boundary Violation? |
|--------|----------------------|----------------------|---------------------|
| `state.js` | State + utilities + polyfill | Should be state + LS only | Yes — utilities belong in `utils.js` |
| `api.js` | HTTP + abort registration | Should be HTTP only | Yes — `S.abort` assignment belongs in caller |
| `markdown.js` | Render with sanitization | Correct | No |
| `ui/messages.js` | Build + render all messages | Reads global `S` directly | Acceptable at this scale |
| `ui/screen.js` | Show/hide screens + banners | Correct | No |
| `ui/toast.js` | Create toast elements | Correct | No |
| `features/chat.js` | Send, regenerate, new chat | Correct | No |
| `features/models.js` | Load + populate model select | Correct | No |
| `features/onboarding.js` | Validate key + transition | Correct | No |
| `features/settings.js` | View/update/clear key | Correct | No |
| `app.js` | Wire all events, init | Correct — pure wiring | No |

---

## Prioritized Change List for Roadmap

Ordered by impact-to-effort ratio for portfolio quality:

1. **Delete `freeforge.html` (root)** — zero code change, eliminates XSS vector, removes maintenance split-brain. One line in git.

2. **Fix mixed localStorage access** — `app.js:11`, `settings.js:33`, `onboarding.js:35`. Change 3 direct `localStorage` calls to `LS.*` calls. 3-line change.

3. **Remove `S.abort` assignment from `api.js`** — makes `api.js` import-free. Change `streamCompletion` to return the `AbortController` (or add an `onAbort` callback), update `chat.js::sendMessage` to assign `S.abort = await streamCompletion(...)`. ~8 lines affected.

4. **Move `marked.setOptions` to module init in `markdown.js`** — 1-line move, signals good habits.

5. **Split `state.js` into `state.js` + `utils.js`** — rename/reorganize, update imports in 9 files. Zero behavior change, high signal value.

6. **Fix `showInvalidBanner` to not mix class + inline style** — add `flex` to the CSS rule for `#invalid-banner`, remove `style.display = 'flex'` from `screen.js:10` and the equivalent line in any code that remains after entry point consolidation.

7. **Target `notice` message removal in `regenerate` by ID** — small correctness improvement, signals complete thinking.

8. **Write the README** as described above with a screenshot.

---

## Confidence Assessment

| Area | Confidence | Basis |
|------|------------|-------|
| Anti-pattern identification | HIGH | Direct source inspection, all 11 files read |
| Entry point drift analysis | HIGH | Diffed both HTML files line by line |
| Boundary violations | HIGH | Followed import graph manually |
| README recommendations | MEDIUM | Based on common portfolio review patterns; no single authoritative source |
| Render performance concern (Anti-Pattern 4) | MEDIUM | Analysis is correct; actual visible impact depends on conversation length |
