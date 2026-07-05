import assert from 'node:assert/strict';
import test from 'node:test';

import { MemoryStorage, importFresh, importShared, installGlobals, makeBaseDom, makeClipboard } from '../helpers/mock-dom.mjs';

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
