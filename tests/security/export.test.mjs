import assert from 'node:assert/strict';
import test from 'node:test';

import { S } from '../../freeforge/src/state.js';
import { importFresh, installGlobals, makeBaseDom, makeWindow } from '../helpers/mock-dom.mjs';

async function loadExportModule({ onCreateObjectURL, onRevokeObjectURL } = {}) {
  const doc = makeBaseDom();
  const restore = installGlobals({
    document: doc,
    window: makeWindow(),
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
    S.messages = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'World' },
    ];

    mod.exportConversation();

    assert.ok(capturedBlob);
    const text = await capturedBlob.text();
    assert.equal(text, '## user\n\nHello\n\n---\n\n## assistant\n\nWorld');
  } finally {
    restore();
  }
});

test('exportConversation revokes the created object URL after the anchor click', async () => {
  let capturedBlob = null;
  const revoked = [];
  const { doc, mod, restore } = await loadExportModule({
    onCreateObjectURL(blob) {
      capturedBlob = blob;
      return 'blob:fake-url';
    },
    onRevokeObjectURL(url) {
      revoked.push(url);
    },
  });

  const originalCreateElement = doc.createElement.bind(doc);
  let clickCount = 0;
  doc.createElement = tag => {
    const el = originalCreateElement(tag);
    if (tag === 'a') el.click = () => { clickCount += 1; };
    return el;
  };

  try {
    S.messages = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'World' },
    ];

    mod.exportConversation();

    assert.ok(capturedBlob);
    assert.equal(clickCount, 1);
    assert.deepEqual(revoked, ['blob:fake-url']);
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
    S.messages = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'World' },
    ];

    mod.exportConversation();

    const toasts = doc.getElementById('toasts');
    const msg = toasts.children[0]?.querySelector('span');
    assert.equal(toasts.children.length, 1);
    assert.match(msg?.textContent ?? '', /Conversation exported/);
  } finally {
    restore();
  }
});
