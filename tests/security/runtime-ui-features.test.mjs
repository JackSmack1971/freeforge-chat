import assert from 'node:assert/strict';
import test from 'node:test';

import { importFresh, importShared, installGlobals, MemoryStorage, makeBaseDom, makeClipboard } from '../helpers/mock-dom.mjs';

function makeSseBody(chunks) {
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(new TextEncoder().encode(chunk));
      controller.close();
    },
  });
}

function resetState(S) {
  S.apiKey = null;
  S.models = [];
  S.selectedModel = null;
  S.messages = [];
  S.streaming = false;
  S.abort = null;
  S.streamTarget = null;
  S.contextTokens = 0;
  S.usageIsExact = false;
  S.ctxToastFired = false;
  S.lastAssistantResponse = '';
}

test('markdown.js sanitizes links and falls back when DOMPurify is unavailable or parsing fails', async () => {
  const doc = makeBaseDom();
  let lastDiv = null;
  const originalCreate = doc.createElement.bind(doc);
  doc.createElement = tag => {
    const el = originalCreate(tag);
    if (tag === 'div') lastDiv = el;
    return el;
  };
  const hooks = [];
  const restore = installGlobals({
    document: doc,
    marked: {
      useCalls: [],
      parseCalls: [],
      use(options) {
        this.useCalls.push(options);
      },
      parse(text) {
        this.parseCalls.push(text);
        return `<p><a href="https://example.com">Link</a></p><pre><code class="language-js">console.log(1)</code></pre>`;
      },
    },
    DOMPurify: {
      hooks,
      addHook(_name, fn) {
        hooks.push(fn);
      },
      sanitize(raw) {
        return raw;
      },
    },
  });
  try {
    const { renderMd } = await importFresh('freeforge/src/markdown.js');
    const out = renderMd('hello');
    assert.match(out, /<a href="https:\/\/example.com">Link<\/a>/);
    const anchor = lastDiv.querySelector('a[href]');
    assert.equal(anchor.getAttribute('target'), '_blank');
    assert.equal(anchor.getAttribute('rel'), 'noopener noreferrer');

    const hook = hooks[0];
    hook({ nodeName: 'A' }, { attrName: 'href', attrValue: 'https://example.com', keepAttr: true });
    const keep = { attrName: 'class', attrValue: 'language-js', keepAttr: true };
    hook({ nodeName: 'CODE' }, keep);
    assert.equal(keep.keepAttr, true);

    const drop = { attrName: 'class', attrValue: 'x', keepAttr: true };
    hook({ nodeName: 'SPAN' }, drop);
    assert.equal(drop.keepAttr, false);
  } finally {
    restore();
  }

  const restoreFallback = installGlobals({
    document: makeBaseDom(),
    marked: {
      use() {},
      parse(text) {
        if (text === 'plain') return '<p>plain</p>';
        throw new Error('parse failed');
      },
    },
    DOMPurify: undefined,
  });
  try {
    const { renderMd } = await importFresh('freeforge/src/markdown.js');
    assert.equal(renderMd(''), '');
    assert.equal(renderMd('plain'), 'plain');
    assert.equal(renderMd('<b>unsafe</b>\nnext'), '&lt;b&gt;unsafe&lt;/b&gt;<br>next');
  } finally {
    restoreFallback();
  }
});

test('screen.js and toast.js update visibility and render escaped, actionable toasts', async () => {
  const doc = makeBaseDom();
  const timeoutCalls = [];
  const restore = installGlobals({
    document: doc,
    marked: { use() {}, parse: text => text },
    DOMPurify: { addHook() {}, sanitize: raw => raw },
    navigator: { clipboard: makeClipboard() },
    setTimeout: (_fn, ms) => {
      timeoutCalls.push(ms);
      return 1;
    },
  });
  try {
    const { showScreen, showInvalidBanner, hideInvalidBanner } = await importFresh('freeforge/src/ui/screen.js');
    const { toast } = await importFresh('freeforge/src/ui/toast.js');

    showScreen('chat');
    assert.equal(doc.getElementById('screen-onboarding').classList.contains('active'), false);
    assert.equal(doc.getElementById('screen-chat').classList.contains('active'), true);

    showInvalidBanner();
    assert.equal(doc.getElementById('invalid-banner').classList.contains('hidden'), false);
    assert.equal(doc.getElementById('invalid-banner').style.display, 'flex');
    hideInvalidBanner();
    assert.equal(doc.getElementById('invalid-banner').classList.contains('hidden'), true);

    toast('x<script>', 'success', 0, { id: 'new-chat', label: 'New Chat' });
    const persistent = doc.getElementById('toasts').children[0];
    assert.equal(persistent.classList.contains('toast-persistent'), true);
    assert.match(persistent.innerHTML, /&lt;script&gt;/);
    assert.equal(persistent.querySelector('span').children[0].dataset.action, 'new-chat');

    toast('later', 'warning', 10);
    assert.deepEqual(timeoutCalls, [310]);
  } finally {
    restore();
  }
});

