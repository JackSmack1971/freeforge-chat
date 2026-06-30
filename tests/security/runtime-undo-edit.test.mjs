import assert from 'node:assert/strict';
import test from 'node:test';

import { MemoryStorage, MockElement, MockTextAreaElement, importFresh, importShared, installGlobals, makeBaseDom, makeClipboard, makeWindow } from '../helpers/mock-dom.mjs';

MockElement.prototype.setSelectionRange = function setSelectionRange() {};

function makeFiniteSseBody(chunks) {
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(new TextEncoder().encode(chunk));
      controller.close();
    },
  });
}

function makeAbortableSseBody(signal, chunks) {
  const encoder = new TextEncoder();
  return {
    getReader() {
      let idx = 0;
      return {
        async read() {
          if (idx < chunks.length) {
            return { done: false, value: encoder.encode(chunks[idx++]) };
          }
          return new Promise((resolve, reject) => {
            const err = new Error('aborted');
            err.name = 'AbortError';
            if (signal.aborted) {
              reject(err);
              return;
            }
            signal.addEventListener('abort', () => reject(err), { once: true });
          });
        },
        cancel() {
          return Promise.resolve();
        },
      };
    },
  };
}

function makeTimers() {
  let nextId = 1;
  let now = 0;
  const timers = new Map();

  function setTimeoutFake(fn, delay = 0, ...args) {
    const id = nextId++;
    timers.set(id, { fn, at: now + delay, args });
    return id;
  }

  function clearTimeoutFake(id) {
    timers.delete(id);
  }

  function runDue() {
    const due = [...timers.entries()]
      .filter(([, t]) => t.at <= now)
      .sort((a, b) => a[1].at - b[1].at || a[0] - b[0]);
    for (const [id, timer] of due) {
      timers.delete(id);
      timer.fn(...timer.args);
    }
  }

  return {
    setTimeout: setTimeoutFake,
    clearTimeout: clearTimeoutFake,
    advance(ms) {
      now += ms;
      runDue();
    },
  };
}

function resetState(S) {
  S.apiKey = null;
  S.models = [];
  S.selectedModel = null;
  S.messages = [];
  S.streaming = false;
  S.abort = null;
  S.streamTarget = null;
  S.inlineEditId = null;
  S.inlineEditUndo = null;
  S.contextTokens = 0;
  S.usageIsExact = false;
  S.ctxToastFired = false;
  S.lastAssistantResponse = '';
}

async function settle(turns = 3) {
  for (let i = 0; i < turns; i += 1) await Promise.resolve();
}

function patchClosest(node, selector, replacement) {
  const original = node.closest.bind(node);
  node.closest = sel => (sel === selector ? replacement : original(sel));
}

function findLastToastAction(doc) {
  const toast = doc.getElementById('toasts').children.at(-1);
  return toast?.querySelector('button') ?? null;
}

test('inline edit undo restores the previous slice while the replacement response is still streaming', async () => {
  const doc = makeBaseDom();
  const win = makeWindow();
  const timers = makeTimers();
  let lastSignal = null;
  const restore = installGlobals({
    document: doc,
    window: win,
    localStorage: new MemoryStorage({
      ff_msgs: JSON.stringify([
        { id: 'u-1', role: 'user', content: 'Original user text' },
        { id: 'a-1', role: 'assistant', content: 'Original assistant reply' },
      ]),
      ff_model: 'free-model',
    }),
    sessionStorage: new MemoryStorage({ ff_key: 'sk-or-v1-test' }),
    navigator: { clipboard: makeClipboard() },
    marked: { use() {}, parse: text => text },
    DOMPurify: { addHook() {}, sanitize: raw => raw },
    HTMLTextAreaElement: MockTextAreaElement,
    setTimeout: timers.setTimeout,
    clearTimeout: timers.clearTimeout,
    requestAnimationFrame: cb => { cb(); return 1; },
    fetch: async (url, opts = {}) => {
      if (url.endsWith('/models')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: [
              { id: 'free-model', name: 'Free Model', context_length: 1000, pricing: { prompt: '0', completion: '0' } },
            ],
          }),
        };
      }
      if (url.endsWith('/chat/completions')) {
        lastSignal = opts.signal;
        return {
          ok: true,
          status: 200,
          body: makeAbortableSseBody(opts.signal, [
            'data: {"choices":[{"delta":{"content":"Edited reply"}}]}\n',
          ]),
        };
      }
      throw new Error(`unexpected fetch: ${url}`);
    },
  });
  try {
    const state = await importShared('freeforge/src/state.js');
    resetState(state.S);
    await importFresh('freeforge/src/app.js');
    doc.dispatchEvent({ type: 'DOMContentLoaded' });
    await settle(4);

    const userBubble = doc.getElementById('msgs-list').querySelector('.msg-user-surface');
    const msgWrap = userBubble.closest('.msg-bubble');
    patchClosest(userBubble, '.msg-user-surface[data-inline-edit-target="true"]', userBubble);
    patchClosest(userBubble, '[data-id]', msgWrap);
    doc.dispatchEvent({ type: 'click', target: userBubble });
    await settle(2);

    const textarea = doc.getElementById('msgs-list').querySelector('.msg-inline-textarea');
    textarea.value = 'Edited user text';

    const saveBtn = doc.getElementById('msgs-list').querySelectorAll('button').find(btn => btn.dataset.inlineEditConfirm === 'true');
    patchClosest(saveBtn, '[data-inline-edit-confirm="true"]', saveBtn);
    patchClosest(saveBtn, '[data-id]', msgWrap);
    doc.dispatchEvent({ type: 'click', target: saveBtn });
    await settle(4);

    assert.equal(state.S.streaming, true);
    assert.equal(state.S.inlineEditUndo?.slice[0].content, 'Original user text');

    const undoBtn = findLastToastAction(doc);
    assert.ok(undoBtn);
    assert.match(undoBtn.dataset.action, /^inline-edit-undo:/);

    doc.dispatchEvent({ type: 'click', target: undoBtn });
    assert.equal(state.S.abort, null);
    assert.equal(lastSignal.aborted, true);
    await settle(4);

    assert.equal(state.S.streaming, false);
    assert.equal(state.S.inlineEditUndo, null);
    assert.deepEqual(state.S.messages.map(m => [m.role, m.content]), [
      ['user', 'Original user text'],
      ['assistant', 'Original assistant reply'],
    ]);
    assert.deepEqual(Array.from(globalThis.localStorage.map.keys()).sort(), ['ff_model', 'ff_msgs']);
    assert.equal(globalThis.sessionStorage.getItem('ff_key'), 'sk-or-v1-test');
  } finally {
    restore();
  }
});

