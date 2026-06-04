import { $ } from '../state.js';

export function showScreen(name) {
  document.querySelectorAll('.screen').forEach(el => el.classList.remove('active'));
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
