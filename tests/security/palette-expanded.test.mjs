import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

test('palette trigger tracks expanded state across open and close', async () => {
  const html = await readFile(path.resolve('freeforge/index.html'), 'utf8');

  assert.match(html, /<button[^>]*id="palette-trigger-btn"[^>]*aria-expanded="false"/);
  assert.match(html, /id="palette-trigger-btn"[^>]*aria-label="Open command palette"[^>]*aria-expanded="false"/);
  const js = await readFile(path.resolve('freeforge/src/features/palette.js'), 'utf8');
  assert.match(js, /setAttribute\('aria-expanded', 'true'\)/);
  assert.match(js, /setAttribute\('aria-expanded', 'false'\)/);
});
