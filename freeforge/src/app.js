import { S, $, LS, getStoredKey } from './state.js';
import { showScreen, hideInvalidBanner } from './ui/screen.js';
import { renderAllMessages, scrollBottom } from './ui/messages.js';
import { toast } from './ui/toast.js';
import { loadModels } from './features/models.js';
import { validateAndConnect, hideObError } from './features/onboarding.js';
import { openSettings, closeSettings, updateKey, clearKey } from './features/settings.js';
import { sendMessage, regenerate, newChat } from './features/chat.js';

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
}

document.addEventListener('DOMContentLoaded', () => {

  // onboarding
  $('ob-toggle-vis').addEventListener('click', () => {
    const inp = $('ob-key-input');
    const show = inp.type === 'password';
    inp.type = show ? 'text' : 'password';
    $('ob-eye-show').classList.toggle('hidden', show);
    $('ob-eye-hide').classList.toggle('hidden', !show);
  });
  $('ob-key-input').addEventListener('input', hideObError);
  $('ob-key-input').addEventListener('keydown', e => { if (e.key === 'Enter') $('ob-save-btn').click(); });
  $('ob-save-btn').addEventListener('click', () => validateAndConnect($('ob-key-input').value));

  // model select
  $('model-select').addEventListener('change', e => {
    const prev = S.selectedModel;
    S.selectedModel = e.target.value;
    LS.set('ff_model', S.selectedModel);
    if (prev && prev !== S.selectedModel) {
      const m = S.models.find(x => x.id === S.selectedModel);
      toast(`Model: ${m?.name || S.selectedModel.split('/').pop()}`, 'info');
    }
  });

  // settings
  $('settings-btn').addEventListener('click', openSettings);
  $('close-settings-btn').addEventListener('click', closeSettings);
  $('settings-backdrop').addEventListener('click', closeSettings);
  $('settings-clear-btn').addEventListener('click', clearKey);
  $('settings-update-btn').addEventListener('click', updateKey);
  $('banner-update-btn').addEventListener('click', () => { hideInvalidBanner(); openSettings(); });

  // new chat
  $('new-chat-btn').addEventListener('click', newChat);

  // input textarea
  const inp = $('msg-input');
  const submitInput = text => {
    inp.value = '';
    inp.style.height = 'auto';
    sendMessage(text);
  };
  inp.addEventListener('input', () => {
    inp.style.height = 'auto';
    inp.style.height = Math.min(inp.scrollHeight, 160) + 'px';
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

  // escape closes modal
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSettings(); });

  init();
});
