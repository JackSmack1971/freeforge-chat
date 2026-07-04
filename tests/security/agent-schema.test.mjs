import assert from 'node:assert/strict';
import test from 'node:test';

import { generateAgentId, normalizeAgent } from '../../freeforge/src/agent-schema.js';

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

test('normalizeAgent rejects invalid fields with useful errors', () => {
  assert.throws(() => normalizeAgent({
    schemaVersion: 1,
    id: 'agent-1',
    revision: 0,
    name: '',
    description: 'x'.repeat(241),
    icon: { type: 'widget', value: '' },
    instructions: {
      systemPrompt: '',
      openingMessage: 'x'.repeat(2001),
      starterPrompts: ['x'.repeat(501), 'ok', 'ok', 'ok', 'ok', 'ok', 'ok'],
    },
    model: {
      preferredModelId: 'x'.repeat(161),
      temperature: 3,
      maxTokens: 0,
    },
    extraField: true,
  }), /Invalid agent:/);
  assert.throws(() => normalizeAgent({
    schemaVersion: 1,
    id: 'agent-1',
    revision: 0,
    name: '',
    description: 'x'.repeat(241),
    icon: { type: 'widget', value: '' },
    instructions: {
      systemPrompt: '',
      openingMessage: 'x'.repeat(2001),
      starterPrompts: ['x'.repeat(501), 'ok', 'ok', 'ok', 'ok', 'ok', 'ok'],
    },
    model: {
      preferredModelId: 'x'.repeat(161),
      temperature: 3,
      maxTokens: 0,
    },
    extraField: true,
  }), /name: must be between 1 and 60 characters/);
});

test('normalizeAgent rejects unsupported schema versions', () => {
  assert.throws(() => normalizeAgent({
    schemaVersion: 2,
    name: 'Research Analyst',
  }), /Unsupported agent schema version: 2/);
});

test('generateAgentId uses crypto.randomUUID when available and falls back otherwise', () => {
  const cryptoDesc = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  try {
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      writable: true,
      value: { randomUUID: () => 'uuid-from-crypto' },
    });
    assert.equal(generateAgentId(), 'uuid-from-crypto');

    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      writable: true,
      value: {},
    });
    const fallback = generateAgentId();
    assert.match(fallback, /^agent-[a-z0-9]+-[a-z0-9]{8}$/);
  } finally {
    if (cryptoDesc) Object.defineProperty(globalThis, 'crypto', cryptoDesc);
    else Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      writable: true,
      value: undefined,
    });
  }
});
