import assert from 'node:assert/strict';
import test from 'node:test';

import { MemoryStorage, MockElement, importFresh, importShared, installGlobals, makeBaseDom, makeClipboard } from '../helpers/mock-dom.mjs';

function resetState(S) {
  S.apiKey = null;
  S.models = [];
  S.selectedModel = null;
  S.agents = [];
  S.activeAgentId = null;
  S.activeAgent = null;
  S.conversationAgentId = null;
  S.conversationAgent = null;
  S.messages = [];
  S.streaming = false;
  S.abort = null;
  S.streamTarget = null;
  S.inlineEditId = null;
  S.inlineEditUndo = null;
  S.contextTokens = 0;
  S.usageIsExact = false;
  S.ctxToastFired = false;
  S.lastAssistantResponse = '';
}

function addAgentDom(doc) {
  const ids = [
    ['agent-select', 'select'],
    ['agent-library-modal', 'div'],
    ['agent-library-backdrop', 'div'],
    ['agent-library-close-btn', 'button'],
    ['agent-library-list', 'div'],
    ['agent-library-new-btn', 'button'],
    ['agent-library-import-btn', 'button'],
    ['agent-library-export-btn', 'button'],
    ['agent-library-import-input', 'input'],
    ['agent-builder-title', 'h2'],
    ['agent-builder-mode', 'p'],
    ['agent-builder-form', 'form'],
    ['agent-builder-cancel-btn', 'button'],
    ['agent-builder-save-btn', 'button'],
    ['agent-name', 'input'],
    ['agent-description', 'textarea'],
    ['agent-icon', 'input'],
    ['agent-system-prompt', 'textarea'],
    ['agent-opening-message', 'textarea'],
    ['agent-starter-prompts', 'textarea'],
    ['agent-preferred-model-id', 'input'],
    ['agent-temperature', 'input'],
    ['agent-max-tokens', 'input'],
    ['agent-library-focus-first', 'button'],
    ['agent-library-focus-last', 'button'],
  ];

  for (const [id, tag] of ids) {
    const el = tag === 'input'
      ? new MockElement('input', { id })
      : tag === 'textarea'
        ? new MockElement('textarea', { id })
        : new MockElement(tag, { id });
    doc.register(el);
  }

  const modal = doc.getElementById('agent-library-modal');
  modal.appendChild(doc.getElementById('agent-library-close-btn'));
  modal.appendChild(doc.getElementById('agent-library-focus-first'));
  modal.appendChild(doc.getElementById('agent-library-list'));
  modal.appendChild(doc.getElementById('agent-library-focus-last'));
  modal.appendChild(doc.getElementById('agent-library-backdrop'));

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

test('features/agents.js refreshes the library and builder from stored agents', async () => {
  const doc = makeBaseDom();
  addAgentDom(doc);
  const restore = installGlobals({
    document: doc,
    localStorage: new MemoryStorage(),
    sessionStorage: new MemoryStorage(),
    navigator: { clipboard: makeClipboard() },
    marked: { use() {}, parse: text => text },
    DOMPurify: { addHook() {}, sanitize: raw => raw },
  });
  try {
    const { S } = await importShared('freeforge/src/state.js');
    resetState(S);
    const { saveAgent } = await importFresh('freeforge/src/agent-storage.js');

    const first = saveAgent({
      name: 'Alpha',
      systemPrompt: 'You are Alpha.',
    });
    saveAgent({
      name: 'Beta',
      systemPrompt: 'You are Beta.',
    });

    const { refreshAgentUi } = await importFresh('freeforge/src/features/agents.js');
    assert.equal(typeof refreshAgentUi, 'function');
    refreshAgentUi();

    assert.equal(S.activeAgentId, first.id);
    assert.equal(doc.getElementById('agent-select').children.length, 2);
    assert.equal(doc.getElementById('agent-select').children[0].selected, true);
    assert.equal(doc.getElementById('agent-builder-title').textContent, 'Edit Agent');
    assert.equal(doc.getElementById('agent-name').value, 'Alpha');
    assert.equal(doc.getElementById('agent-library-list').children.length, 2);
    assert.equal(doc.getElementById('agent-library-list').children[0].dataset.agentId, first.id);
  } finally {
    restore();
  }
});

test('agent builder and library modules render data and trap focus', async () => {
  const doc = makeBaseDom();
  addAgentDom(doc);
  const restore = installGlobals({
    document: doc,
    localStorage: new MemoryStorage(),
    sessionStorage: new MemoryStorage(),
    navigator: { clipboard: makeClipboard() },
    marked: { use() {}, parse: text => text },
    DOMPurify: { addHook() {}, sanitize: raw => raw },
  });
  try {
    const { renderAgentBuilder, readAgentBuilderDraft } = await importFresh('freeforge/src/ui/agent-builder.js');
    const { openAgentLibrary, closeAgentLibrary, renderAgentLibrary } = await importFresh('freeforge/src/ui/agent-library.js');

    renderAgentBuilder({
      id: 'agent-1',
      name: 'Researcher',
      description: 'Finds the relevant facts',
      icon: { type: 'emoji', value: '🔎' },
      instructions: {
        systemPrompt: 'Stay focused.',
        openingMessage: 'What are we investigating?',
        starterPrompts: ['  Check the source  ', 'Summarize the claim'],
      },
      model: {
        preferredModelId: 'model-x',
        temperature: 0.5,
        maxTokens: 1024,
      },
    });

    assert.equal(doc.getElementById('agent-builder-title').textContent, 'Edit Agent');
    assert.equal(doc.getElementById('agent-builder-mode').textContent, 'Edit existing agent details.');
    assert.equal(doc.getElementById('agent-name').value, 'Researcher');
    assert.equal(doc.getElementById('agent-starter-prompts').value, '  Check the source  \nSummarize the claim');
    assert.equal(doc.getElementById('agent-preferred-model-id').placeholder, 'Optional');
    assert.equal(doc.getElementById('agent-temperature').placeholder, 'Optional');
    assert.equal(doc.getElementById('agent-max-tokens').placeholder, 'Optional');

    doc.getElementById('agent-name').value = '  Builder  ';
    doc.getElementById('agent-description').value = '  Drafts  ';
    doc.getElementById('agent-icon').value = ' 🧭 ';
    doc.getElementById('agent-system-prompt').value = '  System prompt  ';
    doc.getElementById('agent-opening-message').value = '  Hello  ';
    doc.getElementById('agent-starter-prompts').value = ' first \n\n second \n';
    doc.getElementById('agent-preferred-model-id').value = ' model-y ';
    doc.getElementById('agent-temperature').value = ' 0.2 ';
    doc.getElementById('agent-max-tokens').value = ' 2048 ';

    assert.deepEqual(readAgentBuilderDraft(), {
      name: 'Builder',
      description: 'Drafts',
      icon: '🧭',
      instructions: {
        systemPrompt: 'System prompt',
        openingMessage: 'Hello',
        starterPrompts: ['first', 'second'],
      },
      model: {
        preferredModelId: 'model-y',
        temperature: '0.2',
        maxTokens: '2048',
      },
    });

    const agents = [
      { id: 'agent-1', name: 'Researcher', description: 'Finds facts' },
      { id: 'agent-2', name: 'Writer', description: 'Shapes drafts' },
    ];
    renderAgentLibrary(agents, 'agent-1');

    assert.equal(doc.getElementById('agent-library-list').children.length, 2);
    assert.equal(doc.getElementById('agent-library-list').children[0].dataset.agentId, 'agent-1');
    assert.equal(doc.getElementById('agent-library-list').children[0].querySelector('span').textContent, 'Active');
    assert.equal(doc.getElementById('agent-library-list').children[1].querySelectorAll('button')[0].textContent, 'Use');

    doc.activeElement = doc.getElementById('agent-builder-form');
    openAgentLibrary();
    assert.equal(doc.getElementById('agent-library-modal').classList.contains('hidden'), false);
    assert.equal(doc.activeElement.id, 'agent-library-close-btn');

    const modal = doc.getElementById('agent-library-modal');
    doc.activeElement = doc.getElementById('agent-library-focus-last');
    const forward = { type: 'keydown', key: 'Tab', shiftKey: false, preventDefault() { this.prevented = true; } };
    modal.dispatchEvent(forward);
    assert.equal(forward.prevented, true);
    assert.equal(doc.activeElement.id, 'agent-library-close-btn');

    doc.activeElement = doc.getElementById('agent-library-close-btn');
    const backward = { type: 'keydown', key: 'Tab', shiftKey: true, preventDefault() { this.prevented = true; } };
    modal.dispatchEvent(backward);
    assert.equal(backward.prevented, true);
    assert.equal(doc.activeElement.id, 'agent-library-focus-last');

    closeAgentLibrary();
    assert.equal(doc.getElementById('agent-library-modal').classList.contains('hidden'), true);
  } finally {
    restore();
  }
});
