import assert from 'node:assert/strict';
import test from 'node:test';

import { MemoryStorage, MockElement, importFresh, importShared, installGlobals, makeBaseDom, makeClipboard } from '../helpers/mock-dom.mjs';

function addAgentUi(doc) {
  const defs = [
    ['agent-library-modal', 'div'],
    ['agent-library-backdrop', 'div'],
    ['agent-library-close-btn', 'button'],
    ['agent-library-extra-btn', 'button'],
    ['agent-library-list', 'div'],
    ['agent-library-import-input', 'input'],
    ['agent-library-new-btn', 'button'],
    ['agent-library-import-btn', 'button'],
    ['agent-library-export-btn', 'button'],
    ['agent-builder-cancel-btn', 'button'],
    ['agent-builder-title', 'h2'],
    ['agent-builder-mode', 'p'],
    ['agent-builder-form', 'form'],
    ['agent-name', 'input'],
    ['agent-description', 'input'],
    ['agent-icon', 'input'],
    ['agent-system-prompt', 'textarea'],
    ['agent-opening-message', 'textarea'],
    ['agent-starter-prompts', 'textarea'],
    ['agent-preferred-model-id', 'input'],
    ['agent-temperature', 'input'],
    ['agent-max-tokens', 'input'],
    ['agent-select', 'select'],
  ];

  for (const [id, tag] of defs) {
    const el = tag === 'input'
      ? new MockElement('input', { id })
      : tag === 'textarea'
        ? new MockElement('textarea', { id })
        : tag === 'form'
          ? new MockElement('form', { id })
          : new MockElement(tag, { id });
    doc.register(el);
  }

  doc.body = new MockElement('body');
  doc.body.ownerDocument = doc;

  const modal = doc.getElementById('agent-library-modal');
  modal.appendChild(doc.getElementById('agent-library-close-btn'));
  modal.appendChild(doc.getElementById('agent-library-extra-btn'));
  modal.appendChild(doc.getElementById('agent-library-backdrop'));
  modal.appendChild(doc.getElementById('agent-library-list'));

  const form = doc.getElementById('agent-builder-form');
  form.appendChild(doc.getElementById('agent-name'));
  form.appendChild(doc.getElementById('agent-description'));
  form.appendChild(doc.getElementById('agent-icon'));
  form.appendChild(doc.getElementById('agent-system-prompt'));
  form.appendChild(doc.getElementById('agent-opening-message'));
  form.appendChild(doc.getElementById('agent-starter-prompts'));
  form.appendChild(doc.getElementById('agent-preferred-model-id'));
  form.appendChild(doc.getElementById('agent-temperature'));
  form.appendChild(doc.getElementById('agent-max-tokens'));
}

function installAgentGlobals() {
  const doc = makeBaseDom();
  addAgentUi(doc);
  const restore = installGlobals({
    document: doc,
    localStorage: new MemoryStorage(),
    sessionStorage: new MemoryStorage(),
    navigator: { clipboard: makeClipboard() },
    marked: { use() {}, parse: text => text },
    DOMPurify: { addHook() {}, sanitize: raw => raw },
    URL: {
      createObjectURL() {
        return 'blob:agent';
      },
      revokeObjectURL() {},
    },
    Blob,
  });
  return { doc, restore };
}

async function seedAgents() {
  const state = await importShared('freeforge/src/state.js');
  const storage = await importFresh('freeforge/src/agent-storage.js');
  state.S.agents = [];
  state.S.activeAgent = null;
  state.S.activeAgentId = null;
  state.S.conversationAgent = null;
  state.S.conversationAgentId = null;
  const alpha = storage.saveAgent({
    name: 'Alpha',
    systemPrompt: 'Alpha prompt.',
  });
  const beta = storage.saveAgent({
    name: 'Beta',
    systemPrompt: 'Beta prompt.',
  });
  storage.setActiveAgent(alpha.id);
  return { state, storage, alpha, beta };
}

