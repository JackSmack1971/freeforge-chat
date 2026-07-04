import { fetchFreeModels } from '../api.js';
import { $, LS, S, clearStoredKey, maskKey, setStoredKey } from '../state.js';
import { createFocusTrap } from '../ui/focus-trap.js';
import { hideInvalidBanner, showScreen } from '../ui/screen.js';
import { clearPersistent, toast } from '../ui/toast.js';
import { populateModelsFromState } from './models.js';

const CLEAR_CONFIRM_MS = 3000;
let focusTrap = null;

function getFocusTrap() {
  if (!focusTrap) focusTrap = createFocusTrap($('settings-modal'));
  return focusTrap;
}

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
  clearPersistent();
  clearStoredKey();
  for (const k of ['ff_msgs', 'ff_model']) {
    LS.del(k);
  }
  S.apiKey = null;
  S.messages = [];
  S.models = [];
  S.selectedModel = null;
  closeSettings();
  showScreen('onboarding');
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

export function openSettings() {
  $('settings-key-display').textContent = maskKey(S.apiKey);
  $('settings-new-key').value = '';
  clearKeyError();
  resetClearButton($('settings-clear-btn'));
  const modal = $('settings-modal');
  modal.classList.remove('hidden');
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  const first = getFocusTrap().open();
  if (first) first.focus();
}

export function closeSettings() {
  resetClearButton($('settings-clear-btn'));
  clearKeyError();
  const modal = $('settings-modal');
  modal.classList.add('hidden');
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
  getFocusTrap().close();
}

export async function updateKey() {
  const key = $('settings-new-key').value.trim();
  if (!key) {
    showKeyError('Enter a key');
    return;
  }
  if (!key.startsWith('sk-or-v1-')) {
    showKeyError("Keys must start with 'sk-or-v1-'");
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
