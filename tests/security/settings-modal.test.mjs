import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

test('settings modal toggles hidden and aria-hidden during open and close', async () => {
  const js = await readFile(path.resolve('freeforge/src/features/settings.js'), 'utf8');
  const css = await readFile(path.resolve('freeforge/styles/app.css'), 'utf8');
  const html = await readFile(path.resolve('freeforge/index.html'), 'utf8');

  assert.match(js, /modal\.classList\.remove\('hidden'\)/);
  assert.match(js, /modal\.setAttribute\('aria-hidden', 'false'\)/);
  assert.match(js, /modal\.classList\.add\('hidden'\)/);
  assert.match(js, /modal\.setAttribute\('aria-hidden', 'true'\)/);
  assert.doesNotMatch(css, /#settings-modal\.open/);
  assert.match(html, /id="settings-modal"[^>]*aria-hidden="true"/);
});