test('palette.js filters actions, triggers model switches, and closes on keyboard shortcuts', async () => {
  const doc = makeBaseDom();
  const restore = installGlobals({
    document: doc,
    navigator: { clipboard: makeClipboard() },
    marked: { use() {}, parse: text => text },
    DOMPurify: { addHook() {}, sanitize: raw => raw },
  });
  try {
    const { S } = await importShared('freeforge/src/state.js');
    resetState(S);
    S.models = [
      { id: 'alpha-model', context_length: 1000 },
      { id: 'beta-model', name: 'Beta', context_length: 1000 },
    ];
    const { openPalette, closePalette } = await importFresh('freeforge/src/features/palette.js');

    doc.activeElement = doc.getElementById('settings-btn');
    openPalette();
    assert.equal(doc.getElementById('cmd-palette').classList.contains('hidden'), false);
    assert.equal(doc.activeElement.id, 'cmd-search');

    doc.getElementById('cmd-search').value = 'Switch Model';
    doc.getElementById('cmd-search').dispatchEvent({ type: 'input', target: doc.getElementById('cmd-search') });
    assert.equal(doc.getElementById('cmd-list').children.length, 2);

    doc.getElementById('cmd-palette').dispatchEvent({ type: 'keydown', key: 'ArrowDown', preventDefault() {} });
    doc.getElementById('cmd-palette').dispatchEvent({ type: 'keydown', key: 'ArrowUp', preventDefault() {} });
    doc.getElementById('cmd-palette').dispatchEvent({ type: 'keydown', key: 'Enter' });
    assert.equal(S.selectedModel, 'alpha-model');

    openPalette();
    doc.getElementById('cmd-search').value = 'zzz';
    doc.getElementById('cmd-search').dispatchEvent({ type: 'input', target: doc.getElementById('cmd-search') });
    assert.equal(doc.getElementById('cmd-list').children.length, 0);
    assert.equal(doc.getElementById('cmd-search').getAttribute('aria-activedescendant'), '');

    doc.activeElement = doc.getElementById('cmd-search');
    openPalette();
    doc.getElementById('cmd-palette').dispatchEvent({ type: 'keydown', key: 'Escape' });
    assert.equal(doc.getElementById('cmd-palette').classList.contains('hidden'), true);

    closePalette();
  } finally {
    restore();
  }
});

test('palette.js no-ops safely when required DOM nodes are missing', async () => {
  const doc = makeBaseDom();
  const originalGet = doc.getElementById.bind(doc);
  const restore = installGlobals({
    document: doc,
    navigator: { clipboard: makeClipboard() },
    marked: { use() {}, parse: text => text },
    DOMPurify: { addHook() {}, sanitize: raw => raw },
  });
  try {
    const { S } = await importShared('freeforge/src/state.js');
    resetState(S);
    S.models = null;
    const { openPalette } = await importFresh('freeforge/src/features/palette.js');

    doc.getElementById = id => (id === 'cmd-list' ? null : originalGet(id));
    doc.activeElement = doc.getElementById('settings-btn');
    openPalette();
    assert.equal(doc.getElementById('cmd-palette').classList.contains('hidden'), false);

    S.models = [{ id: 'alpha', name: 'Alpha' }];
    doc.getElementById = originalGet;
    openPalette();
    doc.getElementById = id => (id === 'cmd-search' ? null : originalGet(id));
    const search = originalGet('cmd-search');
    search.value = 'zzz';
    search.dispatchEvent({ type: 'input', target: search });
    doc.getElementById('cmd-palette').dispatchEvent({ type: 'keydown', key: 'ArrowDown', preventDefault() {} });
    doc.getElementById('cmd-palette').dispatchEvent({ type: 'keydown', key: 'ArrowUp', preventDefault() {} });

    doc.getElementById = id => (id === 'cmd-palette' ? null : originalGet(id));
    openPalette();
  } finally {
    doc.getElementById = originalGet;
    restore();
  }
});

