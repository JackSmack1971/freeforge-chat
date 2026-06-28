import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

test('model-select has a programmatic label', async () => {
  const html = await readFile(path.resolve('freeforge/index.html'), 'utf8');

  assert.match(html, /<select id="model-select"[^>]*aria-label="Select AI model"/);
});
