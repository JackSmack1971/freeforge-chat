import { $, esc } from '../state.js';

const PALETTE = {
  success: 'border-emerald-700 text-emerald-300',
  error:   'border-red-700 text-red-300',
  warning: 'border-amber-700 text-amber-300',
  info:    'border-zinc-700 text-zinc-300',
};
const SURFACE = {
  success: 'toast-surface-success',
  error:   'toast-surface-error',
  warning: 'toast-surface-warning',
  info:    'toast-surface-info',
};
const ICONS = {
  success: 'M5 13l4 4L19 7',
  error:   'M6 18L18 6M6 6l12 12',
  warning: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
  info:    'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
};

export function toast(msg, type = 'info', ms = 3000, action = null) {
  const el = document.createElement('div');
  el.className = `toast toast-card pointer-events-auto flex items-start gap-2.5 px-3.5 py-3 rounded-xl border text-sm shadow-xl ${PALETTE[type]} ${SURFACE[type]}`;
  if (ms === 0) el.classList.add('toast-persistent');
  el.innerHTML = `<svg class="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${ICONS[type]}"/></svg><span>${esc(msg)}</span>`;
  if (action) {
    const btn = document.createElement('button');
    btn.className = 'toast-action-btn';
    btn.dataset.action = action.id;
    btn.textContent = action.label;
    el.querySelector('span').appendChild(btn);
  }
  $('toasts').appendChild(el);
  if (ms > 0) setTimeout(() => el.remove(), ms + 300);
}

export function clearPersistent() {
  $('toasts')?.querySelectorAll('.toast-persistent').forEach(el => el.remove());
}
