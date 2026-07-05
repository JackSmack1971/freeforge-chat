import assert from 'node:assert/strict';
import test from 'node:test';

import { MemoryStorage, importFresh, importShared, installGlobals, makeBaseDom, makeClipboard } from '../helpers/mock-dom.mjs';

async function loadExportModule({ onCreateObjectURL, onRevokeObjectURL } = {}) {
  const doc = makeBaseDom();
  const restore = installGlobals({
    document: doc,
    window: {},
    URL: {
      createObjectURL(blob) {
        if (onCreateObjectURL) return onCreateObjectURL(blob);
        return 'blob:fake-url';
      },
      revokeObjectURL(url) {
        if (onRevokeObjectURL) onRevokeObjectURL(url);
      },
    },
  });
  const mod = await importFresh('freeforge/src/features/export.js');
  return { doc, mod, restore };
}

test('exportConversation shows info toast when there is nothing to export', async () => {
  const { doc, mod, restore } = await loadExportModule({
    onCreateObjectURL() {
      throw new Error('createObjectURL should not be called');
    },
  });

  try {
    const { S } = await importShared('freeforge/src/state.js');
    S.messages = [];
    mod.exportConversation();

    const toasts = doc.getElementById('toasts');
    const msg = toasts.children[0]?.querySelector('span');
    assert.equal(toasts.children.length, 1);
    assert.match(msg?.textContent ?? '', /No conversation to export yet/);
  } finally {
    restore();
  }
});

test('exportConversation excludes notice messages from exported markdown', async () => {
  let capturedBlob = null;
  const { mod, restore } = await loadExportModule({
    onCreateObjectURL(blob) {
      capturedBlob = blob;
      return 'blob:fake-url';
    },
  });

  try {
    const { S } = await importShared('freeforge/src/state.js');
    S.messages = [
      { role: 'user', content: 'Hello' },
      { role: 'notice', content: 'ignored' },
      { role: 'assistant', content: 'World' },
    ];

    mod.exportConversation();

    assert.ok(capturedBlob);
    const text = await capturedBlob.text();
    assert.equal(text, '## user\n\nHello\n\n---\n\n## assistant\n\nWorld');
    assert.doesNotMatch(text, /ignored/);
    await new Promise(resolve => setTimeout(resolve, 0));
  } finally {
    restore();
  }
});

test('exportConversation formats messages with markdown separators', async () => {
  let capturedBlob = null;
  const { mod, restore } = await loadExportModule({
    onCreateObjectURL(blob) {
      capturedBlob = blob;
      return 'blob:fake-url';
    },
  });

  try {
    const { S } = await importShared('freeforge/src/state.js');
    S.messages = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'World' },
    ];

    mod.exportConversation();

    assert.ok(capturedBlob);
    const text = await capturedBlob.text();
    assert.equal(text, '## user\n\nHello\n\n---\n\n## assistant\n\nWorld');
    await new Promise(resolve => setTimeout(resolve, 0));
  } finally {
    restore();
  }
});

test('exportConversation shows a success toast after exporting', async () => {
  const { doc, mod, restore } = await loadExportModule({
    onCreateObjectURL() {
      return 'blob:fake-url';
    },
  });

  try {
    const { S } = await importShared('freeforge/src/state.js');
    S.messages = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'World' },
    ];

    mod.exportConversation();

    const toasts = doc.getElementById('toasts');
    const msg = toasts.children[0]?.querySelector('span');
    assert.equal(toasts.children.length, 1);
    assert.match(msg?.textContent ?? '', /Conversation exported/);
    await new Promise(resolve => setTimeout(resolve, 0));
  } finally {
    restore();
  }
});

test('exportConversation defers object URL revocation until after the click', async () => {
  const doc = makeBaseDom();
  const revoked = [];
  let createdBlob = null;
  const restore = installGlobals({
    document: doc,
    localStorage: new MemoryStorage(),
    sessionStorage: new MemoryStorage(),
    navigator: { clipboard: makeClipboard() },
    URL: {
      createObjectURL(blob) {
        createdBlob = blob;
        return 'blob:conversation';
      },
      revokeObjectURL(url) {
        revoked.push(url);
      },
    },
    Blob,
    marked: { use() {}, parse: text => text },
    DOMPurify: { addHook() {}, sanitize: raw => raw },
  });
  try {
    const state = await importShared('freeforge/src/state.js');
    state.S.messages = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'World' },
    ];
    const { exportConversation } = await importFresh('freeforge/src/features/export.js');

    exportConversation();

    assert.ok(createdBlob);
    assert.deepEqual(revoked, []);
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.deepEqual(revoked, ['blob:conversation']);
  } finally {
    restore();
  }
});

test('agents.js defers object URL revocation until after the click', async () => {
  const doc = makeBaseDom();
  const revoked = [];
  let createdAnchor = null;
  const restore = installGlobals({
    document: doc,
    localStorage: new MemoryStorage(),
    sessionStorage: new MemoryStorage(),
    navigator: { clipboard: makeClipboard() },
    URL: {
      createObjectURL() {
        return 'blob:agent';
      },
      revokeObjectURL(url) {
        revoked.push(url);
      },
    },
    Blob,
    marked: { use() {}, parse: text => text },
    DOMPurify: { addHook() {}, sanitize: raw => raw },
  });
  try {
    const state = await importShared('freeforge/src/state.js');
    const { saveAgent, setActiveAgent } = await importShared('freeforge/src/agent-storage.js');
    const saved = saveAgent({
      name: 'Research/QA:1',
      systemPrompt: 'Use this prompt.',
    });
    setActiveAgent(saved.id);
    state.S.messages = [];

    const originalCreate = doc.createElement.bind(doc);
    doc.createElement = tag => {
      const el = originalCreate(tag);
      if (tag === 'a') createdAnchor = el;
      return el;
    };

    const { initAgents } = await importFresh('freeforge/src/features/agents.js');
    initAgents();
    doc.getElementById('agent-library-export-btn').click();

    assert.equal(createdAnchor.download, 'Research-QA-1.json');
    assert.deepEqual(revoked, []);
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.deepEqual(revoked, ['blob:agent']);
  } finally {
    restore();
  }
});