test('palette.js action buttons execute their handlers', async () => {
  const doc = makeBaseDom();
  const restore = installGlobals({
    document: doc,
    navigator: { clipboard: makeClipboard() },
    localStorage: new MemoryStorage(),
    sessionStorage: new MemoryStorage(),
    marked: { use() {}, parse: text => text },
    DOMPurify: { addHook() {}, sanitize: raw => raw },
  });
  try {
    const { S } = await importShared('freeforge/src/state.js');
    resetState(S);
    S.models = [{ id: 'alpha', name: 'Alpha' }];
    const { openPalette } = await importFresh('freeforge/src/features/palette.js');

    S.messages = [
      { id: 'u1', role: 'user', content: 'hello' },
      { id: 'a1', role: 'assistant', content: 'world' },
    ];
    openPalette();
    doc.getElementById('cmd-list').children[0].click();
    assert.equal(doc.getElementById('msgs-list').children.length, 0);

    S.messages = [
      { id: 'a2', role: 'assistant', content: 'copy me' },
    ];
    openPalette();
    doc.getElementById('cmd-list').children[1].click();
    await Promise.resolve();
    assert.ok(doc.getElementById('toasts').children.length > 0);

    S.messages = [
      { id: 'u3', role: 'user', content: 'hello' },
      { id: 'a3', role: 'assistant', content: 'world' },
    ];
    openPalette();
    doc.getElementById('cmd-list').children[2].click();
    await Promise.resolve();

    openPalette();
    doc.getElementById('cmd-list').children[3].click();
    assert.equal(doc.getElementById('settings-modal').classList.contains('open'), true);
  } finally {
    restore();
  }
});

test('ctx-pill.js handles missing elements, estimated usage, thresholds, and toast suppression', async () => {
  const doc = makeBaseDom();
  doc.elements.delete('ctx-pill');
  const restoreMissing = installGlobals({
    document: doc,
    marked: { use() {}, parse: text => text },
    DOMPurify: { addHook() {}, sanitize: raw => raw },
  });
  try {
    const { renderCtxPill } = await importFresh('freeforge/src/ui/ctx-pill.js');
    renderCtxPill();
  } finally {
    restoreMissing();
  }

  const doc2 = makeBaseDom();
  const restore = installGlobals({
    document: doc2,
    marked: { use() {}, parse: text => text },
    DOMPurify: { addHook() {}, sanitize: raw => raw },
  });
  try {
    const { renderCtxPill } = await importFresh('freeforge/src/ui/ctx-pill.js');
    const { S } = await importShared('freeforge/src/state.js');
    resetState(S);
    S.models = [{ id: 'm1', context_length: 1000 }];
    S.selectedModel = 'm1';

    S.contextTokens = 500;
    S.usageIsExact = false;
    S.ctxToastFired = false;
    renderCtxPill();
    assert.equal(doc2.getElementById('ctx-pill').textContent, '~50%');
    assert.equal(doc2.getElementById('ctx-pill').classList.contains('ctx-ok'), true);
    assert.equal(doc2.getElementById('ctx-pill').classList.contains('ctx-est'), true);

    S.contextTokens = 800;
    S.usageIsExact = true;
    renderCtxPill();
    assert.equal(doc2.getElementById('ctx-pill').textContent, '80%');
    assert.equal(doc2.getElementById('ctx-pill').classList.contains('ctx-warn'), true);
    assert.equal(doc2.getElementById('ctx-pill').classList.contains('ctx-est'), false);

    S.contextTokens = 950;
    S.usageIsExact = true;
    renderCtxPill();
    assert.equal(doc2.getElementById('ctx-pill').classList.contains('ctx-danger'), true);
    assert.equal(S.ctxToastFired, true);
    const toastCount = doc2.getElementById('toasts').children.length;
    renderCtxPill();
    assert.equal(doc2.getElementById('toasts').children.length, toastCount);
  } finally {
    restore();
  }
});

