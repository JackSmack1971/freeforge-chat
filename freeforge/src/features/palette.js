import { S } from '../state.js';
import { newChat, copyLastResponse } from './chat.js';
import { changeModel } from './models.js';
import { openSettings } from './settings.js';
import { exportConversation } from './export.js';

const BASE_ACTIONS = [
  { label: 'New Chat', shortcut: 'N', action: () => { newChat(); closePalette(); } },
  { label: 'Copy Last Response', shortcut: 'C', action: () => { copyLastResponse(); closePalette(); } },
  { label: 'Export Conversation', shortcut: 'E', action: () => { exportConversation(); closePalette(); } },
  { label: 'Settings', shortcut: ',', action: () => { openSettings(); closePalette(); } },
];

let activeIndex = 0;
let filteredActions = [];

function buildActions() {
  const modelActions = (S.models ?? []).map(m => ({
    label: `Switch Model → ${m.name ?? m.id}`,
    shortcut: '',
    action: () => { changeModel(m.id); closePalette(); },
  }));
  return [...BASE_ACTIONS, ...modelActions];
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
    li.role = 'option';
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
}

export function openPalette() {
  activeIndex = 0;
  const palette = document.getElementById('cmd-palette');
  const input = document.getElementById('cmd-search');
  if (!palette || !input) return;
  palette.classList.remove('hidden');
  input.value = '';
  render('');
  input.focus();
}

export function closePalette() {
  document.getElementById('cmd-palette')?.classList.add('hidden');
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
