import { $ } from '../state.js';

export function showScreen(name) {
  for (const el of document.querySelectorAll('.screen')) {
    el.classList.remove('active');
  }
  $(`screen-${name}`).classList.add('active');
}

export function showInvalidBanner() {
  const b = $('invalid-banner');
  b.classList.remove('hidden');
  b.style.display = 'flex';
}

export function hideInvalidBanner() {
  $('invalid-banner').classList.add('hidden');
}