test('messages.js renders each message type, streams updates, and wires copy/regenerate actions', async () => {
  const doc = makeBaseDom();
  const clipboard = makeClipboard();
  const timeouts = [];
  const restore = installGlobals({
    document: doc,
    navigator: { clipboard },
    setTimeout: (fn, ms) => {
      timeouts.push({ fn, ms });
      return 1;
    },
    marked: {
      use() {},
      parse(text) {
        if (text.includes('```')) return '<pre><code class="language-js">console.log(1)</code></pre><a href="https://example.com">link</a>';
        return `<p>${text}</p>`;
      },
    },
    DOMPurify: {
      addHook() {},
      sanitize(raw) {
        return raw;
      },
    },
  });
  try {
    const state = await importShared('freeforge/src/state.js');
    resetState(state.S);
    const { scrollBottom, setStreamMode, appendNewMessages, renderAllMessages, replaceMessage, buildMsgEl } = await importFresh('freeforge/src/ui/messages.js');
    state.S.messages = [];

    appendNewMessages();
    scrollBottom(false);
    assert.equal(doc.getElementById('msgs-area').scrollToArgs.behavior, 'instant');

    setStreamMode(true);
    assert.equal(doc.getElementById('send-btn').getAttribute('aria-label'), 'Stop generating');
    setStreamMode(false);
    assert.equal(doc.getElementById('send-btn').getAttribute('aria-label'), 'Send message');

    renderAllMessages();
    assert.equal(doc.getElementById('empty-state').classList.contains('hidden'), false);
    assert.equal(doc.getElementById('msgs-list').classList.contains('hidden'), true);

    const user = { id: 'u1', role: 'user', content: 'hello' };
    const notice = { id: 'n1', role: 'notice', content: 'note' };
    const assistant = { id: 'a1', role: 'assistant', content: '```js\nx\n```', streaming: false };
    state.S.messages = [user, notice];
    renderAllMessages();
    assert.equal(doc.getElementById('msgs-list').children.length, 2);
    state.S.messages.push(assistant);
    appendNewMessages();
    assert.equal(doc.getElementById('msgs-list').children.length, 3);

    const userEl = buildMsgEl(user);
    assert.equal(userEl.querySelector('.msg-user-surface').textContent, 'hello');
    const noticeEl = buildMsgEl(notice);
    assert.equal(noticeEl.querySelector('.msg-notice-surface').textContent, 'note');
    const streamingEl = buildMsgEl({ id: 's1', role: 'assistant', content: 'typing', streaming: true });
    assert.equal(streamingEl.querySelector('.msg-content').textContent, 'typing');

    const rich = buildMsgEl(assistant, true);
    const pre = rich.querySelector('pre');
    assert.ok(pre);
    const codeCopyBtn = pre.querySelector('.copy-code-btn');
    assert.ok(codeCopyBtn);
    const copyBtn = rich.querySelector('.copy-btn');
    copyBtn.click();
    codeCopyBtn.click();
    await Promise.resolve();
    assert.deepEqual(clipboard.calls, ['```js\nx\n```', 'console.log(1)']);
    assert.ok(timeouts.length >= 1);
    timeouts[0].fn();
    assert.equal(copyBtn.children.at(-1).textContent, 'Copy');

    const missing = replaceMessage({ id: 'missing', role: 'assistant', content: 'x' });
    assert.equal(missing, false);
    doc.getElementById('msgs-list').appendChild(rich);
    assert.equal(replaceMessage(assistant, true), true);

    const originalParse = globalThis.marked.parse;
    globalThis.marked.parse = () => '<pre></pre>';
    const noCode = buildMsgEl({ id: 'p1', role: 'assistant', content: 'plain', streaming: false });
    assert.equal(noCode.querySelector('.copy-code-btn'), null);
    globalThis.marked.parse = () => '<pre><code>console.log(1)</code></pre>';
    const noLang = buildMsgEl({ id: 'p2', role: 'assistant', content: 'plain', streaming: false });
    assert.equal(noLang.querySelector('.lang-label'), null);
    assert.ok(noLang.querySelector('.copy-code-btn'));
    globalThis.marked.parse = originalParse;
  } finally {
    restore();
  }
});

test('export.js exports only when there is conversation content', async () => {
  const doc = makeBaseDom();
  const urls = [];
  const restore = installGlobals({
    document: doc,
    localStorage: new MemoryStorage(),
    sessionStorage: new MemoryStorage(),
    navigator: { clipboard: makeClipboard() },
    URL: {
      createObjectURL(blob) {
        urls.push(blob);
        return 'blob:freeforge';
      },
      revokeObjectURL(url) {
        urls.push(url);
      },
    },
    Blob,
    marked: { use() {}, parse: text => text },
    DOMPurify: { addHook() {}, sanitize: raw => raw },
  });
  try {
    const state = await importShared('freeforge/src/state.js');
    resetState(state.S);
    const { exportConversation } = await importFresh('freeforge/src/features/export.js');
    let createdAnchor = null;
    const originalCreate = doc.createElement.bind(doc);
    doc.createElement = tag => {
      const el = originalCreate(tag);
      if (tag === 'a') createdAnchor = el;
      return el;
    };
    state.S.messages = [];
    exportConversation();
    assert.equal(doc.getElementById('toasts').children[0].innerHTML.includes('No conversation to export yet'), true);

    state.S.messages = [
      { role: 'user', content: 'hello' },
      { role: 'assistant', content: 'world' },
      { role: 'notice', content: 'skip me' },
    ];
    exportConversation();
    assert.equal(doc.getElementById('toasts').children.at(-1).innerHTML.includes('Conversation exported'), true);
    assert.equal(urls[0] instanceof Blob, true);
    assert.match(createdAnchor.download, /^freeforge-chat-\d{4}-\d{2}-\d{2}\.md$/);
  } finally {
    restore();
  }
});