test('agent-library.js renders saved agents and traps focus in the modal', async () => {
  const { doc, restore } = installAgentGlobals();
  try {
    const { renderAgentLibrary, openAgentLibrary, closeAgentLibrary } = await importFresh('freeforge/src/ui/agent-library.js');

    renderAgentLibrary([
      { id: 'alpha', name: 'Alpha', description: 'First agent' },
      { id: 'beta', name: 'Beta', description: 'Second agent' },
    ], 'alpha');

    assert.equal(doc.getElementById('agent-library-list').children.length, 2);
    assert.equal(doc.getElementById('agent-library-list').children[0].querySelector('span').textContent, 'Active');
    assert.equal(doc.getElementById('agent-library-list').children[1].querySelector('span').textContent, 'Saved');

    doc.activeElement = doc.getElementById('settings-btn');
    openAgentLibrary();
    assert.equal(doc.getElementById('agent-library-modal').classList.contains('hidden'), false);
    assert.equal(doc.getElementById('agent-library-modal').getAttribute('aria-hidden'), 'false');
    assert.equal(doc.activeElement.id, 'agent-library-close-btn');

    closeAgentLibrary();
    assert.equal(doc.getElementById('agent-library-modal').classList.contains('hidden'), true);
    assert.equal(doc.getElementById('agent-library-modal').getAttribute('aria-hidden'), 'true');
    assert.equal(doc.activeElement.id, 'settings-btn');
  } finally {
    restore();
  }
});

test('agent-builder.js renders an agent and reads back the edited draft', async () => {
  const { doc, restore } = installAgentGlobals();
  try {
    const { renderAgentBuilder, readAgentBuilderDraft, openAgentBuilder, closeAgentBuilder } = await importFresh('freeforge/src/ui/agent-builder.js');

    const agent = {
      id: 'agent-1',
      name: 'Agent One',
      description: 'A helpful assistant.',
      icon: { type: 'emoji', value: '🧪' },
      instructions: {
        systemPrompt: 'Be precise.',
        openingMessage: 'Hello!',
        starterPrompts: ['First prompt', 'Second prompt'],
      },
      model: {
        preferredModelId: 'model-x',
        temperature: 0.5,
        maxTokens: 2048,
      },
    };

    renderAgentBuilder(agent);
    assert.equal(doc.getElementById('agent-builder-form').dataset.agentId, 'agent-1');
    assert.equal(doc.getElementById('agent-builder-title').textContent, 'Edit Agent');
    assert.equal(doc.getElementById('agent-builder-mode').textContent, 'Edit existing agent details.');
    assert.equal(doc.getElementById('agent-name').value, 'Agent One');
    assert.equal(doc.getElementById('agent-starter-prompts').value, 'First prompt\nSecond prompt');

    doc.getElementById('agent-name').value = '  Renamed Agent  ';
    doc.getElementById('agent-description').value = '  Updated description  ';
    doc.getElementById('agent-icon').value = '  ✨  ';
    doc.getElementById('agent-system-prompt').value = '  New prompt  ';
    doc.getElementById('agent-opening-message').value = '  New hello  ';
    doc.getElementById('agent-starter-prompts').value = '  One  \n\n  Two  ';
    doc.getElementById('agent-preferred-model-id').value = '  model-y  ';
    doc.getElementById('agent-temperature').value = '0.9';
    doc.getElementById('agent-max-tokens').value = '4096';

    assert.deepEqual(readAgentBuilderDraft(), {
      name: 'Renamed Agent',
      description: 'Updated description',
      icon: '✨',
      instructions: {
        systemPrompt: 'New prompt',
        openingMessage: 'New hello',
        starterPrompts: ['One', 'Two'],
      },
      model: {
        preferredModelId: 'model-y',
        temperature: '0.9',
        maxTokens: '4096',
      },
    });

    openAgentBuilder();
    assert.equal(doc.getElementById('agent-library-modal').classList.contains('hidden'), false);
    assert.equal(doc.activeElement.id, 'agent-name');
    closeAgentBuilder();
    assert.equal(doc.getElementById('agent-library-modal').classList.contains('hidden'), true);
  } finally {
    restore();
  }
});

