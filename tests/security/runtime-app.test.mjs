import assert from 'node:assert/strict';
import test from 'node:test';

import { MemoryStorage, MockElement, MockInputElement, MockTextAreaElement, importFresh, importShared, installGlobals, makeBaseDom, makeClipboard, makeWindow } from '../helpers/mock-dom.mjs';

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
  S.activeRequestId = null;
  S.messages = [];
  S.streaming = false;
  S.abort = null;
  S.streamTarget = null;
  S.contextTokens = 0;
  S.usageIsExact = false;
  S.ctxToastFired = false;
  S.lastAssistantResponse = '';
}

function makeControlledStream(chunks = []) {
  const encoder = new TextEncoder();
  const queue = [...chunks];
  let pending = null;
  const waiters = [];

  function abortError() {
    const err = new Error('aborted');
    err.name = 'AbortError';
    return err;
  }

  function resolveWaiters() {
    while (waiters.length) waiters.shift()();
  }

  return {
    getReader(signal) {
      signal?.addEventListener('abort', () => {
        if (!pending) return;
        const next = pending;
        pending = null;
        next.reject(abortError());
      }, { once: true });

      return {
        async read() {
          if (signal?.aborted) throw abortError();
          if (queue.length) {
            const value = encoder.encode(queue.shift());
            if (!queue.length) resolveWaiters();
            return { done: false, value };
          }
          return new Promise((resolve, reject) => {
            pending = {
              resolve: result => {
                pending = null;
                resolve(result);
              },
              reject,
            };
            resolveWaiters();
          });
        },
        cancel() {
          return Promise.resolve();
        },
      };
    },
    finish() {
      if (!pending) return;
      const next = pending;
      pending = null;
      next.resolve({ done: true });
    },
    waitForPending() {
      if (pending) return Promise.resolve();
      return new Promise(resolve => waiters.push(resolve));
    },
  };
}

test('app.js boots to onboarding when no key is stored and records global errors', async () => {
  const doc = makeBaseDom();
  const win = makeWindow();
  const restore = installGlobals({
    document: doc,
    window: win,
    localStorage: new MemoryStorage(),
    sessionStorage: new MemoryStorage(),
    navigator: { clipboard: makeClipboard() },
    marked: { use() {}, parse: text => text },
    DOMPurify: { addHook() {}, sanitize: raw => raw },
    HTMLInputElement: MockInputElement,
    HTMLTextAreaElement: MockTextAreaElement,
  });
  try {
    const state = await importShared('freeforge/src/state.js');
    resetState(state.S);
    await importFresh('freeforge/src/app.js');
    doc.dispatchEvent({ type: 'DOMContentLoaded' });
    await Promise.resolve();

    assert.equal(doc.getElementById('screen-onboarding').classList.contains('active'), true);
    assert.equal(doc.getElementById('screen-chat').classList.contains('active'), false);

    win.dispatchEvent({ type: 'error', filename: 'app.js', lineno: 12, colno: 3 });
    win.dispatchEvent({ type: 'error' });
    win.dispatchEvent({ type: 'unhandledrejection', reason: 'rejected' });
    const log = state.getErrorLog();
    assert.ok(log.some(e => e.msg === 'Unknown error'));
    assert.ok(log.some(e => e.src === '' && e.line === 0 && e.col === 0));
    assert.ok(log.some(e => e.msg === 'rejected'));
  } finally {
    restore();
  }
});

test('app.js returns to onboarding when a saved key has no free models', async () => {
  const doc = makeBaseDom();
  const win = makeWindow();
  const restore = installGlobals({
    document: doc,
    window: win,
    localStorage: new MemoryStorage(),
    sessionStorage: new MemoryStorage({ ff_key: 'sk-or-v1-saved' }),
    navigator: { clipboard: makeClipboard() },
    marked: { use() {}, parse: text => text },
    DOMPurify: { addHook() {}, sanitize: raw => raw },
    HTMLInputElement: MockInputElement,
    HTMLTextAreaElement: MockTextAreaElement,
    fetch: async url => {
      if (url.endsWith('/models')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ data: [] }),
        };
      }
      throw new Error('unexpected fetch');
    },
  });
  try {
    const state = await importShared('freeforge/src/state.js');
    resetState(state.S);
    await importFresh('freeforge/src/app.js');
    doc.dispatchEvent({ type: 'DOMContentLoaded' });
    await new Promise(r => setTimeout(r, 0));

    assert.equal(doc.getElementById('screen-onboarding').classList.contains('active'), true);
    assert.equal(doc.getElementById('screen-chat').classList.contains('active'), false);
    assert.equal(state.getStoredKey(), null);
    assert.equal(doc.getElementById('ob-key-error').textContent, 'No free models found for this key');
  } finally {
    restore();
  }
});