test('models.js loads, populates, and changes model selection', async () => {
  const doc = makeBaseDom();
  const restore = installGlobals({
    document: doc,
    localStorage: new MemoryStorage(),
    sessionStorage: new MemoryStorage(),
    navigator: { clipboard: makeClipboard() },
    marked: { use() {}, parse: text => text },
    DOMPurify: { addHook() {}, sanitize: raw => raw },
    fetch: async url => {
      if (url.endsWith('/models')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: [
              { id: 'paid', name: 'Paid', context_length: 2000, pricing: { prompt: '1', completion: '1' } },
              { id: 'b', name: 'Bravo', context_length: 1000, pricing: { prompt: '0', completion: '0' } },
              { id: 'a:free', name: 'Alpha', context_length: 1000, pricing: { prompt: '0', completion: '0' } },
            ],
          }),
        };
      }
      throw new Error('unexpected fetch');
    },
  });
  try {
    const state = await importShared('freeforge/src/state.js');
    resetState(state.S);
    globalThis.localStorage.removeItem('ff_model');
    const { loadModels, populateModelsFromState, changeModel } = await importFresh('freeforge/src/features/models.js');
    await loadModels('key');
    assert.deepEqual(state.S.models.map(m => m.id), ['a:free', 'b']);
    assert.equal(doc.getElementById('model-select').children.length, 2);
    assert.equal(state.S.selectedModel, 'a:free');

    state.LS.set('ff_model', 'a:free');
    populateModelsFromState();
    assert.equal(state.S.selectedModel, 'a:free');
    changeModel('missing');
    assert.equal(doc.getElementById('toasts').children.at(-1).innerHTML.includes('Model unavailable'), true);
    changeModel('b');
    assert.equal(state.S.selectedModel, 'b');

    state.LS.set('ff_model', 'a:free');
    await loadModels('key');
    assert.equal(state.S.selectedModel, 'a:free');

    state.S.models = [];
    populateModelsFromState();
    assert.equal(doc.getElementById('model-select').innerHTML.includes('No free models'), true);

    state.S.models = [
      { id: 'z', context_length: 1000 },
      { id: 'a', name: 'Alpha', context_length: 1000 },
      { id: 'n', name: 'No Context' },
    ];
    state.LS.del('ff_model');
    populateModelsFromState();
    assert.deepEqual([...doc.getElementById('model-select').children].map(opt => opt.value), ['a', 'z', 'n']);

    const beforeNoopToastCount = doc.getElementById('toasts').children.length;
    changeModel('');
    assert.equal(doc.getElementById('toasts').children.length, beforeNoopToastCount);
    state.S.selectedModel = 'prev';
    state.S.models = [{ id: 'freeforge/model', context_length: 1000 }];
    const toastCount = doc.getElementById('toasts').children.length;
    changeModel('freeforge/model');
    assert.equal(doc.getElementById('toasts').children.length, toastCount + 1);
    assert.equal(state.S.selectedModel, 'freeforge/model');

    state.S.models = [
      { id: 'left', context_length: 1000 },
      { id: 'right' },
    ];
    populateModelsFromState();
    assert.equal(doc.getElementById('model-select').children[0].value, 'left');
    state.S.models = [
      { id: 'right' },
      { id: 'left', context_length: 1000 },
    ];
    populateModelsFromState();
    assert.equal(doc.getElementById('model-select').children[0].value, 'left');
    state.S.models = [
      { id: 'b' },
      { id: 'a' },
    ];
    populateModelsFromState();
    assert.deepEqual([...doc.getElementById('model-select').children].map(opt => opt.value), ['a', 'b']);

    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({ data: [] }),
    });
    await loadModels('empty');
    assert.equal(doc.getElementById('model-select').innerHTML.includes('No free models found'), true);

    globalThis.fetch = async () => ({
      ok: false,
      status: 401,
      json: async () => ({ error: { message: 'nope' } }),
    });
    await loadModels('bad');
    assert.equal(doc.getElementById('invalid-banner').classList.contains('hidden'), false);
  } finally {
    restore();
  }
});

