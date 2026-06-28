import { fetchFreeModels } from '../api.js';
import { $, S, setStoredKey } from '../state.js';
import { renderAllMessages } from '../ui/messages.js';
import { showScreen } from '../ui/screen.js';
import { toast } from '../ui/toast.js';
import { populateModelsFromState } from './models.js';

export async function validateAndConnect(key) {
  key = key.trim();
  if (!key) { showObError('Enter your API key first'); return; }
  if (!key.startsWith('sk-or-v1-')) { showObError("Keys must start with 'sk-or-v1-'"); return; }

  $('ob-save-label').classList.add('hidden');
  $('ob-save-loading').classList.remove('hidden');
  $('ob-save-loading').classList.add('flex');
  $('ob-save-btn').disabled = true;

  try {
    const models = await fetchFreeModels(key);
    if (!models.length) { showObError('No free models found for this key'); return; }
    S.apiKey = key;
    S.models = models;
    setStoredKey(key);
    toast('Connected successfully!', 'success');
    showScreen('chat');
    renderAllMessages();
    populateModelsFromState();
  } catch (e) {
    const m = e.message || '';
    if (m.includes('Invalid') || m.includes('401')) showObError('Invalid API key — check and try again.');
    else if (m.includes('Rate') || m.includes('429')) showObError('Rate limited — wait a moment then retry.');
    else showObError('Network error — check your connection.');
  } finally {
    $('ob-save-label').classList.remove('hidden');
    $('ob-save-loading').classList.add('hidden');
    $('ob-save-loading').classList.remove('flex');
    $('ob-save-btn').disabled = false;
  }
}

export function showObError(msg) {
  const el = $('ob-key-error');
  el.textContent = msg;
  el.classList.remove('hidden');
  $('ob-key-input').setAttribute('aria-invalid', 'true');
}

export function hideObError() {
  const input = $('ob-key-input');
  input.setAttribute('aria-invalid', 'false');
  const el = $('ob-key-error');
  el.textContent = '';
  el.classList.add('hidden');
}
