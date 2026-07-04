import assert from 'node:assert/strict';
import test from 'node:test';

import { importFresh, installGlobals, makeBaseDom, makeClipboard } from '../helpers/mock-dom.mjs';

test('palette trigger tracks expanded state across open and close', async () => {
  const doc = makeBaseDom();
  doc.getElementById('palette-trigger-btn').setAttribute('aria-expanded', 'false');
  const restore = installGlobals({
    document: doc,
    navigator: { clipboard: makeClipboard() },
    marked: { use() {}, parse: text => text },
    DOMPurify: { addHook() {}, sanitize: raw => raw },
  });
  try {
    const { openPalette, closePalette } = await importFresh('freeforge/src/features/palette.js');

    openPalette();
    assert.equal(doc.getElementById('palette-trigger-btn').getAttribute('aria-expanded'), 'true');
    assert.equal(doc.getElementById('cmd-palette').classList.contains('hidden'), false);

    closePalette();
    assert.equal(doc.getElementById('palette-trigger-btn').getAttribute('aria-expanded'), 'false');
    assert.equal(doc.getElementById('cmd-palette').classList.contains('hidden'), true);
  } finally {
    restore();
  }
});
