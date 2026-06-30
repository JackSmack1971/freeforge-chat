import assert from 'node:assert/strict';
import test from 'node:test';

import {
  deleteAgent,
  exportAgent,
  getAgent,
  importAgent,
  loadAgents,
  saveAgent,
  setActiveAgent,
} from '../../freeforge/src/agent-storage.js';

class MemoryStorage {
  constructor(seed = {}, { throwOnSet = false } = {}) {
    this.map = new Map(Object.entries(seed));
    this.throwOnSet = throwOnSet;
  }

  getItem(key) {
    return this.map.has(key) ? this.map.get(key) : null;
  }

  setItem(key, value) {
    if (this.throwOnSet) throw new Error('quota exceeded');
    this.map.set(key, String(value));
  }

  removeItem(key) {
    this.map.delete(key);
  }
}

function installStorage({ local = {}, throwOnSet = false } = {}) {
  globalThis.localStorage = new MemoryStorage(local, { throwOnSet });
}

test('saveAgent persists normalized agents and loadAgents returns them', () => {
  installStorage();

  const saved = saveAgent({
    name: 'Research Analyst',
    systemPrompt: 'You are a careful researcher.',
  });

  assert.equal(saved.name, 'Research Analyst');
  assert.equal(loadAgents().length, 1);
  assert.equal(getAgent(saved.id)?.name, 'Research Analyst');
  assert.equal(exportAgent(saved.id)?.includes('"schemaVersion": 1'), true);
});

test('deleteAgent falls back to the first remaining agent when the active one is removed', () => {
  installStorage();

  const first = saveAgent({
    name: 'First Agent',
    systemPrompt: 'First prompt.',
  });
  const second = saveAgent({
    name: 'Second Agent',
    systemPrompt: 'Second prompt.',
  });

  assert.equal(setActiveAgent(second.id), second.id);
  assert.equal(deleteAgent(second.id), true);
  assert.equal(JSON.parse(globalThis.localStorage.getItem('ff_active_agent_id')), first.id);
});

test('importAgent normalizes untrusted JSON through the same schema path', () => {
  installStorage();

  const imported = importAgent(JSON.stringify({
    name: 'Imported Agent',
    systemPrompt: 'Use this prompt.',
    starterPrompts: ['Ask a follow-up'],
  }));

  assert.equal(imported.name, 'Imported Agent');
  assert.deepEqual(imported.instructions.starterPrompts, ['Ask a follow-up']);
  assert.equal(loadAgents()[0].id, imported.id);
});

test('saveAgent returns null when storage quota prevents persistence', () => {
  installStorage({ throwOnSet: true });

  const saved = saveAgent({
    name: 'Quota Agent',
    systemPrompt: 'Use this prompt.',
  });

  assert.equal(saved, null);
  assert.equal(loadAgents().length, 0);
});
