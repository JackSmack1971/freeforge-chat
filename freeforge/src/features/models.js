import { fetchFreeModels } from '../api.js';
import { $, LS, S, fmtCtx } from '../state.js';
import { renderCtxPill } from '../ui/ctx-pill.js';
import { showInvalidBanner } from '../ui/screen.js';
import { toast } from '../ui/toast.js';

function rankModels(models) {
  return [...models].sort((a, b) => {
    const ctxDelta = (b.context_length || 0) - (a.context_length || 0);
    if (ctxDelta !== 0) return ctxDelta;
    return (a.name || a.id).localeCompare(b.name || b.id);
  });
}

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
    const models = rankModels(await fetchFreeModels(key));
    S.models = models;
    if (!models.length) { sel.innerHTML = '<option value="">No free models found</option>'; return; }
    buildOptions(models);
    const saved = LS.get('ff_model');
    const validSaved = saved && models.find(m => m.id === saved);
    if (validSaved) {
      sel.value = saved;
      S.selectedModel = saved;
    } else {
      const pick = models[0]?.id;
      if (pick) { sel.value = pick; S.selectedModel = pick; LS.set('ff_model', pick); }
    }
  } catch (e) {
    sel.innerHTML = '<option value="">Failed to load models</option>';
    toast(`Could not load models: ${e.message}`, 'error');
    if (e.message.includes('Invalid')) showInvalidBanner();
  }
}

export function populateModelsFromState() {
  const sel = $('model-select');
  if (!S.models.length) { sel.innerHTML = '<option value="">No free models</option>'; return; }
  S.models = rankModels(S.models);
  buildOptions(S.models);
  const saved = LS.get('ff_model');
  const validSaved = saved && S.models.find(m => m.id === saved);
  if (validSaved) { sel.value = saved; S.selectedModel = saved; }
  else if (S.models[0]) { sel.value = S.models[0].id; S.selectedModel = S.models[0].id; }
}

export function changeModel(modelId) {
  if (!modelId) return;
  const model = S.models.find(m => m.id === modelId);
  if (!model) { toast('Model unavailable', 'warning'); return; }

  const prev = S.selectedModel;
  S.selectedModel = modelId;
  $('model-select').value = modelId;
  LS.set('ff_model', modelId);
  renderCtxPill();

  if (prev !== modelId) {
    toast(`Model: ${model.name || modelId.split('/').pop()}`, 'info');
  }
}
