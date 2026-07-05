# Phase 2: Conversation History Drawer - Pattern Map

**Mapped:** 2026-07-05
**Files analyzed:** 7
**Analogs found:** 7 / 7

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `freeforge/index.html` | config | request-response | `freeforge/index.html` | exact |
| `freeforge/src/state.js` | store | file-I/O | `freeforge/src/state.js` | exact |
| `freeforge/src/features/chat.js` | controller | request-response | `freeforge/src/features/chat.js` | exact |
| `freeforge/src/features/history.js` | service | CRUD | `freeforge/src/features/settings.js` + `freeforge/src/ui/agent-library.js` + `freeforge/src/ui/messages.js` | role-match |
| `freeforge/src/app.js` | controller | event-driven | `freeforge/src/app.js` | exact |
| `tests/security/runtime-ui-features.test.mjs` | test | event-driven | `tests/security/runtime-ui-features.test.mjs` | exact |
| `tests/security/runtime-app.test.mjs` | test | event-driven | `tests/security/runtime-app.test.mjs` | exact |

## Pattern Assignments

### `freeforge/index.html` (config, request-response)

**Analog:** `freeforge/index.html`

Use the existing modal shell and live-region placement as the insertion pattern for the drawer.

**Nav / action cluster** (lines 154-175):
```html
<div class="flex items-center gap-2 flex-shrink-0">
  <!-- Command palette trigger — click or Ctrl+K -->
  <button
    id="palette-trigger-btn"
    title="Command palette (Ctrl+K)"
    aria-label="Open command palette"
    aria-expanded="false"
    class="nav-icon-btn palette-trigger">
    ⌘
  </button>
  <button id="settings-btn" title="Settings" aria-label="Settings" class="p-2 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors">
  ...
  <button id="new-chat-btn" aria-label="New Chat" class="gradient-btn flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-all">
```

**Chat empty state + message log** (lines 181-203):
```html
<div id="empty-state" class="flex flex-col items-center justify-center h-full text-center px-4 py-16">
  ...
  <div id="starter-prompts" class="mt-6 flex flex-wrap gap-2 justify-center">
    <button class="suggestion ...">Explain quantum computing</button>
  </div>
</div>
<div id="msgs-list" role="log" aria-label="Chat history" aria-live="polite" class="hidden px-4 pt-6 pb-2 space-y-6 max-w-3xl mx-auto w-full"></div>
```

**Modal shell pattern** (lines 244-276):
```html
<div id="settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-title" aria-hidden="true" class="fixed inset-0 z-40 hidden items-center justify-center p-4">
  <div id="settings-backdrop" class="absolute inset-0 modal-bg"></div>
  <div class="surface-card relative w-full max-w-md rounded-2xl border border-zinc-800 p-6 z-10 modal-card">
    <div class="flex items-center justify-between mb-5">
      <h2 id="settings-title" class="text-lg font-semibold text-zinc-100">Settings</h2>
      <button id="close-settings-btn" aria-label="Close settings" class="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors">
```

**Second modal shell** (lines 280-290):
```html
<div id="agent-library-modal" role="dialog" aria-modal="true" aria-labelledby="agent-builder-title" aria-hidden="true" class="fixed inset-0 z-40 hidden items-center justify-center p-4">
  <div id="agent-library-backdrop" class="absolute inset-0 modal-bg"></div>
  <div class="surface-card relative w-full max-w-6xl rounded-2xl border border-zinc-800 p-6 z-10 modal-card">
    <div class="flex items-center justify-between gap-4 mb-5">
```

**Live regions** (lines 371-387):
```html
<div id="cmd-palette" class="hidden" role="dialog" aria-modal="true" aria-label="Command palette">
  <div id="cmd-palette-inner">
    <input id="cmd-search" type="text" placeholder="Type a command…" autocomplete="off" spellcheck="false" aria-label="Search commands" />
    <ul id="cmd-list" role="listbox" aria-label="Available commands"></ul>
  </div>
  <div id="cmd-backdrop"></div>
</div>

<div id="sr-status" class="sr-only" aria-live="polite" aria-atomic="true"></div>
<div id="sr-alert" class="sr-only" role="alert" aria-live="assertive" aria-atomic="true"></div>
```

### `freeforge/src/state.js` (store, file-I/O)

**Analog:** `freeforge/src/state.js`

Use the singleton `S` shape and the `LS` wrapper pattern for archive state and archive persistence.

**Singleton state + storage helper** (lines 1-27):
```js
export const S = {
  apiKey: null,
  models: [],
  selectedModel: null,
  agents: [],
  activeAgentId: null,
  activeAgent: null,
  conversationAgentId: null,
  conversationAgent: null,
  messages: [],
  streaming: false,
  abort: null,
  activeRequestId: null,
  streamTarget: null,
  inlineEditId: null,
  inlineEditUndo: null,
  contextTokens: 0,
  usageIsExact: false,
  ctxToastFired: false,
  lastAssistantResponse: '',
};

export const LS = {
  get(k) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } },
  del(k) { try { localStorage.removeItem(k); } catch {} },
};
```

