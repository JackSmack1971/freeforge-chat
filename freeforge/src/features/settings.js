import { fetchFreeModels } from '../api.js';
import { $, clearStoredKey, LS, maskKey, S, setStoredKey } from '../state.js';
import { hideInvalidBanner, showScreen } from '../ui/screen.js';
import { toast } from '../ui/toast.js';
import { populateModelsFromState } from './models.js';

const CLEAR_CONFIRM_MS = 3000;
let previousFocus = null;

function resetClearButton(btn) {
  if (btn._confirmTimer) {
    clearTimeout(btn._confirmTimer);
    btn._confirmTimer = null;
  }
  btn.dataset.confirm = '';
  btn.textContent = 'Clear Key';
  btn.classList.remove('bg-red-600', 'text-white');
}

function executeClearKey() {
  clearStoredKey();
  ['ff_msgs', 'ff_model'].forEach(k => {
    LS.del(k);
  });
  S.apiKey = null;
  S.messages = [];
  S.models = [];
  S.selectedModel = null;
  closeSettings();
  showScreen('onboarding');
}

function getFocusableInModal() {
  return [...$('settings-modal').querySelectorAll(
    'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
  )].filter(el => el.closest('.hidden') === null && el.offsetParent !== null);
}

export function clearKeyError() {
  const err = $('settings-key-error');
  err.textContent = '';
  err.classList.add('hidden');
  $('settings-new-key').setAttribute('aria-invalid', 'false');
}

function showKeyError(msg) {
  const err = $('settings-key-error');
  err.textContent = msg;
  err.classList.remove('hidden');
  $('settings-new-key').setAttribute('aria-invalid', 'true');
}

function trapFocus(e) {
  if (e.key !== 'Tab') return;
  const focusable = getFocusableInModal();
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

export function openSettings() {
  previousFocus = document.activeElement;
  $('settings-key-display').textContent = maskKey(S.apiKey);
  $('settings-new-key').value = '';
  clearKeyError();
  resetClearButton($('settings-clear-btn'));
  const modal = $('settings-modal');
  modal.classList.add('open');
  modal.addEventListener('keydown', trapFocus);
  const [first] = getFocusableInModal();
  if (first) first.focus();
}

export function closeSettings() {
  resetClearButton($('settings-clear-btn'));
  clearKeyError();
  const modal = $('settings-modal');
  modal.classList.remove('open');
  modal.removeEventListener('keydown', trapFocus);
  if (previousFocus && document.contains(previousFocus)) previousFocus.focus();
  previousFocus = null;
}

export async function updateKey() {
  const key = $('settings-new-key').value.trim();
  if (!key) {
    showKeyError('Enter a key');
    return;
  }
  const btn = $('settings-update-btn');
  btn.textContent = 'Validating…';
  btn.disabled = true;
  try {
    const models = await fetchFreeModels(key);
    if (!models.length) {
      showKeyError('No free models found for this key');
      return;
    }
    S.apiKey = key;
    S.models = models;
    setStoredKey(key);
    $('settings-key-display').textContent = maskKey(key);
    $('settings-new-key').value = '';
    clearKeyError();
    hideInvalidBanner();
    populateModelsFromState();
    closeSettings();
    toast('API key updated!', 'success');
  } catch (e) {
    showKeyError(e.message || 'Invalid key');
  } finally {
    btn.textContent = 'Update Key';
    btn.disabled = false;
  }
}

export function clearKey() {
  const btn = $('settings-clear-btn');
  if (btn.dataset.confirm === 'pending') {
    resetClearButton(btn);
    executeClearKey();
    return;
  }

  btn.dataset.confirm = 'pending';
  btn.textContent = 'Click again to confirm';
  btn.classList.add('bg-red-600', 'text-white');
  btn._confirmTimer = setTimeout(() => resetClearButton(btn), CLEAR_CONFIRM_MS);
}