test('onboarding.js validates keys, shows inline errors, and connects on success', async () => {
  const doc = makeBaseDom();
  const restore = installGlobals({
    document: doc,
    localStorage: new MemoryStorage(),
    sessionStorage: new MemoryStorage(),
    navigator: { clipboard: makeClipboard() },
    marked: { use() {}, parse: text => text },
    DOMPurify: { addHook() {}, sanitize: raw => raw },
  });
  try {
    const state = await importShared('freeforge/src/state.js');
    resetState(state.S);
    const { validateAndConnect, showObError, hideObError } = await importFresh('freeforge/src/features/onboarding.js');

    await validateAndConnect('   ');
    assert.equal(doc.getElementById('ob-key-error').textContent, 'Enter your API key first');
    await validateAndConnect('bad');
    assert.equal(doc.getElementById('ob-key-error').textContent, "Keys must start with 'sk-or-v1-'");
    showObError('broken');
    hideObError();
    assert.equal(doc.getElementById('ob-key-error').textContent, '');

    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({ data: [] }),
    });
    await validateAndConnect('sk-or-v1-empty');
    assert.equal(doc.getElementById('ob-key-error').textContent, 'No free models found for this key');

    let fetchCount = 0;
    globalThis.fetch = async () => {
      fetchCount += 1;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          data: [
            { id: 'm1', name: 'Model 1', pricing: { prompt: '0', completion: '0' } },
          ],
        }),
      };
    };
    await validateAndConnect('sk-or-v1-valid');
    assert.equal(fetchCount, 1);
    assert.equal(state.S.apiKey, 'sk-or-v1-valid');
    assert.equal(state.S.selectedModel, 'm1');
    assert.equal(doc.getElementById('settings-modal').classList.contains('open'), false);

    globalThis.fetch = async () => ({
      ok: false,
      status: 401,
      json: async () => ({ error: { message: 'invalid' } }),
    });
    await validateAndConnect('sk-or-v1-invalid');
    assert.equal(doc.getElementById('ob-key-error').textContent, 'Invalid API key — check and try again.');

    globalThis.fetch = async () => ({
      ok: false,
      status: 429,
      json: async () => ({ error: { message: 'rate limit' } }),
    });
    await validateAndConnect('sk-or-v1-rate');
    assert.equal(doc.getElementById('ob-key-error').textContent, 'Rate limited — wait a moment then retry.');

    globalThis.fetch = async () => ({
      ok: false,
      status: 401,
      json: async () => ({ error: { message: '401 unauthorized' } }),
    });
    await validateAndConnect('sk-or-v1-unauth');
    assert.equal(doc.getElementById('ob-key-error').textContent, 'Invalid API key — check and try again.');

    globalThis.fetch = async () => {
      throw new Error('offline');
    };
    await validateAndConnect('sk-or-v1-offline');
    assert.equal(doc.getElementById('ob-key-error').textContent, 'Network error — check your connection.');

    globalThis.fetch = async () => {
      throw {};
    };
    await validateAndConnect('sk-or-v1-nomsg');
    assert.equal(doc.getElementById('ob-key-error').textContent, 'Network error — check your connection.');
  } finally {
    restore();
  }
});

