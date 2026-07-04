import assert from 'node:assert/strict';

import { buildRequestMessages } from '../../freeforge/src/agent-runtime.js';
import { normalizeAgent } from '../../freeforge/src/agent-schema.js';

const agent = normalizeAgent({
  schemaVersion: 1,
  name: 'Helpful Agent',
  instructions: {
    systemPrompt: 'You are a helpful assistant.',
  },
});

const payload = buildRequestMessages([
  { role: 'user', content: 'Hello' },
  { role: 'notice', content: 'ignored' },
  { role: 'assistant', content: 'World' },
], agent);

assert.deepEqual(payload[0], { role: 'system', content: 'You are a helpful assistant.' });
assert.deepEqual(payload, [
  { role: 'system', content: 'You are a helpful assistant.' },
  { role: 'user', content: 'Hello' },
  { role: 'assistant', content: 'World' },
]);

console.log('OK');
