import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

test('persistent toasts are cleared by new chat and key reset', async () => {
  const toastJs = await readFile(path.resolve('freeforge/src/ui/toast.js'), 'utf8');
  const chatJs = await readFile(path.resolve('freeforge/src/features/chat.js'), 'utf8');
  const settingsJs = await readFile(path.resolve('freeforge/src/features/settings.js'), 'utf8');

  assert.match(toastJs, /export function clearPersistent\(\)/);
  assert.match(toastJs, /querySelectorAll\('\.toast-persistent'\)\.forEach\(el => el\.remove\(\)\)/);
  assert.match(chatJs, /clearPersistent\(\);/);
  assert.match(settingsJs, /clearPersistent\(\);/);
});
