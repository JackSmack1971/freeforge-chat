import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

test('messages.js keeps scanning after an already-decorated code block', async () => {
  const source = await readFile(path.resolve('freeforge/src/ui/messages.js'), 'utf8');

  assert.match(source, /if \(!codeEl \|\| pre\.querySelector\('\.copy-code-btn'\)\) continue;/);
  assert.doesNotMatch(source, /if \(!codeEl \|\| pre\.querySelector\('\.copy-code-btn'\)\) return;/);
});
