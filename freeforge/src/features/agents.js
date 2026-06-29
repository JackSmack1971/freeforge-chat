import { deleteAgent, exportAgent, getAgent, importAgent, loadAgents, saveAgent } from '../agent-storage.js';
import { $, LS, S } from '../state.js';
import { readAgentBuilderDraft, renderAgentBuilder } from '../ui/agent-builder.js';
import { closeAgentLibrary, openAgentLibrary, renderAgentLibrary } from '../ui/agent-library.js';
import { toast } from '../ui/toast.js';
import { setActiveAgent } from './chat.js';

const IMPORT_INPUT_ID = 'agent-library-import-input';
const FORM_ID = 'agent-builder-form';
const NEW_BTN_ID = 'agent-library-new-btn';
const IMPORT_BTN_ID = 'agent-library-import-btn';
const EXPORT_BTN_ID = 'agent-library-export-btn';
const CANCEL_BTN_ID = 'agent-builder-cancel-btn';

function getFormAgentId() {
  return $(FORM_ID)?.dataset.agentId || '';
}

function refreshAgentState() {
  S.agents = loadAgents();
  const activeId = LS.get('ff_active_agent_id');
  S.activeAgent = S.agents.find(agent => agent.id === activeId) || S.agents[0] || null;
  S.activeAgentId = S.activeAgent?.id ?? null;
  if (!S.messages.length) {
    S.conversationAgent = S.activeAgent ? { ...S.activeAgent, icon: S.activeAgent.icon ? { ...S.activeAgent.icon } : null, instructions: { ...S.activeAgent.instructions, starterPrompts: [...(S.activeAgent.instructions?.starterPrompts || [])] }, model: { ...S.activeAgent.model } } : null;
    S.conversationAgentId = S.conversationAgent?.id ?? null;
  }
}

function refreshAgentUi() {
  refreshAgentState();
  renderAgentLibrary(S.agents, S.activeAgentId);
  const formAgent = getFormAgentId() ? getAgent(getFormAgentId()) : S.activeAgent;
  renderAgentBuilder(formAgent || null);
}

export { refreshAgentUi };

function openBuilder(agent = null) {
  openAgentLibrary();
  renderAgentBuilder(agent);
  document.getElementById(FORM_ID)?.querySelector('input, textarea')?.focus();
}

function downloadJson(name, json) {
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function exportActiveAgent() {
  if (!S.activeAgentId) { toast('No active agent to export', 'warning'); return; }
  const blob = exportAgent(S.activeAgentId);
  if (!blob) { toast('Agent not found', 'error'); return; }
  downloadJson(`${S.activeAgent?.name || S.activeAgentId}.json`, blob);
  toast('Agent exported', 'success');
}

function importFromText(text) {
  let saved;
  try {
    saved = importAgent(text);
  } catch (err) {
    toast(err?.message || 'Import failed', 'error');
    return;
  }
  if (!saved) {
    toast('Import failed', 'error');
    return;
  }
  refreshAgentState();
  setActiveAgent(saved);
  renderAgentLibrary(S.agents, S.activeAgentId);
  renderAgentBuilder(saved);
  toast('Agent imported', 'success');
}

function saveFromBuilder() {
  const draft = readAgentBuilderDraft();
  const agentId = getFormAgentId();
  let saved;
  try {
    saved = saveAgent(agentId ? { ...draft, id: agentId } : draft);
  } catch (err) {
    toast(err?.message || 'Agent save failed', 'error');
    return;
  }
  if (!saved) {
    toast('Agent save failed', 'error');
    return;
  }

  const wasNew = !agentId;
  refreshAgentState();
  if (wasNew) {
    setActiveAgent(saved);
  }
  renderAgentLibrary(S.agents, S.activeAgentId);
  renderAgentBuilder(saved);
  toast(wasNew ? 'Agent created' : 'Agent updated', 'success');
}

function deleteById(id) {
  if (!id) return;
  const wasActive = S.activeAgentId === id;
  const removed = deleteAgent(id);
  if (!removed) {
    toast('Agent not found', 'error');
    return;
  }
  refreshAgentState();
  if (wasActive) {
    const active = getAgent(S.activeAgentId) || S.agents[0] || null;
    if (active) setActiveAgent(active);
  }
  renderAgentLibrary(S.agents, S.activeAgentId);
  renderAgentBuilder(S.activeAgent);
  toast('Agent deleted', 'success');
}

function duplicateById(id) {
  const agent = getAgent(id);
  if (!agent) {
    toast('Agent not found', 'error');
    return;
  }
  let saved;
  try {
    saved = saveAgent({
      ...agent,
      id: undefined,
    });
  } catch (err) {
    toast(err?.message || 'Duplicate failed', 'error');
    return;
  }
  if (!saved) {
    toast('Duplicate failed', 'error');
    return;
  }
  refreshAgentState();
  setActiveAgent(saved);
  renderAgentLibrary(S.agents, S.activeAgentId);
  renderAgentBuilder(saved);
  toast('Agent duplicated', 'success');
}

function setActiveById(id) {
  const agent = getAgent(id);
  if (!agent) {
    toast('Agent not found', 'error');
    return;
  }
  if (agent.id === S.activeAgentId) {
    renderAgentBuilder(agent);
    openAgentLibrary();
    return;
  }
  setActiveAgent(agent);
  refreshAgentState();
  renderAgentLibrary(S.agents, S.activeAgentId);
  renderAgentBuilder(agent);
  openAgentLibrary();
}

function editById(id) {
  const agent = getAgent(id);
  if (!agent) {
    toast('Agent not found', 'error');
    return;
  }
  renderAgentBuilder(agent);
  openAgentLibrary();
}

function exportById(id) {
  const blob = exportAgent(id);
  if (!blob) {
    toast('Agent not found', 'error');
    return;
  }
  const agent = getAgent(id);
  downloadJson(`${agent?.name || id}.json`, blob);
  toast('Agent exported', 'success');
}

document.getElementById(NEW_BTN_ID)?.addEventListener('click', () => openBuilder(null));
document.getElementById(IMPORT_BTN_ID)?.addEventListener('click', () => document.getElementById(IMPORT_INPUT_ID)?.click());
document.getElementById(EXPORT_BTN_ID)?.addEventListener('click', exportActiveAgent);
document.getElementById(CANCEL_BTN_ID)?.addEventListener('click', closeAgentLibrary);

document.getElementById(IMPORT_INPUT_ID)?.addEventListener('change', e => {
  const file = e.target.files?.[0];
  e.target.value = '';
  if (!file) return;
  file.text().then(importFromText).catch(() => toast('Import failed', 'error'));
});

document.addEventListener('click', e => {
  const action = e.target.closest('[data-agent-action]');
  if (!action) return;
  const id = action.dataset.agentId;
  const kind = action.dataset.agentAction;
  if (!id || !kind) return;
  if (kind === 'set-active') setActiveById(id);
  else if (kind === 'edit') editById(id);
  else if (kind === 'duplicate') duplicateById(id);
  else if (kind === 'delete') deleteById(id);
  else if (kind === 'export') exportById(id);
});

document.getElementById(FORM_ID)?.addEventListener('submit', e => {
  e.preventDefault();
  saveFromBuilder();
});

refreshAgentUi();
