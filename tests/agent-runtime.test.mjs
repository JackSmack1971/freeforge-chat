import assert from 'node:assert/strict';
import test from 'node:test';

import { buildRequestContext } from '../freeforge/src/agent-runtime.js';
import { S } from '../freeforge/src/state.js';
import { importFresh, installGlobals, makeBaseDom, makeFetchResponse, makeWindow, MemoryStorage } from './helpers/mock-dom.mjs';

test('buildRequestContext prepends the system prompt and includes agent model defaults', () => {
  const request = buildRequestContext([
    { role: 'user', content: 'Hello' },
    { role: 'assistant', content: 'Hi there' },
  ], {
    instructions: { systemPrompt: ' Be concise. ' },
    model: { temperature: 0.25, maxTokens: 256 },
  });

  assert.deepEqual(request.messages, [
    { role: 'system', content: 'Be concise.' },
    { role: 'user', content: 'Hello' },
    { role: 'assistant', content: 'Hi there' },
  ]);
  assert.deepEqual(request.parameters, {
    temperature: 0.25,
    max_tokens: 256,
  });
});

async function loadModelsWithAgentPreference(preferredModelId) {
  const document = makeBaseDom();
  document.getElementById('model-select').appendChild(document.createElement('option'));
  const cleanup = installGlobals({
    document,
    window: makeWindow(),
    localStorage: new MemoryStorage(),
    fetch: async () => makeFetchResponse({
      json: {
        data: [
          {
            id: 'openrouter/alpha',
            name: 'Alpha',
            context_length: 4096,
            pricing: { prompt: '0', completion: '0' },
          },
          {
            id: 'openrouter/beta',
            name: 'Beta',
            context_length: 2048,
            pricing: { prompt: '0', completion: '0' },
          },
        ],
      },
    }),
  });

  S.apiKey = 'key';
  S.models = [];
  S.selectedModel = null;
  S.activeAgent = { model: { preferredModelId } };
  S.conversationAgent = null;
  S.activeAgentId = 'agent-1';

  const { loadModels } = await importFresh('freeforge/src/features/models.js');
  await loadModels('key');
  const value = document.getElementById('model-select').value;
  cleanup();
  return value;
}

test('loadModels prefers an available agent model when no saved model exists', async () => {
  const selected = await loadModelsWithAgentPreference('openrouter/beta');
  assert.equal(selected, 'openrouter/beta');
});

test('loadModels falls back when the preferred agent model is missing', async () => {
  const selected = await loadModelsWithAgentPreference('openrouter/missing');
  assert.equal(selected, 'openrouter/alpha');
});
