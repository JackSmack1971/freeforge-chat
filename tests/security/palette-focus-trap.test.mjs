import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

async function read(relPath) {
  return readFile(path.resolve(relPath), 'utf8');
}

test('modal focus trap uses one shared helper across settings, agent library, and palette', async () => {
  const helper = await read('freeforge/src/ui/focus-trap.js');
  const settings = await read('freeforge/src/features/settings.js');
  const agentLibrary = await read('freeforge/src/ui/agent-library.js');
  const palette = await read('freeforge/src/features/palette.js');

  assert.match(helper, /export function createFocusTrap\(containerEl\)/);
  assert.match(helper, /offsetParent !== null/);
  assert.match(settings, /createFocusTrap\(\$\('settings-modal'\)\)/);
  assert.match(agentLibrary, /createFocusTrap\(getModal\(\)\)/);
  assert.match(palette, /createFocusTrap\(palette\)/);
  assert.doesNotMatch(settings, /function trapFocus\(e\)/);
  assert.doesNotMatch(agentLibrary, /function trapFocus\(e\)/);
  assert.doesNotMatch(palette, /function trapFocus\(e\)/);
});