test('settings.js opens, traps focus, updates keys, and clears stored data', async () => {
  const doc = makeBaseDom();
  const focusOrder = [];
  doc.getElementById('settings-clear-btn').focus = function focus() {
    focusOrder.push(this.id);
    doc.activeElement = this;
  };
  doc.getElementById('settings-update-btn').focus = function focus() {
    focusOrder.push(this.id);
    doc.activeElement = this;
  };
  const restore = installGlobals({
    document: doc,
    localStorage: new MemoryStorage(),
    sessionStorage: new MemoryStorage(),
    navigator: { clipboard: makeClipboard() },
    marked: { use() {}, parse: text => text },
    DOMPurify: { addHook() {}, sanitize: raw => raw },
    setTimeout: (_fn, _ms) => 1,
    clearTimeout() {},
  });
  try {
    const state = await importShared('freeforge/src/state.js');
    resetState(state.S);
    state.S.apiKey = 'sk-or-v1-secret';
    const { openSettings, closeSettings, updateKey, clearKey, clearKeyError } = await importFresh('freeforge/src/features/settings.js');

    doc.activeElement = doc.getElementById('settings-btn');
    openSettings();
    assert.equal(doc.getElementById('settings-modal').classList.contains('open'), true);
    const modal = doc.getElementById('settings-modal');
    const focusables = modal.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])');
    assert.equal(doc.activeElement.id, focusables[0].id);
    assert.ok(focusables.length >= 2);
    doc.activeElement = focusables[0];
    const tabEvent = { type: 'keydown', key: 'Tab', shiftKey: true, preventDefault() { this.prevented = true; } };
    modal.dispatchEvent(tabEvent);
    assert.equal(tabEvent.prevented, true);
    doc.activeElement = focusables.at(-1);
    const forwardEvent = { type: 'keydown', key: 'Tab', shiftKey: false, preventDefault() { this.prevented = true; } };
    modal.dispatchEvent(forwardEvent);
    assert.equal(forwardEvent.prevented, true);

    const savedChildren = modal.children;
    modal.children = [];
    modal.dispatchEvent({ type: 'keydown', key: 'Tab', shiftKey: false, preventDefault() { this.prevented = true; } });
    modal.dispatchEvent({ type: 'keydown', key: 'Escape' });
    modal.children = savedChildren;

    clearKeyError();
    assert.equal(doc.getElementById('settings-key-error').textContent, '');

    doc.getElementById('settings-new-key').value = '';
    await updateKey();
    assert.equal(doc.getElementById('settings-key-error').textContent, 'Enter a key');

    doc.getElementById('settings-new-key').value = 'bad';
    await updateKey();
    assert.equal(doc.getElementById('settings-key-error').textContent, "Keys must start with 'sk-or-v1-'");

    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({ data: [] }),
    });
    doc.getElementById('settings-new-key').value = 'sk-or-v1-empty';
    await updateKey();
    assert.equal(doc.getElementById('settings-key-error').textContent, 'No free models found for this key');

    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        data: [
          { id: 'm2', name: 'Model 2', pricing: { prompt: '0', completion: '0' } },
        ],
      }),
    });
    doc.getElementById('settings-new-key').value = 'sk-or-v1-updated';
    await updateKey();
    assert.equal(state.S.apiKey, 'sk-or-v1-updated');
    assert.equal(doc.getElementById('settings-key-display').textContent, 'sk-or-••••••••••••ated');
    assert.equal(doc.getElementById('settings-modal').classList.contains('open'), false);

    globalThis.fetch = async () => {
      throw new Error('validation failed');
    };
    doc.getElementById('settings-new-key').value = 'sk-or-v1-broken';
    await updateKey();
    assert.equal(doc.getElementById('settings-key-error').textContent, 'validation failed');

    globalThis.fetch = async () => {
      throw {};
    };
    doc.getElementById('settings-new-key').value = 'sk-or-v1-broken2';
    await updateKey();
    assert.equal(doc.getElementById('settings-key-error').textContent, 'Invalid key');

    clearKey();
    assert.equal(doc.getElementById('settings-clear-btn').dataset.confirm, 'pending');
    clearKey();
    assert.equal(state.S.apiKey, null);
    assert.equal(doc.getElementById('screen-onboarding').classList.contains('active'), true);

    closeSettings();
    assert.equal(doc.getElementById('settings-modal').classList.contains('open'), false);
  } finally {
    restore();
  }
});

