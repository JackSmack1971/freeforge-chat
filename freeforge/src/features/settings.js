import { S, $, LS, maskKey, setStoredKey, clearStoredKey } from '../state.js';
import { fetchFreeModels } from '../api.js';
import { showScreen, hideInvalidBanner } from '../ui/screen.js';
import { toast } from '../ui/toast.js';
import { populateModelsFromState } from './models.js';

const CLEAR_CONFIRM_MS = 3000;

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
  ['ff_msgs', 'ff_model'].forEach(k => LS.del(k));
  S.apiKey = null;
  S.messages = [];
  S.models = [];
  S.selectedModel = null;
  closeSettings();
  showScreen('onboarding');
}

export function openSettings() {
  $('settings-key-display').textContent = maskKey(S.apiKey);
  $('settings-new-key').value = '';
  $('settings-key-error').classList.add('hidden');
  resetClearButton($('settings-clear-btn'));
  $('settings-modal').classList.add('open');
}

export function closeSettings() {
  resetClearButton($('settings-clear-btn'));
  $('settings-modal').classList.remove('open');
}

export async function updateKey() {
  const key = $('settings-new-key').value.trim();
  if (!key) {
    const err = $('settings-key-error');
    err.textContent = 'Enter a key';
    err.classList.remove('hidden');
    return;
  }
  const btn = $('settings-update-btn');
  btn.textContent = 'Validating…';
  btn.disabled = true;
  try {
    const models = await fetchFreeModels(key);
    S.apiKey = key;
    S.models = models;
    setStoredKey(key);
    $('settings-key-display').textContent = maskKey(key);
    $('settings-new-key').value = '';
    $('settings-key-error').classList.add('hidden');
    hideInvalidBanner();
    populateModelsFromState();
    closeSettings();
    toast('API key updated!', 'success');
  } catch (e) {
    const err = $('settings-key-error');
    err.textContent = e.message || 'Invalid key';
    err.classList.remove('hidden');
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
