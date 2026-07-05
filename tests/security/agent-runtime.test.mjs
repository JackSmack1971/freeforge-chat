import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

import { buildRequestContext, buildRequestMessages } from '../../freeforge/src/agent-runtime.js';

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

test('buildRequestMessages ignores malformed system prompts instead of throwing', () => {
  const payload = buildRequestMessages([
    { role: 'user', content: 'Hello' },
  ], {
    instructions: {
      systemPrompt: { trim: 'not a function' },
    },
  });

  assert.deepEqual(payload, [
    { role: 'user', content: 'Hello' },
  ]);
});

test('buildRequestContext trims older turns once the request budget is reached', () => {
  const messages = Array.from({ length: 12 }, (_, i) => ({
    role: i % 2 === 0 ? 'user' : 'assistant',
    content: `${i}:${'x'.repeat(400)}`
  }));

  const request = buildRequestContext(messages, {
    instructions: {
      systemPrompt: 'You are a concise assistant.'
    }
  }, 1000);

  assert.equal(request.messages[0].role, 'system');
  assert.equal(request.messages.at(-1).content.startsWith('11:'), true);
  assert.equal(request.messages.some(message => message.content.startsWith('0:')), false);
  assert.equal(request.messages.length < messages.length + 1, true);
  assert.equal(JSON.stringify(request.messages).length < JSON.stringify([{ role: 'system', content: 'You are a concise assistant.' }, ...messages]).length, true);
});

test('streamCompletion accepts a request object', async () => {
  const source = await read('freeforge/src/api.js');
  assert.match(source, /export async function streamCompletion\(\{\s*messages,\s*modelId,\s*apiKey,\s*parameters = \{\},\s*onToken = \(\) => \{\},\s*onDone = \(\) => \{\},\s*onError = \(\) => \{\},\s*signal,\s*\} = \{\}\)/s);
});