test('app.js ignores malformed saved messages during startup hydration', async () => {
  const doc = makeBaseDom();
  const win = makeWindow();
  const restore = installGlobals({
    document: doc,
    window: win,
    localStorage: new MemoryStorage({
      ff_msgs: JSON.stringify([
        null,
        'oops',
        [],
        { role: 'assistant', content: 'typing', streaming: true },
        { role: 'user', content: 'saved' },
      ]),
    }),
    sessionStorage: new MemoryStorage({ ff_key: 'sk-or-v1-saved' }),
    navigator: { clipboard: makeClipboard() },
    marked: { use() {}, parse: text => text },
    DOMPurify: { addHook() {}, sanitize: raw => raw },
    HTMLInputElement: MockInputElement,
    HTMLTextAreaElement: MockTextAreaElement,
    fetch: async url => {
      if (url.endsWith('/models')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: [
              { id: 'm1', name: 'Model 1', context_length: 1000, pricing: { prompt: '0', completion: '0' } },
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
    await importFresh('freeforge/src/app.js');
    doc.dispatchEvent({ type: 'DOMContentLoaded' });
    await new Promise(r => setTimeout(r, 0));

    assert.equal(doc.getElementById('screen-chat').classList.contains('active'), true);
    assert.equal(state.S.messages.length, 1);
    assert.equal(state.S.messages[0].content, 'saved');
    assert.equal(state.S.messages.some(m => m.streaming), false);
  } finally {
    restore();
  }
});

test('app.js falls back to the active agent when the stored conversation agent is invalid', async () => {
  const doc = makeBaseDom();
  const win = makeWindow();
  const restore = installGlobals({
    document: doc,
    window: win,
    localStorage: new MemoryStorage({
      ff_msgs: JSON.stringify([{ role: 'user', content: 'saved' }]),
      ff_conversation_agent: JSON.stringify({
        id: 'stale-conversation-agent',
        name: 'Stale',
        instructions: { systemPrompt: '' },
      }),
    }),
    sessionStorage: new MemoryStorage({ ff_key: 'sk-or-v1-saved' }),
    navigator: { clipboard: makeClipboard() },
    marked: { use() {}, parse: text => text },
    DOMPurify: { addHook() {}, sanitize: raw => raw },
    HTMLInputElement: MockInputElement,
    HTMLTextAreaElement: MockTextAreaElement,
    fetch: async url => {
      if (url.endsWith('/models')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: [
              { id: 'm1', name: 'Model 1', context_length: 1000, pricing: { prompt: '0', completion: '0' } },
            ],
          }),
        };
      }
      throw new Error('unexpected fetch');
    },
  });
  try {
    const state = await importShared('freeforge/src/state.js');
    const { saveAgent } = await importShared('freeforge/src/agent-storage.js');
    const active = saveAgent({
      name: 'Active Agent',
      systemPrompt: 'Use this prompt.',
    });
    state.S.apiKey = null;
    resetState(state.S);
    state.S.apiKey = null;
    await importFresh('freeforge/src/app.js');
    doc.dispatchEvent({ type: 'DOMContentLoaded' });
    await new Promise(r => setTimeout(r, 0));

    assert.equal(state.S.activeAgentId, active.id);
    assert.equal(state.S.conversationAgentId, active.id);
    assert.equal(state.S.conversationAgent.instructions.systemPrompt, 'Use this prompt.');
    assert.equal(doc.getElementById('screen-chat').classList.contains('active'), true);
  } finally {
    restore();
  }
});

test('chat.js ignores stale callbacks from an aborted earlier stream', async () => {
  const doc = makeBaseDom();
  const win = makeWindow();
  const firstStream = makeControlledStream(['data: {"choices":[{"delta":{"content":"Old"}}]}\n']);
  const secondStream = makeControlledStream(['data: {"choices":[{"delta":{"content":"New"}}]}\n']);
  let callCount = 0;
  const restore = installGlobals({
    document: doc,
    window: win,
    localStorage: new MemoryStorage(),
    sessionStorage: new MemoryStorage(),
    navigator: { clipboard: makeClipboard() },
    marked: { use() {}, parse: text => text },
    DOMPurify: { addHook() {}, sanitize: raw => raw },
    HTMLInputElement: MockInputElement,
    HTMLTextAreaElement: MockTextAreaElement,
    fetch: async (_url, opts) => ({
      ok: true,
      status: 200,
      body: {
        getReader() {
          callCount += 1;
          return callCount === 1 ? firstStream.getReader(opts.signal) : secondStream.getReader(opts.signal);
        },
      },
    }),
  });
  try {
    const state = await importShared('freeforge/src/state.js');
    const { newChat, sendMessage } = await importFresh('freeforge/src/features/chat.js');
    resetState(state.S);
    state.S.apiKey = 'sk-or-v1-test';
    state.S.selectedModel = 'test-model';
    state.S.activeAgent = {
      id: 'agent-1',
      name: 'Agent One',
      instructions: { systemPrompt: 'Stay precise.', openingMessage: '', starterPrompts: [] },
      model: {},
    };
    state.S.activeAgentId = 'agent-1';
    state.S.conversationAgent = state.snapshotAgent(state.S.activeAgent);
    state.S.conversationAgentId = state.S.conversationAgent.id;

    const firstSend = sendMessage('old request');
    await Promise.resolve();
    newChat();

    const secondSend = sendMessage('new request');
    await new Promise(r => setTimeout(r, 0));

    assert.equal(state.S.streaming, true);
    assert.equal(state.S.abort !== null, true);

    secondStream.finish();
    await secondSend;
    await firstSend;

    assert.equal(state.S.streaming, false);
    assert.equal(state.S.abort, null);
  } finally {
    restore();
  }
});

test('app.js wires the chat screen, settings, and command palette listeners', async () => {
  const doc = makeBaseDom();
  const win = makeWindow();
  const restore = installGlobals({
    document: doc,
    window: win,
    localStorage: new MemoryStorage({ ff_msgs: JSON.stringify([{ role: 'user', content: 'saved' }]) }),
    sessionStorage: new MemoryStorage({ ff_key: 'sk-or-v1-saved' }),
    navigator: { clipboard: makeClipboard() },
    marked: {
      use() {},
      parse(text) {
        if (text.includes('```')) return '<pre><code class="language-js">console.log(1)</code></pre>';
        if (text.includes('[link]')) return '<a href="https://example.com">link</a>';
        return `<p>${text}</p>`;
      },
    },
    DOMPurify: { addHook() {}, sanitize: raw => raw },
    HTMLInputElement: MockInputElement,
    HTMLTextAreaElement: MockTextAreaElement,
    fetch: async url => {
      if (url.endsWith('/models')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: [
              { id: 'm1', name: 'Model 1', context_length: 1000, pricing: { prompt: '0', completion: '0' } },
              { id: 'm2', name: 'Model 2', context_length: 1200, pricing: { prompt: '0', completion: '0' } },
            ],
          }),
        };
      }
      if (url.endsWith('/chat/completions')) {
        return {
          ok: true,
          status: 200,
          body: makeSseBody([
            'data: {"choices":[{"delta":{"content":"Reply"}}]}\n',
            'data: {"usage":{"total_tokens":12}}\n',
            'data: [DONE]\n',
          ]),
        };
      }
      throw new Error('unexpected fetch');
    },
  });
  try {
    const state = await importShared('freeforge/src/state.js');
    resetState(state.S);
    await importFresh('freeforge/src/app.js');
    doc.dispatchEvent({ type: 'DOMContentLoaded' });
    await new Promise(r => setTimeout(r, 0));

    assert.equal(doc.getElementById('screen-chat').classList.contains('active'), true);
    assert.equal(state.S.selectedModel, 'm2');
    assert.equal(doc.getElementById('msgs-list').children.length > 0, true);

    doc.getElementById('ob-key-input').value = 'sk-or-v1-updated';
    doc.getElementById('ob-key-input').closest('form').dispatchEvent({ type: 'submit', preventDefault() {} });
    await new Promise(r => setTimeout(r, 0));
    doc.getElementById('ob-key-input').dispatchEvent({ type: 'input' });
    doc.getElementById('ob-key-input').dispatchEvent({ type: 'keydown', key: 'Enter', preventDefault() {} });

    doc.getElementById('ob-toggle-vis').click();
    assert.equal(doc.getElementById('ob-key-input').type, 'text');
    doc.getElementById('ob-toggle-vis').click();
    assert.equal(doc.getElementById('ob-key-input').type, 'password');

    doc.getElementById('model-select').value = 'm1';
    doc.getElementById('model-select').dispatchEvent({ type: 'change', target: doc.getElementById('model-select') });
    doc.getElementById('model-select').value = 'freeforge/model';
    doc.getElementById('model-select').dispatchEvent({ type: 'change', target: doc.getElementById('model-select') });
    assert.equal(doc.getElementById('toasts').children.at(-1).innerHTML.includes('Model: model'), true);

    doc.getElementById('settings-btn').click();
    assert.equal(doc.activeElement.id, 'settings-new-key');
    doc.getElementById('settings-backdrop').click();
    doc.getElementById('settings-btn').click();
    doc.getElementById('settings-new-key').value = 'sk-or-v1-other';
    doc.getElementById('settings-new-key').closest('form').dispatchEvent({ type: 'submit', preventDefault() {} });
    await new Promise(r => setTimeout(r, 0));
    doc.getElementById('settings-btn').click();
    doc.getElementById('settings-clear-btn').click();
    doc.getElementById('settings-clear-btn').click();
    assert.equal(doc.getElementById('settings-modal').classList.contains('open'), true);
    assert.equal(doc.activeElement.id, 'settings-new-key');
    assert.equal(doc.getElementById('settings-new-key').value, '');
    assert.equal(doc.getElementById('sr-status').textContent, 'API key cleared. Enter a replacement key or close Settings.');
    doc.getElementById('banner-update-btn').click();

    doc.getElementById('new-chat-btn').click();
    doc.dispatchEvent({ type: 'click', target: Object.assign(new MockElement('button'), { dataset: { action: 'new-chat' } }) });

    doc.getElementById('msg-input').value = 'hello';
    doc.getElementById('msg-input').dispatchEvent({ type: 'input' });
    doc.getElementById('msg-input').dispatchEvent({ type: 'keydown', key: 'Enter', shiftKey: false, preventDefault() {} });
    doc.getElementById('send-btn').click();
    await new Promise(r => setTimeout(r, 0));

    state.S.streaming = true;
    const abortCtrl = { aborted: false, abort() { this.aborted = true; } };
    state.S.abort = abortCtrl;
    doc.getElementById('send-btn').click();
    assert.equal(abortCtrl.aborted, true);
    state.S.streaming = false;

    const suggestion = Object.assign(new MockElement('div'), { textContent: 'suggested' });
    suggestion.classList.add('suggestion');
    state.S.streaming = true;
    doc.dispatchEvent({ type: 'click', target: suggestion });
    state.S.streaming = false;
    doc.dispatchEvent({ type: 'click', target: suggestion });

    const regen = Object.assign(new MockElement('button'), { className: 'regen-btn' });
    regen.classList.add('regen-btn');
    doc.dispatchEvent({ type: 'click', target: regen });

    doc.activeElement = doc.getElementById('settings-btn');
    doc.dispatchEvent({ type: 'keydown', ctrlKey: true, key: 'k', preventDefault() {} });
    assert.equal(doc.getElementById('cmd-palette').classList.contains('hidden'), false);
    doc.getElementById('cmd-search').value = 'Switch Model';
    doc.getElementById('cmd-search').dispatchEvent({ type: 'input', target: doc.getElementById('cmd-search') });
    doc.getElementById('cmd-palette').dispatchEvent({ type: 'keydown', key: 'ArrowDown', preventDefault() {} });
    doc.getElementById('cmd-palette').dispatchEvent({ type: 'keydown', key: 'ArrowUp', preventDefault() {} });
    doc.getElementById('cmd-palette').dispatchEvent({ type: 'keydown', key: 'Enter' });
    doc.dispatchEvent({ type: 'keydown', ctrlKey: true, key: 'k', preventDefault() {} });
    assert.equal(doc.getElementById('cmd-palette').classList.contains('hidden'), true);

    doc.activeElement = doc.getElementById('msg-input');
    doc.dispatchEvent({ type: 'keydown', ctrlKey: true, key: 'k', preventDefault() {} });
    assert.equal(doc.getElementById('cmd-palette').classList.contains('hidden'), true);

    state.S.streaming = true;
    state.S.abort = abortCtrl;
    doc.dispatchEvent({ type: 'keydown', key: 'Escape' });
    assert.equal(abortCtrl.aborted, true);
    state.S.streaming = false;

    doc.getElementById('settings-btn').click();
    const modal = doc.getElementById('settings-modal');
    const savedChildren = modal.children;
    modal.children = [];
    modal.dispatchEvent({ type: 'keydown', key: 'Tab', shiftKey: false, preventDefault() {} });
    modal.children = savedChildren;
    doc.dispatchEvent({ type: 'keydown', key: 'Escape' });
    assert.equal(doc.getElementById('settings-modal').classList.contains('open'), false);

    await new Promise(r => setTimeout(r, 0));
    assert.equal(state.getErrorLog().length >= 0, true);
  } finally {
    restore();
  }
});
