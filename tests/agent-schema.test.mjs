import assert from 'node:assert/strict';
import test from 'node:test';

import { generateAgentId, normalizeAgent } from '../freeforge/src/agent-schema.js';

test('normalizeAgent migrates legacy agent data into the v1 shape', () => {
  const agent = normalizeAgent({
    name: ' Research Analyst ',
    description: ' Evidence-focused research assistant ',
    icon: ' 🔎 ',
    systemPrompt: ' You are an evidence-focused analyst. ',
    openingMessage: ' Hello there ',
    starterPrompts: [' Analyze this claim ', '', 'Compare these approaches'],
    preferredModelId: ' model-x ',
    temperature: '0.7',
    maxTokens: '4096',
    createdAt: '2026-06-28T00:00:00.000Z',
    updatedAt: '2026-06-28T01:00:00.000Z',
  });

  assert.equal(agent.schemaVersion, 1);
  assert.equal(agent.name, 'Research Analyst');
  assert.equal(agent.description, 'Evidence-focused research assistant');
  assert.deepEqual(agent.icon, { type: 'emoji', value: '🔎' });
  assert.deepEqual(agent.instructions, {
    systemPrompt: 'You are an evidence-focused analyst.',
    openingMessage: 'Hello there',
    starterPrompts: ['Analyze this claim', 'Compare these approaches'],
  });
  assert.deepEqual(agent.model, {
    preferredModelId: 'model-x',
    temperature: 0.7,
    maxTokens: 4096,
  });
  assert.equal(agent.createdAt, '2026-06-28T00:00:00.000Z');
  assert.equal(agent.updatedAt, '2026-06-28T01:00:00.000Z');
});

test('normalizeAgent rejects empty system prompts', () => {
  assert.throws(() => normalizeAgent({
    name: 'Agent',
    systemPrompt: '   ',
  }), /instructions\.systemPrompt/);
});

test('generateAgentId uses crypto.randomUUID when available and falls back otherwise', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  Object.defineProperty(globalThis, 'crypto', {
    configurable: true,
    value: { randomUUID: () => 'uuid-from-crypto' },
  });
  assert.equal(generateAgentId(), 'uuid-from-crypto');

  Object.defineProperty(globalThis, 'crypto', {
    configurable: true,
    value: {},
  });
  const fallback = generateAgentId();
  assert.match(fallback, /^agent-[a-z0-9]+-[a-z0-9]{8}$/);

  if (original) Object.defineProperty(globalThis, 'crypto', original);
  else delete globalThis.crypto;
});
