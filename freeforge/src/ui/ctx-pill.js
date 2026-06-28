import { S } from '../state.js';
import { toast } from './toast.js';

export function renderCtxPill() {
  const pill = document.getElementById('ctx-pill');
  if (!pill) return;
  const model = S.models.find(m => m.id === S.selectedModel) ?? {};
  const ceiling = model.context_length ?? 8192;
  const pct = Math.min(Math.round((S.contextTokens / ceiling) * 100), 100);
  const isEst = !S.usageIsExact;
  const prefix = isEst ? '~' : '';

  pill.textContent = `${prefix}${pct}%`;
  pill.title = isEst
    ? `~${S.contextTokens.toLocaleString()} tokens estimated (char÷4) of ${ceiling.toLocaleString()} — exact usage depends on model tokenizer`
    : `${S.contextTokens.toLocaleString()} tokens used of ${ceiling.toLocaleString()}`;
  pill.classList.remove('ctx-ok', 'ctx-warn', 'ctx-danger', 'ctx-est');
  if (pct >= 90) pill.classList.add('ctx-danger');
  else if (pct >= 75) pill.classList.add('ctx-warn');
  else pill.classList.add('ctx-ok');
  if (isEst) pill.classList.add('ctx-est');

  if (pct >= 90 && !S.ctxToastFired) {
    S.ctxToastFired = true;
    toast('Context nearly full', 'warning', 0, { id: 'new-chat', label: 'New Chat' });
  }
}