### `freeforge/src/features/chat.js` (controller, request-response)

**Analog:** `freeforge/src/features/chat.js`

Use `newChat()` as the reset boundary, and copy the current persistence + re-render cadence.

**Reset boundary** (lines 300-317):
```js
export function newChat() {
  clearActiveRequestState();
  if (S.abort) { S.abort.abort(); S.abort = null; }
  clearInlineEditUndo();
  clearPersistent();
  S.messages = [];
  S.streaming = false;
  S.inlineEditId = null;
  S.contextTokens = 0;
  S.usageIsExact = false;
  S.ctxToastFired = false;
  S.lastAssistantResponse = '';
  syncConversationAgent();
  renderStreamIcons(false);
  $('thinking').classList.add('hidden');
  LS.set('ff_msgs', []);
  renderAllMessages();
  renderCtxPill();
}
```

**Restore-style state swap** (lines 320-336):
```js
export function restoreInlineEditUndo(token) {
  const undo = S.inlineEditUndo;
  if (!inlineEditUndoMatchesToken(undo, token)) return false;
  const slice = undo.slice;
  clearInlineEditUndo(token);
  clearActiveRequestState();
  if (S.abort) { S.abort.abort(); S.abort = null; }
  S.streaming = false;
  S.streamTarget = null;
  renderStreamIcons(false);
  $('thinking').classList.add('hidden');
  S.messages.splice(0, S.messages.length, ...slice);
  S.inlineEditId = null;
  LS.set('ff_msgs', S.messages);
  renderAllMessages();
  renderCtxPill();
  return true;
}
```

**Persistence on completion** (lines 121-123 and 232-235):
```js
if (!LS.set('ff_msgs', S.messages)) toast('Storage quota exceeded — conversation history may not persist after reload', 'warning', 8000);
if (!replaceMessage(asstMsg, true)) renderAllMessages();
renderCtxPill();
scrollBottom();
```

### `freeforge/src/features/history.js` (service, CRUD)

**Analog:** `freeforge/src/features/settings.js`, `freeforge/src/ui/agent-library.js`, `freeforge/src/ui/messages.js`, `freeforge/src/features/chat.js`

Use the settings modal for destructive confirmation, the agent library for modal drawer open/close and list rendering, and messages for empty-state toggling.

**Modal open/close + confirm flow** (`freeforge/src/features/settings.js`, lines 70-92 and 134-146):
```js
export function openSettings() {
  $('settings-key-display').textContent = maskKey(S.apiKey);
  $('settings-new-key').value = '';
  announceStatus('');
  clearKeyError();
  resetClearButton($('settings-clear-btn'));
  const modal = $('settings-modal');
  modal.classList.remove('hidden');
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  getFocusTrap().open();
  $('settings-new-key').focus();
}

export function closeSettings() {
  resetClearButton($('settings-clear-btn'));
  clearKeyError(false);
  const modal = $('settings-modal');
  modal.classList.add('hidden');
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
  getFocusTrap().close($('settings-btn'));
}

export function clearKey() {
  const btn = $('settings-clear-btn');
  if (btn.dataset.confirm === 'pending') {
    resetClearButton(btn);
    executeClearKey();
    return;
  }
  btn.dataset.confirm = 'pending';
  btn.textContent = 'Click again to confirm';
  btn.classList.add('bg-red-600', 'text-white');
  announceStatus('Press Clear Key again to remove the stored key.');
  btn._confirmTimer = setTimeout(() => resetClearButton(btn), CLEAR_CONFIRM_MS);
}
```

**Drawer/modal surface + list rendering** (`freeforge/src/ui/agent-library.js`, lines 24-103):
```js
export function openAgentLibrary() {
  const modal = getModal();
  if (!modal) return;
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
  getFocusTrap().open();
  $(CLOSE_ID)?.focus();
}

export function closeAgentLibrary() {
  const modal = getModal();
  if (!modal) return;
  modal.classList.add('hidden');
  modal.setAttribute('aria-hidden', 'true');
  getFocusTrap().close();
}

export function renderAgentLibrary(agents = S.agents, activeAgentId = S.activeAgentId) {
  const list = getList();
  if (!list) return;
  list.textContent = '';
  if (!agents.length) {
    const empty = document.createElement('p');
    empty.className = 'text-sm text-zinc-500';
    empty.textContent = 'No agents yet.';
    list.appendChild(empty);
    return;
  }
  for (const agent of agents) {
    const item = document.createElement('div');
    item.className = 'rounded-xl border border-zinc-800 bg-zinc-950/60 px-3 py-3';
    item.dataset.agentId = agent.id;
    ...
  }
}
```

