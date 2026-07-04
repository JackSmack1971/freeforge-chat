import assert from 'node:assert/strict';
import test from 'node:test';

import { MemoryStorage, importFresh, importShared, installGlobals, makeBaseDom, makeClipboard } from '../helpers/mock-dom.mjs';

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

test('persistent toasts are cleared by new chat and key reset', async () => {
  const doc = makeBaseDom();
  const restore = installGlobals({
    document: doc,
    localStorage: new MemoryStorage(),
    sessionStorage: new MemoryStorage(),
    navigator: { clipboard: makeClipboard() },
    marked: { use() {}, parse: text => text },
    DOMPurify: { addHook() {}, sanitize: raw => raw },
    setTimeout: (fn, ms) => {
      if (ms === 0) fn();
      return 1;
    },
    clearTimeout() {},
  });
  try {
    const { S } = await importShared('freeforge/src/state.js');
    resetState(S);
    const { toast } = await importFresh('freeforge/src/ui/toast.js');
    const { newChat } = await importFresh('freeforge/src/features/chat.js');
    const { clearKey } = await importFresh('freeforge/src/features/settings.js');

    toast('Persistent note', 'info', 0, { id: 'new-chat', label: 'New Chat' });
    assert.equal(doc.getElementById('toasts').children.length, 1);
    assert.equal(doc.getElementById('toasts').children[0].classList.contains('toast-persistent'), true);

    newChat();
    assert.equal(doc.getElementById('toasts').children.length, 0);

    toast('Persistent note', 'info', 0, { id: 'new-chat', label: 'New Chat' });
    S.apiKey = 'sk-or-v1-secret';
    clearKey();
    assert.equal(doc.getElementById('settings-clear-btn').dataset.confirm, 'pending');
    clearKey();
    assert.equal(doc.getElementById('toasts').children.length, 0);
    assert.equal(S.apiKey, null);
  } finally {
    restore();
  }
});
