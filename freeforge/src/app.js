import { loadAgents } from './agent-storage.js';
import { refreshAgentUi } from './features/agents.js';
import { newChat, regenerate, resendFromUserMessage, restoreInlineEditUndo, sendMessage } from './features/chat.js';
import { loadModels } from './features/models.js';
import { hideObError, showObError, validateAndConnect } from './features/onboarding.js';
import { closePalette, openPalette } from './features/palette.js';
import { clearKey, clearKeyError as clearSettingsKeyError, closeSettings, openSettings, updateKey } from './features/settings.js';
import { $, LS, S, clearStoredKey, getStoredKey, recordError, snapshotAgent } from './state.js';
import { closeAgentLibrary } from './ui/agent-library.js';
import { renderCtxPill } from './ui/ctx-pill.js';
import { cancelInlineEdit, renderAllMessages, scrollBottom, startInlineEdit } from './ui/messages.js';
import { hideInvalidBanner, showScreen } from './ui/screen.js';
import { toast } from './ui/toast.js';

function syncObToggleVis(show) {
  const btn = $('ob-toggle-vis');
  btn.setAttribute('aria-label', show ? 'Hide API key' : 'Show API key');
  btn.setAttribute('aria-pressed', String(show));
}

function getToastAction(node) {
  let cur = node;
  while (cur) {
    const action = cur.dataset?.action;
    if (action) return action;
    cur = cur.parentNode;
  }
  return null;
}

async function init() {
  const savedKey = getStoredKey();
  if (!savedKey) {
    showScreen('onboarding');
    return;
  }

  S.apiKey = savedKey;
  S.agents = loadAgents();
  const savedActiveAgentId = LS.get('ff_active_agent_id');
  S.activeAgent = S.agents.find(agent => agent.id === savedActiveAgentId) || S.agents[0] || null;
  S.activeAgentId = S.activeAgent?.id ?? null;

  const savedMsgs = LS.get('ff_msgs');
  if (Array.isArray(savedMsgs)) {
    S.messages = savedMsgs.filter(m => !m.streaming);
  }

  const savedConversationAgent = S.messages.length ? LS.get('ff_conversation_agent') : null;
  S.conversationAgent = savedConversationAgent ? snapshotAgent(savedConversationAgent) : snapshotAgent(S.activeAgent);
  S.conversationAgentId = S.conversationAgent?.id ?? null;

  const modelLoad = await loadModels(savedKey);
  if (modelLoad === 'empty') {
    clearStoredKey();
    S.apiKey = null;
    showScreen('onboarding');
    showObError('No free models found for this key');
    return;
  }

  showScreen('chat');
  renderAllMessages();
  scrollBottom(false);
  refreshAgentUi();
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
    const action = getToastAction(e.target);
    if (!action) return;
    if (action === 'new-chat') {
      newChat();
      return;
    }
    if (action.startsWith('inline-edit-undo:')) {
      const token = action.slice('inline-edit-undo:'.length);
      if (S.abort) { S.abort.abort(); S.abort = null; }
      restoreInlineEditUndo(token);
    }
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

  // inline edit entry — delegated
  document.addEventListener('click', e => {
    if (S.streaming) return;
    const confirm = e.target.closest('[data-inline-edit-confirm="true"]');
    if (confirm) {
      const row = confirm.closest('[data-id]');
      const msgId = row?.dataset.id;
      const textarea = confirm.closest('.msg-bubble')?.querySelector('.msg-inline-textarea');
      const text = textarea?.value.trim() || '';
      if (!msgId || !text) return;
      resendFromUserMessage(msgId, text).then(token => {
        if (token) toast('Edit saved', 'success', 6000, { id: `inline-edit-undo:${token}`, label: 'Undo' });
      });
      return;
    }

    const cancel = e.target.closest('[data-inline-edit-cancel="true"]');
    if (cancel) {
      cancelInlineEdit();
      return;
    }

    const bubble = e.target.closest('.msg-user-surface[data-inline-edit-target="true"]');
    if (!bubble) return;
    const msgId = bubble.closest('[data-id]')?.dataset.id;
    if (msgId) startInlineEdit(msgId);
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
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    closeAgentLibrary();
    closeSettings();
  });

  init();
});
