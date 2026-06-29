import { S } from '../state.js';

const MODAL_ID = 'agent-library-modal';
const BACKDROP_ID = 'agent-library-backdrop';
const CLOSE_ID = 'agent-library-close-btn';
const LIST_ID = 'agent-library-list';

let previousFocus = null;

function getModal() {
  return document.getElementById(MODAL_ID);
}

function getList() {
  return document.getElementById(LIST_ID);
}

function getFocusable() {
  const modal = getModal();
  if (!modal) return [];
  return [...modal.querySelectorAll(
    'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
  )];
}

function trapFocus(e) {
  if (e.key !== 'Tab') return;
  const focusable = getFocusable();
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

export function openAgentLibrary() {
  const modal = getModal();
  if (!modal) return;
  previousFocus = document.activeElement;
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
  modal.addEventListener('keydown', trapFocus);
  document.getElementById(CLOSE_ID)?.focus();
}

export function closeAgentLibrary() {
  const modal = getModal();
  if (!modal) return;
  modal.classList.add('hidden');
  modal.setAttribute('aria-hidden', 'true');
  modal.removeEventListener('keydown', trapFocus);
  if (previousFocus && document.contains(previousFocus)) previousFocus.focus();
  previousFocus = null;
}

export function renderAgentLibrary(agents = S.agents, activeAgentId = S.activeAgentId) {
  const list = getList();
  if (!list) return;
  list.textContent = '';

  if (!agents.length) {
    const empty = document.createElement('p');
    empty.className = 'text-sm text-zinc-500';
    empty.textContent = 'No agents yet.';
    list.appendChild(empty);
    return;
  }

  for (const agent of agents) {
    const item = document.createElement('div');
    item.className = 'rounded-xl border border-zinc-800 bg-zinc-950/60 px-3 py-3';
    item.dataset.agentId = agent.id;

    const top = document.createElement('div');
    top.className = 'flex items-start justify-between gap-3';

    const nameWrap = document.createElement('div');

    const name = document.createElement('div');
    name.className = 'text-sm font-medium text-zinc-100';
    name.textContent = agent.name || 'Untitled agent';

    const desc = document.createElement('div');
    desc.className = 'mt-1 text-xs text-zinc-500 line-clamp-2';
    desc.textContent = agent.description || 'No description.';

    nameWrap.append(name, desc);

    const badge = document.createElement('span');
    badge.className = activeAgentId === agent.id ? 'shrink-0 rounded-full border border-emerald-700/70 bg-emerald-950/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300' : 'shrink-0 rounded-full border border-zinc-800 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-500';
    badge.textContent = activeAgentId === agent.id ? 'Active' : 'Saved';

    top.append(nameWrap, badge);
    const actions = document.createElement('div');
    actions.className = 'mt-3 flex flex-wrap gap-2';

    const makeAction = (label, action) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'rounded-lg border border-zinc-700 px-2.5 py-1 text-xs font-medium text-zinc-300 hover:border-zinc-600 hover:text-white transition-colors';
      btn.dataset.agentAction = action;
      btn.dataset.agentId = agent.id;
      btn.textContent = label;
      return btn;
    };

    actions.append(
      makeAction(activeAgentId === agent.id ? 'Active' : 'Use', 'set-active'),
      makeAction('Edit', 'edit'),
      makeAction('Duplicate', 'duplicate'),
      makeAction('Export', 'export'),
      makeAction('Delete', 'delete')
    );

    item.append(top, actions);
    list.appendChild(item);
  }
}

document.getElementById(BACKDROP_ID)?.addEventListener('click', closeAgentLibrary);
document.getElementById(CLOSE_ID)?.addEventListener('click', closeAgentLibrary);
