import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

async function read(relPath) {
  return readFile(path.resolve(relPath), 'utf8');
}

test('chat.js replaces context token totals instead of accumulating them', async () => {
  const source = await read('freeforge/src/features/chat.js');

  assert.match(source, /S\.contextTokens = exactTokens;/);
  assert.match(source, /S\.contextTokens = charEstimate;/);
  assert.doesNotMatch(source, /S\.contextTokens \+= exactTokens;/);
  assert.doesNotMatch(source, /S\.contextTokens \+= charEstimate;/);
});