test('features/agents.js wires import, save, duplicate, set-active, delete, and export actions', async () => {
  const { doc, restore } = installAgentGlobals();
  try {
    const { state, storage, alpha, beta } = await seedAgents();
    const latestActionButton = (agentId, action) => {
      const items = [...doc.getElementById('agent-library-list').children].reverse();
      for (const item of items) {
        if (item.dataset.agentId !== agentId) continue;
        const actions = item.children[1];
        if (!actions) continue;
        const btn = actions.children.find(child => child.dataset.agentAction === action && child.dataset.agentId === agentId);
        if (btn) return btn;
      }
      return null;
    };
    const armAction = btn => {
      if (!btn) return null;
      const orig = btn.closest.bind(btn);
      btn.closest = selector => (selector === '[data-agent-action]' ? btn : orig(selector));
      return btn;
    };

    const createdAnchors = [];
    const originalCreateElement = doc.createElement.bind(doc);
    doc.createElement = tag => {
      const el = originalCreateElement(tag);
      if (tag === 'a') createdAnchors.push(el);
      return el;
    };
    const objectUrls = [];
    globalThis.URL.createObjectURL = blob => {
      objectUrls.push(blob);
      return `blob:${objectUrls.length}`;
    };

    await importFresh('freeforge/src/features/agents.js');

    assert.equal(doc.getElementById('agent-select').children.length, 2);
    assert.equal(state.S.activeAgentId, alpha.id);

    doc.getElementById('agent-builder-form').dataset.agentId = '';
    doc.getElementById('agent-name').value = 'Gamma';
    doc.getElementById('agent-description').value = 'Created from the builder';
    doc.getElementById('agent-system-prompt').value = 'Build new things.';
    doc.getElementById('agent-starter-prompts').value = 'Start here\nThen here';
    doc.getElementById('agent-builder-form').dispatchEvent({
      type: 'submit',
      preventDefault() {},
    });
    assert.equal(storage.loadAgents().length, 3);
    assert.equal(doc.getElementById('agent-library-list').children.at(-1).dataset.agentId, storage.loadAgents().at(-1).id);

    const exportButton = armAction(latestActionButton(alpha.id, 'export'));
    doc.dispatchEvent({ type: 'click', target: exportButton });
    assert.equal(objectUrls.length, 1);
    assert.equal(createdAnchors[0].download, 'Alpha.json');

    const duplicateButton = armAction(latestActionButton(alpha.id, 'duplicate'));
    doc.dispatchEvent({ type: 'click', target: duplicateButton });
    assert.equal(storage.loadAgents().length, 4);

    const setActiveButton = armAction(latestActionButton(beta.id, 'set-active'));
    doc.dispatchEvent({ type: 'click', target: setActiveButton });
    assert.equal(state.S.activeAgentId, beta.id);

    const deleteButton = armAction(latestActionButton(beta.id, 'delete'));
    doc.dispatchEvent({ type: 'click', target: deleteButton });
    assert.equal(storage.loadAgents().length, 3);

    const importInput = doc.getElementById('agent-library-import-input');
    importInput.files = [{
      async text() {
        return JSON.stringify({
          name: 'Imported Agent',
          systemPrompt: 'Imported prompt.',
        });
      },
    }];
    importInput.dispatchEvent({ type: 'change', target: importInput });
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(storage.loadAgents().length, 4);
    assert.equal(state.S.activeAgent.name, 'Imported Agent');
    assert.equal(doc.getElementById('agent-builder-title').textContent, 'Edit Agent');

    assert.equal(beta.name, 'Beta');
  } finally {
    restore();
  }
});
