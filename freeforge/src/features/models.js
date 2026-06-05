import { S, $, LS, fmtCtx } from '../state.js';
import { fetchFreeModels } from '../api.js';
import { toast } from '../ui/toast.js';
import { showInvalidBanner } from '../ui/screen.js';

function buildOptions(models) {
  const sel = $('model-select');
  sel.innerHTML = '';
  for (const m of models) {
    const ctx = m.context_length ? ` (${fmtCtx(m.context_length)})` : '';
    const opt = document.createElement('option');
    opt.value = m.id;
    opt.textContent = (m.name || m.id) + ctx;
    sel.appendChild(opt);
  }
  return sel;
}

export async function loadModels(key) {
  const sel = $('model-select');
  sel.innerHTML = '<option value="">Loading models…</option>';
  try {
    const models = await fetchFreeModels(key);
    S.models = models;
    if (!models.length) { sel.innerHTML = '<option value="">No free models found</option>'; return; }
    buildOptions(models);
    const saved = LS.get('ff_model');
    const validSaved = saved && models.find(m => m.id === saved);
    if (validSaved) {
      sel.value = saved;
      S.selectedModel = saved;
    } else {
      const preferred = [
        'meta-llama/llama-3.1-8b-instruct:free',
        'meta-llama/llama-3-8b-instruct:free',
        'mistralai/mistral-7b-instruct:free',
        'google/gemma-2-9b-it:free',
        'qwen/qwen-2-7b-instruct:free',
        'microsoft/phi-3-mini-128k-instruct:free',
      ];
      const pick = preferred.find(p => models.find(m => m.id === p)) || models[0]?.id;
      if (pick) { sel.value = pick; S.selectedModel = pick; LS.set('ff_model', pick); }
    }
  } catch (e) {
    sel.innerHTML = '<option value="">Failed to load models</option>';
    toast('Could not load models: ' + e.message, 'error');
    if (e.message.includes('Invalid')) showInvalidBanner();
  }
}

export function populateModelsFromState() {
  const sel = $('model-select');
  if (!S.models.length) { sel.innerHTML = '<option value="">No free models</option>'; return; }
  buildOptions(S.models);
  const saved = LS.get('ff_model');
  const validSaved = saved && S.models.find(m => m.id === saved);
  if (validSaved) { sel.value = saved; S.selectedModel = saved; }
  else if (S.models[0]) { sel.value = S.models[0].id; S.selectedModel = S.models[0].id; }
}

export function changeModel(modelId) {
  if (!modelId) return;
  const exists = S.models.find(m => m.id === modelId);
  if (!exists) { toast('Model unavailable', 'warning'); return; }
  S.selectedModel = modelId;
  $('model-select').value = modelId;
  LS.set('ff_model', modelId);
  toast(`Model: ${exists.name || modelId.split('/').pop()}`, 'info');
}
