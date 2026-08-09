import { $, S } from '../state.js';
import { renderAgentBuilder } from '../ui/agent-builder.js';
import { openAgentLibrary } from '../ui/agent-library.js';
import { createFocusTrap } from '../ui/focus-trap.js';
import { refreshAgentUi } from './agents.js';
import { copyLastResponse, newChat, setActiveAgent } from './chat.js';
import { exportConversation } from './export.js';
import { openImportPicker } from './history.js';
import { changeModel } from './models.js';
import { openSettings } from './settings.js';

const BASE_ACTIONS = [
  { label: 'New Chat', shortcut: 'N', action: () => { newChat(); closePalette(); } },
  { label: 'Copy Last Response', shortcut: 'C', action: () => { copyLastResponse(); closePalette(); } },
  { label: 'Export Conversation', shortcut: 'E', action: () => { exportConversation(); closePalette(); } },
  { label: 'Import Conversation', shortcut: 'I', action: () => { openImportPicker(); closePalette(); } },
  { label: 'Settings', shortcut: ',', action: () => { openSettings(); closePalette(); } },
];

let activeIndex = 0;
let filteredActions = [];
let focusTrap = null;

function getFocusTrap() {
  const palette = $('cmd-palette');
  if (!focusTrap) focusTrap = createFocusTrap(palette);
  return focusTrap;
}

function buildActions() {
  const agentActions = [
    { label: 'Manage Agents', shortcut: 'A', action: () => { closePalette(); openAgentLibrary(); refreshAgentUi(); } },
    { label: 'New Agent', shortcut: 'Shift+A', action: () => { closePalette(); openAgentLibrary(); renderAgentBuilder(null); } },
  ];

  const switchActions = (S.agents ?? []).map(agent => ({
    label: `Switch Agent → ${agent.name || agent.id}`,
    shortcut: '',
    action: () => {
      if (agent.id === S.activeAgentId) {
        closePalette();
        return;
      }
      const selected = S.agents.find(x => x.id === agent.id);
      if (!selected) return;
      setActiveAgent(selected);
      refreshAgentUi();
      closePalette();
    },
  }));

  const modelActions = (S.models ?? []).map(m => ({
    label: `Switch Model → ${m.name ?? m.id}`,
    shortcut: '',
    action: () => { changeModel(m.id); closePalette(); },
  }));
  return [...BASE_ACTIONS, ...agentActions, ...switchActions, ...modelActions];
}

function render(query = '') {
  filteredActions = buildActions().filter(a =>
    a.label.toLowerCase().includes(query.toLowerCase())
  );
  activeIndex = Math.min(activeIndex, Math.max(filteredActions.length - 1, 0));
  const list = $('cmd-list');
  if (!list) return;
  list.innerHTML = '';
  filteredActions.forEach((a, i) => {
    const li = document.createElement('li');
    li.id = `cmd-item-${i}`;
    li.role = 'option';
    li.setAttribute('aria-selected', String(i === activeIndex));
    li.className = i === activeIndex ? 'cmd-item cmd-active' : 'cmd-item';
    li.textContent = a.label;
    if (a.shortcut) {
      const kb = document.createElement('kbd');
      kb.textContent = a.shortcut;
      li.appendChild(kb);
    }
    li.addEventListener('click', () => a.action());
    list.appendChild(li);
  });
  const srch = $('cmd-search');
  if (srch) srch.setAttribute('aria-activedescendant', filteredActions.length ? `cmd-item-${activeIndex}` : '');
}

export function openPalette() {
  activeIndex = 0;
  const palette = $('cmd-palette');
  const input = $('cmd-search');
  if (!palette || !input) return;
  palette.classList.remove('hidden');
  $('palette-trigger-btn')?.setAttribute('aria-expanded', 'true');
  input.value = '';
  render('');
  getFocusTrap().open();
  input.focus();
}

export function closePalette() {
  const palette = $('cmd-palette');
  palette?.classList.add('hidden');
  $('palette-trigger-btn')?.setAttribute('aria-expanded', 'false');
  getFocusTrap().close();
}

export function initPalette() {
  $('cmd-search')?.addEventListener('input', e => {
    activeIndex = 0;
    render(e.target.value);
  });

  $('cmd-palette')?.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closePalette(); return; }
    if (e.key === 'ArrowDown') {
      activeIndex = Math.min(activeIndex + 1, Math.max(filteredActions.length - 1, 0));
      render($('cmd-search')?.value ?? '');
      e.preventDefault();
    }
    if (e.key === 'ArrowUp') {
      activeIndex = Math.max(activeIndex - 1, 0);
      render($('cmd-search')?.value ?? '');
      e.preventDefault();
    }
    if (e.key === 'Enter' && filteredActions[activeIndex]) {
      filteredActions[activeIndex].action();
    }
  });

  $('cmd-backdrop')?.addEventListener('click', closePalette);
  $('palette-trigger-btn')?.addEventListener('click', openPalette);
}
