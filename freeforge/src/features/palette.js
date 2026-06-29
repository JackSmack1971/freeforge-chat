import { S } from '../state.js';
import { renderAgentBuilder } from '../ui/agent-builder.js';
import { openAgentLibrary } from '../ui/agent-library.js';
import { refreshAgentUi } from './agents.js';
import { copyLastResponse, newChat, setActiveAgent } from './chat.js';
import { exportConversation } from './export.js';
import { changeModel } from './models.js';
import { openSettings } from './settings.js';

const BASE_ACTIONS = [
  { label: 'New Chat', shortcut: 'N', action: () => { newChat(); closePalette(); } },
  { label: 'Copy Last Response', shortcut: 'C', action: () => { copyLastResponse(); closePalette(); } },
  { label: 'Export Conversation', shortcut: 'E', action: () => { exportConversation(); closePalette(); } },
  { label: 'Settings', shortcut: ',', action: () => { openSettings(); closePalette(); } },
];

let activeIndex = 0;
let filteredActions = [];
let previousFocus = null;

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

function getFocusableInPalette() {
  return [...document.getElementById('cmd-palette-inner')?.querySelectorAll(
    'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
  ) ?? []];
}

function trapFocus(e) {
  if (e.key !== 'Tab') return;
  const focusable = getFocusableInPalette();
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}

function render(query = '') {
  filteredActions = buildActions().filter(a =>
    a.label.toLowerCase().includes(query.toLowerCase())
  );
  activeIndex = Math.min(activeIndex, Math.max(filteredActions.length - 1, 0));
  const list = document.getElementById('cmd-list');
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
  const srch = document.getElementById('cmd-search');
  if (srch) srch.setAttribute('aria-activedescendant', filteredActions.length ? `cmd-item-${activeIndex}` : '');
}

export function openPalette() {
  activeIndex = 0;
  previousFocus = document.activeElement;
  const palette = document.getElementById('cmd-palette');
  const input = document.getElementById('cmd-search');
  if (!palette || !input) return;
  palette.classList.remove('hidden');
  document.getElementById('palette-trigger-btn')?.setAttribute('aria-expanded', 'true');
  input.value = '';
  render('');
  input.focus();
  palette.addEventListener('keydown', trapFocus);
}

export function closePalette() {
  const palette = document.getElementById('cmd-palette');
  palette?.classList.add('hidden');
  document.getElementById('palette-trigger-btn')?.setAttribute('aria-expanded', 'false');
  palette?.removeEventListener('keydown', trapFocus);
  if (previousFocus && document.contains(previousFocus)) previousFocus.focus();
  previousFocus = null;
}

document.getElementById('cmd-search')?.addEventListener('input', e => {
  activeIndex = 0;
  render(e.target.value);
});

document.getElementById('cmd-palette')?.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closePalette(); return; }
  if (e.key === 'ArrowDown') {
    activeIndex = Math.min(activeIndex + 1, Math.max(filteredActions.length - 1, 0));
    render(document.getElementById('cmd-search')?.value ?? '');
    e.preventDefault();
  }
  if (e.key === 'ArrowUp') {
    activeIndex = Math.max(activeIndex - 1, 0);
    render(document.getElementById('cmd-search')?.value ?? '');
    e.preventDefault();
  }
  if (e.key === 'Enter' && filteredActions[activeIndex]) {
    filteredActions[activeIndex].action();
  }
});

document.getElementById('cmd-backdrop')?.addEventListener('click', closePalette);
document.getElementById('palette-trigger-btn')?.addEventListener('click', openPalette);
