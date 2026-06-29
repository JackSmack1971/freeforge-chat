const MODAL_ID = 'agent-library-modal';
const TITLE_ID = 'agent-builder-title';
const MODE_ID = 'agent-builder-mode';
const FORM_ID = 'agent-builder-form';

function getField(id) {
  return document.getElementById(id);
}

function getValue(id) {
  return getField(id)?.value.trim() || '';
}

export function renderAgentBuilder(agent = null) {
  const mode = agent ? 'Edit Agent' : 'Create Agent';
  const title = getField(TITLE_ID);
  if (title) title.textContent = mode;
  const modeNode = getField(MODE_ID);
  if (modeNode) modeNode.textContent = agent ? 'Edit existing agent details.' : 'Create a fresh agent profile.';

  const name = getField('agent-name');
  const description = getField('agent-description');
  const icon = getField('agent-icon');
  const systemPrompt = getField('agent-system-prompt');
  const openingMessage = getField('agent-opening-message');
  const starterPrompts = getField('agent-starter-prompts');
  const preferredModelId = getField('agent-preferred-model-id');
  const temperature = getField('agent-temperature');
  const maxTokens = getField('agent-max-tokens');

  if (name) name.value = agent?.name || '';
  if (description) description.value = agent?.description || '';
  if (icon) icon.value = agent?.icon?.value || '';
  if (systemPrompt) systemPrompt.value = agent?.instructions?.systemPrompt || '';
  if (openingMessage) openingMessage.value = agent?.instructions?.openingMessage || '';
  if (starterPrompts) starterPrompts.value = (agent?.instructions?.starterPrompts || []).join('\n');
  if (preferredModelId) preferredModelId.value = agent?.model?.preferredModelId || '';
  if (temperature) temperature.value = agent?.model?.temperature ?? '';
  if (maxTokens) maxTokens.value = agent?.model?.maxTokens ?? '';
}

export function readAgentBuilderDraft() {
  const starterPrompts = getValue('agent-starter-prompts');
  return {
    name: getValue('agent-name'),
    description: getValue('agent-description'),
    icon: getValue('agent-icon'),
    instructions: {
      systemPrompt: getValue('agent-system-prompt'),
      openingMessage: getValue('agent-opening-message'),
      starterPrompts: starterPrompts ? starterPrompts.split(/\r?\n/).map(prompt => prompt.trim()).filter(Boolean) : [],
    },
    model: {
      preferredModelId: getValue('agent-preferred-model-id'),
      temperature: getValue('agent-temperature'),
      maxTokens: getValue('agent-max-tokens'),
    },
  };
}

export function openAgentBuilder(agent = null) {
  const modal = document.getElementById(MODAL_ID);
  if (!modal) return;
  renderAgentBuilder(agent);
  modal.classList.remove('hidden');
}

export function closeAgentBuilder() {
  const modal = document.getElementById(MODAL_ID);
  if (!modal) return;
  modal.classList.add('hidden');
}

document.getElementById(FORM_ID)?.addEventListener('submit', e => e.preventDefault());