test('later confirmed edits replace the undo snapshot and stale toast actions do nothing', async () => {
  const doc = makeBaseDom();
  const win = makeWindow();
  const timers = makeTimers();
  let completions = 0;
  const restore = installGlobals({
    document: doc,
    window: win,
    localStorage: new MemoryStorage({
      ff_msgs: JSON.stringify([
        { id: 'u-1', role: 'user', content: 'Original user text' },
        { id: 'a-1', role: 'assistant', content: 'Original assistant reply' },
      ]),
      ff_model: 'free-model',
    }),
    sessionStorage: new MemoryStorage({ ff_key: 'sk-or-v1-test' }),
    navigator: { clipboard: makeClipboard() },
    marked: { use() {}, parse: text => text },
    DOMPurify: { addHook() {}, sanitize: raw => raw },
    HTMLTextAreaElement: MockTextAreaElement,
    setTimeout: timers.setTimeout,
    clearTimeout: timers.clearTimeout,
    requestAnimationFrame: cb => { cb(); return 1; },
    fetch: async url => {
      if (url.endsWith('/models')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: [
              { id: 'free-model', name: 'Free Model', context_length: 1000, pricing: { prompt: '0', completion: '0' } },
            ],
          }),
        };
      }
      if (url.endsWith('/chat/completions')) {
        completions += 1;
        const reply = completions === 1 ? 'Edited one reply' : 'Edited two reply';
        return {
          ok: true,
          status: 200,
          body: makeFiniteSseBody([
            `data: {"choices":[{"delta":{"content":"${reply}"}}]}\n`,
            'data: [DONE]\n',
          ]),
        };
      }
      throw new Error(`unexpected fetch: ${url}`);
    },
  });
  try {
    const state = await importShared('freeforge/src/state.js');
    resetState(state.S);
    await importFresh('freeforge/src/app.js');
    doc.dispatchEvent({ type: 'DOMContentLoaded' });
    await settle(4);

    const editOnce = async nextText => {
      const bubble = doc.getElementById('msgs-list').querySelector('.msg-user-surface');
      const msgWrap = bubble.closest('.msg-bubble');
      patchClosest(bubble, '.msg-user-surface[data-inline-edit-target="true"]', bubble);
      patchClosest(bubble, '[data-id]', msgWrap);
      doc.dispatchEvent({ type: 'click', target: bubble });
      await settle(2);

      const textarea = doc.getElementById('msgs-list').querySelector('.msg-inline-textarea');
      textarea.value = nextText;

      const saveBtn = doc.getElementById('msgs-list').querySelectorAll('button').find(btn => btn.dataset.inlineEditConfirm === 'true');
      patchClosest(saveBtn, '[data-inline-edit-confirm="true"]', saveBtn);
      patchClosest(saveBtn, '[data-id]', msgWrap);
      doc.dispatchEvent({ type: 'click', target: saveBtn });
      await settle(4);
      return findLastToastAction(doc);
    };

    const firstUndoBtn = await editOnce('Edited one');
    const firstToken = state.S.inlineEditUndo.token;
    assert.ok(firstToken);
    assert.match(firstUndoBtn.dataset.action, /^inline-edit-undo:/);

    await settle(4);
    assert.equal(state.S.streaming, false);
    const notice = "You're chatting with a free OpenRouter model. Speed and quality may vary.";
    assert.deepEqual(state.S.messages.map(m => m.content), ['Edited one', notice, 'Edited one reply']);

    const secondUndoBtn = await editOnce('Edited two');
    const secondToken = state.S.inlineEditUndo.token;
    assert.notEqual(secondToken, firstToken);
    assert.match(secondUndoBtn.dataset.action, /^inline-edit-undo:/);
    assert.deepEqual(state.S.inlineEditUndo.slice.map(m => m.content), ['Edited one', notice, 'Edited one reply']);

    doc.dispatchEvent({ type: 'click', target: firstUndoBtn });
    await settle(2);
    assert.equal(state.S.inlineEditUndo.token, secondToken);
    assert.deepEqual(state.S.messages.map(m => m.content), ['Edited two', notice, 'Edited two reply']);

    doc.dispatchEvent({ type: 'click', target: secondUndoBtn });
    await settle(2);
    assert.equal(state.S.inlineEditUndo, null);
    assert.deepEqual(state.S.messages.map(m => m.content), ['Edited one', notice, 'Edited one reply']);
  } finally {
    restore();
  }
});