**Empty-state / hide-show toggle** (`freeforge/src/ui/messages.js`, lines 83-129):
```js
function syncMessageVisibility() {
  const list = $('msgs-list');
  const empty = $('empty-state');
  renderStarterPrompts();

  if (S.messages.length === 0) {
    empty.classList.remove('hidden');
    list.classList.add('hidden');
    list.innerHTML = '';
    renderedCount = 0;
    return;
  }

  empty.classList.add('hidden');
  list.classList.remove('hidden');
}

export function renderAllMessages() {
  const list = $('msgs-list');
  syncMessageVisibility();
  if (S.messages.length === 0) return;
  list.innerHTML = '';
  renderedCount = 0;
  appendNewMessages();
}
```

**Reset boundary + restore state fields** (`freeforge/src/features/chat.js`, lines 300-317 and 320-336):
```js
S.messages = [];
S.streaming = false;
S.inlineEditId = null;
S.contextTokens = 0;
S.usageIsExact = false;
S.ctxToastFired = false;
S.lastAssistantResponse = '';
syncConversationAgent();
renderStreamIcons(false);
$('thinking').classList.add('hidden');
LS.set('ff_msgs', []);
renderAllMessages();
renderCtxPill();
```

### `freeforge/src/app.js` (controller, event-driven)

**Analog:** `freeforge/src/app.js`

Copy the existing startup hydration and delegated listener style for drawer open/close and restore actions.

**Startup hydration** (lines 31-76):
```js
async function init() {
  const savedKey = getStoredKey();
  if (!savedKey) {
    showScreen('onboarding');
    return;
  }

  S.apiKey = savedKey;
  S.agents = loadAgents();
  const savedActiveAgentId = LS.get('ff_active_agent_id');
  S.activeAgent = S.agents.find(agent => agent.id === savedActiveAgentId) || S.agents[0] || null;
  S.activeAgentId = S.activeAgent?.id ?? null;

  const savedMsgs = LS.get('ff_msgs');
  if (Array.isArray(savedMsgs)) {
    S.messages = savedMsgs.filter(m => m && typeof m === 'object' && !Array.isArray(m) && !m.streaming);
  }

  const savedConversationAgent = S.messages.length ? LS.get('ff_conversation_agent') : null;
  ...
  renderAllMessages();
  scrollBottom(false);
  refreshAgentUi();
  renderCtxPill();
}
```

**Direct UI wiring** (lines 138-170):
```js
$('settings-btn').addEventListener('click', openSettings);
$('close-settings-btn').addEventListener('click', closeSettings);
$('settings-backdrop').addEventListener('click', closeSettings);
$('settings-clear-btn').addEventListener('click', clearKey);
$('settings-update-btn').addEventListener('click', updateKey);
$('banner-update-btn').addEventListener('click', () => { hideInvalidBanner(); openSettings(); });
$('agent-library-btn')?.addEventListener('click', () => {
  openAgentLibrary();
  refreshAgentUi();
});

// new chat
$('new-chat-btn').addEventListener('click', newChat);
```

**Delegated actions + Escape close** (lines 155-170 and 261-266):
```js
document.addEventListener('click', e => {
  const action = getToastAction(e.target);
  if (!action) return;
  if (action === 'new-chat') {
    newChat();
    return;
  }
  if (action.startsWith('inline-edit-undo:')) {
    const token = action.slice('inline-edit-undo:'.length);
    if (S.abort) { S.abort.abort(); S.abort = null; }
    restoreInlineEditUndo(token);
  }
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    closeAgentLibrary();
    closeSettings();
  }
});
```

### `tests/security/runtime-ui-features.test.mjs` (test, event-driven)

**Analog:** `tests/security/runtime-ui-features.test.mjs`

Extend the existing browser-style fixture helpers and modal tests for the drawer nodes, focus trap, and empty state.

**Fixture scaffold** (lines 62-113):
```js
function addAgentDom(doc) {
  const ids = [
    ['agent-select', 'select'],
    ['agent-library-modal', 'div'],
    ['agent-library-backdrop', 'div'],
    ['agent-library-close-btn', 'button'],
    ['agent-library-list', 'div'],
    ['agent-library-new-btn', 'button'],
    ['agent-library-import-btn', 'button'],
    ['agent-library-export-btn', 'button'],
    ['agent-library-import-input', 'input'],
    ...
  ];

  for (const [id, tag] of ids) {
    const el = tag === 'input'
      ? new MockElement('input', { id })
      : tag === 'textarea'
        ? new MockElement('textarea', { id })
        : new MockElement(tag, { id });
    doc.register(el);
  }

  const modal = doc.getElementById('agent-library-modal');
  modal.appendChild(doc.getElementById('agent-library-close-btn'));
  modal.appendChild(doc.getElementById('agent-library-list'));
  modal.appendChild(doc.getElementById('agent-library-backdrop'));
}
```