test('chat.js sends, regenerates, copies, and resets conversation state', async () => {
  const doc = makeBaseDom();
  const restore = installGlobals({
    document: doc,
    localStorage: new MemoryStorage(),
    sessionStorage: new MemoryStorage(),
    navigator: { clipboard: makeClipboard() },
    marked: { use() {}, parse: text => (text.includes('```') ? '<pre><code class="language-js">console.log(1)</code></pre>' : `<p>${text}</p>`) },
    DOMPurify: { addHook() {}, sanitize: raw => raw },
    fetch: async url => {
      if (url.endsWith('/chat/completions')) {
        return {
          ok: true,
          status: 200,
          body: makeSseBody([
            'data: {"choices":[{"delta":{"content":"Hi"}}]}\n',
            'data: {"usage":{"total_tokens":44}}\n',
            'data: [DONE]\n',
          ]),
        };
      }
      if (url.endsWith('/models')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: [
              { id: 'm1', name: 'Model 1', pricing: { prompt: '0', completion: '0' } },
            ],
          }),
        };
      }
      throw new Error('unexpected fetch');
    },
  });
  try {
    const state = await importShared('freeforge/src/state.js');
    resetState(state.S);
    const { sendMessage, regenerate, copyLastResponse, newChat } = await importFresh('freeforge/src/features/chat.js');

    state.S.selectedModel = null;
    await sendMessage('hello');
    assert.equal(doc.getElementById('toasts').children.at(-1).innerHTML.includes('Select a model first'), true);

    state.S.selectedModel = 'm1';
    state.S.apiKey = 'key';
    await sendMessage('   ');
    await sendMessage('x'.repeat(32001));
    assert.equal(doc.getElementById('toasts').children.at(-1).innerHTML.includes('Message too long'), true);

    state.S.messages = [];
    state.S.streaming = false;
    await sendMessage('Hello there');
    assert.equal(state.S.messages[0].role, 'user');
    assert.equal(state.S.messages[1].role, 'notice');
    assert.equal(state.S.messages[2].role, 'assistant');
    assert.equal(state.S.contextTokens, 44);
    assert.equal(state.S.usageIsExact, true);
    assert.equal(doc.getElementById('sr-status').textContent, 'Response complete');

    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      body: makeSseBody([
        'data: {"usage":{"total_tokens":9}}\n',
        'data: [DONE]\n',
      ]),
    });
    state.S.messages = [];
    state.S.streaming = false;
    await sendMessage('Usage only');
    assert.equal(state.S.contextTokens, 9);
    assert.equal(state.S.usageIsExact, true);

    const originalJsonParse = JSON.parse;
    JSON.parse = () => { throw new Error('bad json'); };
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      body: makeSseBody([
        'data: {"choices":[{"delta":{"content":"Hi"}}]}\n',
        'data: [DONE]\n',
      ]),
    });
    state.S.messages = [];
    state.S.streaming = false;
    await sendMessage('Parse fail');
    JSON.parse = originalJsonParse;

    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      body: makeSseBody([
        'data: {"choices":[{"delta":{"content":"Hi"}}]}\n',
        'data: {"usage":{"total_tokens":-1}}\n',
        'data: [DONE]\n',
      ]),
    });
    state.S.messages = [];
    state.S.streaming = false;
    await sendMessage('Negative tokens');
    assert.equal(state.S.contextTokens, 0);
    assert.equal(state.S.usageIsExact, true);

    globalThis.localStorage = new MemoryStorage({}, { throwOnSet: true });
    await sendMessage('Quota fail');
    assert.equal(doc.getElementById('toasts').children.at(-1).innerHTML.includes('Storage quota exceeded'), true);

    const originalQuery = doc.querySelector.bind(doc);
    doc.querySelector = sel => (sel.startsWith('[data-id="') ? null : originalQuery(sel));
    await sendMessage('No replace');
    doc.querySelector = originalQuery;

    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      body: makeSseBody([
        'data: {"choices":[{"delta":{"content":"Hi"}}]}\n',
        'data: [DONE]\n',
      ]),
    });
    state.S.messages = [];
    state.S.streaming = false;
    await sendMessage('Estimate me');
    assert.equal(state.S.usageIsExact, false);
    assert.equal(state.S.contextTokens > 0, true);

    globalThis.fetch = async () => {
      throw new Error('offline');
    };
    state.S.messages = [];
    state.S.streaming = false;
    await sendMessage('Fail me');
    assert.equal(doc.getElementById('sr-alert').textContent, 'Network error — check your connection.');

    globalThis.fetch = async url => {
      if (url.endsWith('/chat/completions')) {
        return {
          ok: true,
          status: 200,
          body: makeSseBody([
            'data: {"choices":[{"delta":{"content":"Hi"}}]}\n',
            'data: [DONE]\n',
          ]),
        };
      }
      if (url.endsWith('/models')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: [
              { id: 'm1', name: 'Model 1', pricing: { prompt: '0', completion: '0' } },
            ],
          }),
        };
      }
      throw new Error('unexpected fetch');
    };

    state.S.messages = [
      { id: 'u1', role: 'user', content: 'One' },
      { id: 'a1', role: 'assistant', content: 'Two' },
    ];
    state.S.streaming = true;
    await regenerate();
    assert.equal(state.S.messages.length, 2);
    state.S.streaming = false;
    state.S.messages = [
      { id: 'u1', role: 'user', content: 'One' },
      { id: 'a1', role: 'assistant', content: 'Two' },
      { id: 'n1', role: 'notice', content: 'note' },
    ];
    await regenerate();
    assert.equal(state.S.messages[state.S.messages.length - 1].role, 'assistant');

    state.S.messages = [{ id: 'a2', role: 'assistant', content: 'Only assistant' }];
    await regenerate();
    assert.equal(state.S.messages.length, 0);

    state.S.messages = [{ role: 'assistant', content: 'copy me' }];
    copyLastResponse();
    await Promise.resolve();
    assert.equal(doc.getElementById('toasts').children.at(-1).innerHTML.includes('Copied'), true);

    state.S.messages = [];
    copyLastResponse();
    assert.equal(doc.getElementById('toasts').children.at(-1).innerHTML.includes('No response to copy yet'), true);

    const abortCtrl = { abortCalled: false, abort() { this.abortCalled = true; } };
    state.S.abort = abortCtrl;
    state.S.messages = [{ role: 'user', content: 'a' }];
    state.S.streaming = true;
    newChat();
    assert.equal(abortCtrl.abortCalled, true);
    assert.deepEqual(state.S.messages, []);
    assert.equal(state.S.streaming, false);
    assert.equal(doc.getElementById('msgs-list').children.length, 0);
  } finally {
    restore();
  }
});
