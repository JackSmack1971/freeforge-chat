import { S, $, LS, maskKey, setStoredKey, clearStoredKey } from '../state.js';
import { fetchFreeModels } from '../api.js';
import { showScreen, hideInvalidBanner } from '../ui/screen.js';
import { toast } from '../ui/toast.js';
import { populateModelsFromState } from './models.js';

export function openSettings() {
  $('settings-key-display').textContent = maskKey(S.apiKey);
  $('settings-new-key').value = '';
  $('settings-key-error').classList.add('hidden');
  $('settings-modal').classList.add('open');
}

export function closeSettings() {
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
  if (!confirm('Clear your API key? You will be taken back to setup.')) return;
  clearStoredKey();
  ['ff_msgs', 'ff_model'].forEach(k => LS.del(k));
  S.apiKey = null;
  S.messages = [];
  S.models = [];
  S.selectedModel = null;
  closeSettings();
  showScreen('onboarding');
}
