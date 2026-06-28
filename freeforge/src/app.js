import { newChat, regenerate, sendMessage } from './features/chat.js';
import { loadModels } from './features/models.js';
import { hideObError, validateAndConnect } from './features/onboarding.js';
import { closePalette, openPalette } from './features/palette.js';
import { clearKey, clearKeyError as clearSettingsKeyError, closeSettings, openSettings, updateKey } from './features/settings.js';
import { $, LS, S, getErrorLog, getStoredKey, recordError } from './state.js';
import { renderCtxPill } from './ui/ctx-pill.js';
import { renderAllMessages, scrollBottom } from './ui/messages.js';
import { hideInvalidBanner, showScreen } from './ui/screen.js';
import { toast } from './ui/toast.js';

function syncObToggleVis(show) {
  const btn = $('ob-toggle-vis');
  btn.setAttribute('aria-label', show ? 'Hide API key' : 'Show API key');
  btn.setAttribute('aria-pressed', String(show));
}

async function init() {
  const savedKey = getStoredKey();
  if (!savedKey) { showScreen('onboarding'); return; }

  S.apiKey = savedKey;
  const savedMsgs = LS.get('ff_msgs');
  if (Array.isArray(savedMsgs)) {
    S.messages = savedMsgs.filter(m => !m.streaming);
  }

  showScreen('chat');
  renderAllMessages();
  scrollBottom(false);
  await loadModels(savedKey);
  renderCtxPill();
}

function installErrorCapture() {
  window.addEventListener('error', e => {
    recordError({
      type: 'error',
      msg: e.message || 'Unknown error',
      src: e.filename || '',
      line: e.lineno || 0,
      col: e.colno || 0,
    });
  });

  window.addEventListener('unhandledrejection', e => {
    const reason = e.reason;
    recordError({
      type: 'unhandledrejection',
      msg: reason?.message || String(reason),
    });
  });

}

document.addEventListener('DOMContentLoaded', () => {
  installErrorCapture();

  // onboarding
  $('ob-key-input').closest('form')?.addEventListener('submit', e => {
    e.preventDefault();
    $('ob-save-btn').click();
  });
  $('ob-toggle-vis').addEventListener('click', () => {
    const inp = $('ob-key-input');
    const show = inp.type === 'password';
    inp.type = show ? 'text' : 'password';
    syncObToggleVis(show);
    $('ob-eye-show').classList.toggle('hidden', show);
    $('ob-eye-hide').classList.toggle('hidden', !show);
  });
  syncObToggleVis(false);
  $('ob-key-input').addEventListener('input', hideObError);
  $('ob-key-input').addEventListener('keydown', e => { if (e.key === 'Enter') $('ob-save-btn').click(); });
  $('ob-save-btn').addEventListener('click', () => validateAndConnect($('ob-key-input').value));

  // model select
  $('model-select').addEventListener('change', e => {
    const prev = S.selectedModel;
    S.selectedModel = e.target.value;
    LS.set('ff_model', S.selectedModel);
    renderCtxPill();
    if (prev && prev !== S.selectedModel) {
      const m = S.models.find(x => x.id === S.selectedModel);
      toast(`Model: ${m?.name || S.selectedModel.split('/').pop()}`, 'info');
    }
  });

  // settings
  $('settings-new-key').closest('form')?.addEventListener('submit', e => {
    e.preventDefault();
    $('settings-update-btn').click();
  });
  $('settings-btn').addEventListener('click', openSettings);
  $('close-settings-btn').addEventListener('click', closeSettings);
  $('settings-backdrop').addEventListener('click', closeSettings);
  $('settings-clear-btn').addEventListener('click', clearKey);
  $('settings-update-btn').addEventListener('click', updateKey);
  $('settings-new-key').addEventListener('input', clearSettingsKeyError);
  $('banner-update-btn').addEventListener('click', () => { hideInvalidBanner(); openSettings(); });

  // new chat
  $('new-chat-btn').addEventListener('click', newChat);
  // toast action buttons — delegated
  document.addEventListener('click', e => {
    if (e.target.closest('[data-action="new-chat"]')) newChat();
  });

  // input textarea
  const inp = $('msg-input');
  const submitInput = text => {
    inp.value = '';
    inp.style.height = 'auto';
    sendMessage(text);
  };
  inp.addEventListener('input', () => {
    inp.style.height = 'auto';
    inp.style.height = `${Math.min(inp.scrollHeight, 160)}px`;
  });
  inp.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!S.streaming) {
        submitInput(inp.value);
      }
    }
  });

  $('send-btn').addEventListener('click', () => {
    if (S.streaming) {
      if (S.abort) { S.abort.abort(); S.abort = null; }
      return;
    }
    submitInput(inp.value);
  });

  // suggestion chips — delegated
  document.addEventListener('click', e => {
    if (e.target.classList.contains('suggestion')) {
      if (S.streaming) return;
      submitInput(e.target.textContent);
    }
  });

  // regenerate — delegated to avoid circular dep between messages.js and chat.js
  document.addEventListener('click', e => {
    if (e.target.closest('.regen-btn')) regenerate();
  });

  // command palette
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      const active = document.activeElement;
      const isInInput = active instanceof HTMLInputElement
        || active instanceof HTMLTextAreaElement;
      const paletteOpen = !document.getElementById('cmd-palette')?.classList.contains('hidden');
      if (!isInInput || paletteOpen) {
        e.preventDefault();
        paletteOpen ? closePalette() : openPalette();
      }
    }

    if (e.key === 'Escape' && S.streaming) {
      S.abort?.abort();
    }
  });

  // escape closes modal
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSettings(); });

  init();
});