**Modal/focus assertions** (lines 606-655 and 909-1057):
```js
test('agent-library.js opens, traps focus, and restores focus on close', async () => {
  ...
  openAgentLibrary();
  assert.equal(doc.activeElement.id, 'agent-library-close-btn');
  const focusables = modal.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])');
  ...
  closeAgentLibrary();
  assert.equal(doc.activeElement.id, 'settings-btn');
});

test('settings.js opens, traps focus, updates keys, and clears stored data', async () => {
  ...
  openSettings();
  assert.equal(doc.getElementById('settings-modal').classList.contains('open'), true);
  ...
  clearKey();
  assert.equal(state.S.apiKey, null);
  assert.equal(doc.getElementById('screen-onboarding').classList.contains('active'), true);
});
```

### `tests/security/runtime-app.test.mjs` (test, event-driven)

**Analog:** `tests/security/runtime-app.test.mjs`

Extend the app-wiring test the same way it already exercises startup, modal toggles, new chat, delegated clicks, and Escape.

**Boot + onboarding** (lines 92-120):
```js
test('app.js boots to onboarding when no key is stored and records global errors', async () => {
  const doc = makeBaseDom();
  const win = makeWindow();
  ...
  await importFresh('freeforge/src/app.js');
  doc.dispatchEvent({ type: 'DOMContentLoaded' });
  await Promise.resolve();

  assert.equal(doc.getElementById('screen-onboarding').classList.contains('active'), true);
  assert.equal(doc.getElementById('screen-chat').classList.contains('active'), false);
});
```

**Full app wiring** (lines 342-495):
```js
await importFresh('freeforge/src/app.js');
doc.dispatchEvent({ type: 'DOMContentLoaded' });
await new Promise(r => setTimeout(r, 0));

assert.equal(doc.getElementById('screen-chat').classList.contains('active'), true);
...
doc.getElementById('settings-btn').click();
assert.equal(doc.activeElement.id, 'settings-new-key');
...
doc.getElementById('new-chat-btn').click();
doc.dispatchEvent({ type: 'click', target: Object.assign(new MockElement('button'), { dataset: { action: 'new-chat' } }) });
...
doc.dispatchEvent({ type: 'keydown', key: 'Escape' });
assert.equal(doc.getElementById('settings-modal').classList.contains('open'), false);
```

## Shared Patterns

### Modal surfaces
**Source:** `freeforge/src/features/settings.js`, `freeforge/src/ui/agent-library.js`, `freeforge/src/ui/focus-trap.js`

Copy the exact modal pattern: remove `hidden`, set `aria-hidden="false"`, open the trap, and restore focus on close.

```js
// `freeforge/src/features/settings.js`
modal.classList.remove('hidden');
modal.classList.add('open');
modal.setAttribute('aria-hidden', 'false');
getFocusTrap().open();

// `freeforge/src/ui/focus-trap.js`
function close(fallback = null) {
  if (!containerEl) return;
  containerEl.removeEventListener('keydown', trapFocus);
  const target = previousFocus && document.contains(previousFocus) ? previousFocus : fallback;
  if (target) target.focus();
  previousFocus = null;
}
```

### Reset and restore
**Source:** `freeforge/src/features/chat.js`, `freeforge/src/state.js`

Archive and restore should follow the same state-write + render cadence as chat reset and inline-edit restore.

```js
S.messages = [];
S.streaming = false;
S.contextTokens = 0;
S.usageIsExact = false;
LS.set('ff_msgs', []);
renderAllMessages();
renderCtxPill();
```

### Empty-state toggling
**Source:** `freeforge/src/ui/messages.js`

Use the same hide/show pattern for drawer empty state.

```js
if (S.messages.length === 0) {
  empty.classList.remove('hidden');
  list.classList.add('hidden');
  list.innerHTML = '';
  renderedCount = 0;
  return;
}
```

### Browser-style tests
**Source:** `tests/security/runtime-ui-features.test.mjs`, `tests/security/runtime-app.test.mjs`

Build new drawer tests with the same helpers, synthetic events, and `assert.equal(...)` style already used here.

```js
openSettings();
assert.equal(doc.getElementById('settings-modal').classList.contains('open'), true);
modal.dispatchEvent({ type: 'keydown', key: 'Tab', shiftKey: false, preventDefault() {} });
doc.dispatchEvent({ type: 'keydown', key: 'Escape' });
```

## Metadata

**Analog search scope:** `freeforge/index.html`, `freeforge/src/*.js`, `freeforge/src/features/*.js`, `freeforge/src/ui/*.js`, `tests/security/*.mjs`
**Files scanned:** 15
**Pattern extraction date:** 2026-07-05
