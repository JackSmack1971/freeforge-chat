import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

test('palette focus trap is wired into open and close lifecycle', async () => {
  const source = await readFile(path.resolve('freeforge/src/features/palette.js'), 'utf8');

  assert.match(source, /function getFocusableInPalette\(\)/);
  assert.match(source, /function trapFocus\(e\)/);
  assert.match(source, /palette\.addEventListener\('keydown', trapFocus\)/);
  assert.match(source, /palette\?\.removeEventListener\('keydown', trapFocus\)/);
  assert.doesNotMatch(source, /cmd-palette.*Tab.*escape/i);
});