test('undo state stays in memory and clears after 6 seconds if unused', async () => {
  const doc = makeBaseDom();
  const win = makeWindow();
  const timers = makeTimers();
  const restore = installGlobals({
    document: doc,
    window: win,
    localStorage: new MemoryStorage({
      ff_msgs: JSON.stringify([
        { id: 'u-1', role: 'user', content: 'Original user text' },
        { id: 'a-1', role: 'assistant', content: 'Original assistant reply' },
      ]),
      ff_model: 'free-model',
    }),
    sessionStorage: new MemoryStorage({ ff_key: 'sk-or-v1-test' }),
    navigator: { clipboard: makeClipboard() },
    marked: { use() {}, parse: text => text },
    DOMPurify: { addHook() {}, sanitize: raw => raw },
    HTMLTextAreaElement: MockTextAreaElement,
    setTimeout: timers.setTimeout,
    clearTimeout: timers.clearTimeout,
    requestAnimationFrame: cb => { cb(); return 1; },
    fetch: async url => {
      if (url.endsWith('/models')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: [
              { id: 'free-model', name: 'Free Model', context_length: 1000, pricing: { prompt: '0', completion: '0' } },
            ],
          }),
        };
      }
      if (url.endsWith('/chat/completions')) {
        return {
          ok: true,
          status: 200,
          body: makeFiniteSseBody([
            'data: {"choices":[{"delta":{"content":"Edited reply"}}]}\n',
            'data: [DONE]\n',
          ]),
        };
      }
      throw new Error(`unexpected fetch: ${url}`);
    },
  });
  try {
    const state = await importShared('freeforge/src/state.js');
    resetState(state.S);
    await importFresh('freeforge/src/app.js');
    doc.dispatchEvent({ type: 'DOMContentLoaded' });
    await settle(4);

    const userBubble = doc.getElementById('msgs-list').querySelector('.msg-user-surface');
    const msgWrap = userBubble.closest('.msg-bubble');
    patchClosest(userBubble, '.msg-user-surface[data-inline-edit-target="true"]', userBubble);
    patchClosest(userBubble, '[data-id]', msgWrap);
    doc.dispatchEvent({ type: 'click', target: userBubble });
    await settle(2);

    const textarea = doc.getElementById('msgs-list').querySelector('.msg-inline-textarea');
    textarea.value = 'Edited user text';

    const saveBtn = doc.getElementById('msgs-list').querySelectorAll('button').find(btn => btn.dataset.inlineEditConfirm === 'true');
    patchClosest(saveBtn, '[data-inline-edit-confirm="true"]', saveBtn);
    patchClosest(saveBtn, '[data-id]', msgWrap);
    doc.dispatchEvent({ type: 'click', target: saveBtn });
    await settle(4);

    assert.ok(state.S.inlineEditUndo);
    assert.equal(globalThis.localStorage.getItem('inlineEditUndo'), null);
    assert.equal(globalThis.sessionStorage.getItem('inlineEditUndo'), null);

    timers.advance(6000);
    await settle(2);

    assert.equal(state.S.inlineEditUndo, null);
    assert.deepEqual(Array.from(globalThis.localStorage.map.keys()).sort(), ['ff_model', 'ff_msgs']);
    assert.deepEqual(Array.from(globalThis.sessionStorage.map.keys()).sort(), ['ff_key']);
  } finally {
    restore();
  }
});
