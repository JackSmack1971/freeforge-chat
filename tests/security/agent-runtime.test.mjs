import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

import { buildRequestMessages } from '../../freeforge/src/agent-runtime.js';

async function read(relPath) {
  return readFile(path.resolve(relPath), 'utf8');
}

test('buildRequestMessages prepends a single system message and preserves normal chat payloads', () => {
  const payload = buildRequestMessages([
    { role: 'user', content: 'Hello' },
    { role: 'notice', content: 'Ignore me' },
    { role: 'assistant', content: '' },
    { role: 'assistant', content: 'Hi there' },
  ], {
    instructions: {
      systemPrompt: ' You are a helpful agent. ',
    },
  });

  assert.deepEqual(payload, [
    { role: 'system', content: 'You are a helpful agent.' },
    { role: 'user', content: 'Hello' },
    { role: 'assistant', content: 'Hi there' },
  ]);
});

test('buildRequestMessages preserves standard chat behavior when no agent is selected', () => {
  const payload = buildRequestMessages([
    { role: 'user', content: 'Hello' },
    { role: 'assistant', content: 'Hi there' },
  ], null);

  assert.deepEqual(payload, [
    { role: 'user', content: 'Hello' },
    { role: 'assistant', content: 'Hi there' },
  ]);
});

test('streamCompletion accepts a request object', async () => {
  const source = await read('freeforge/src/api.js');
  assert.match(source, /export async function streamCompletion\(\{ messages, modelId, apiKey, parameters = \{\}, onToken, onDone, onError, signal \}\)/);
});

