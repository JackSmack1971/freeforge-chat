import { S, $, LS, uid } from '../state.js';
import { streamCompletion } from '../api.js';
import { toast } from '../ui/toast.js';
import { renderCtxPill } from '../ui/ctx-pill.js';
import { renderAllMessages, scrollBottom, setStreamMode } from '../ui/messages.js';

const MAX_PERSISTED_MSGS = 100;

function persistMessages() {
  const toSave = S.messages.length > MAX_PERSISTED_MSGS
    ? S.messages.slice(S.messages.length - MAX_PERSISTED_MSGS)
    : S.messages;
  if (!LS.set('ff_msgs', toSave)) {
    toast('Chat history could not be saved locally', 'warning');
  }
}

export async function sendMessage(text) {
  text = text.trim();
  if (!text || S.streaming) return;
  if (text.length > 32000) {
    toast('Message too long (max 32,000 characters)', 'error');
    return;
  }
  if (!S.selectedModel) { toast('Select a model first', 'warning'); return; }

  const isFirst = S.messages.filter(m => m.role === 'user').length === 0;
  S.lastAssistantResponse = '';

  S.messages.push({ id: uid(), role: 'user', content: text });

  if (isFirst) {
    S.messages.push({ id: uid(), role: 'notice', content: "You're chatting with a free OpenRouter model. Speed and quality may vary." });
  }

  const asstId = uid();
  const asstMsg = { id: asstId, role: 'assistant', content: '', streaming: true };
  S.messages.push(asstMsg);

  setStreamMode(true);
  renderAllMessages();
  $('thinking').classList.remove('hidden');
  scrollBottom(false);

  const payload = S.messages
    .filter(m => (m.role === 'user' || m.role === 'assistant') && m.id !== asstId)
    .map(m => ({ role: m.role, content: m.content }));

  let firstToken = true;
  const ctrl = new AbortController();
  S.abort = ctrl;
  S.streamTarget = null;

  await streamCompletion(payload, S.selectedModel, S.apiKey, {
    signal: ctrl.signal,
    onToken(_delta, full) {
      if (firstToken) {
        firstToken = false;
        $('thinking').classList.add('hidden');
        S.streamTarget = document.querySelector(`[data-id="${asstId}"] .msg-content`);
      }
      asstMsg.content = full;
      S.lastAssistantResponse = full;
      if (S.streamTarget) S.streamTarget.textContent = full;
      scrollBottom(false);
    },
    onDone(rawPayload, full) {
      let parsed;
      try { parsed = JSON.parse(rawPayload); } catch { parsed = {}; }
      const exactTokens = parsed?.usage?.total_tokens ?? null;
      if (exactTokens !== null) {
        S.contextTokens += exactTokens;
        S.usageIsExact = true;
      } else {
        const charEstimate = Math.ceil((text.length + S.lastAssistantResponse.length) / 4);
        S.contextTokens += charEstimate;
        S.usageIsExact = false;
      }
      if (!Number.isFinite(S.contextTokens) || S.contextTokens < 0) S.contextTokens = 0;

      $('thinking').classList.add('hidden');
      asstMsg.content = full || asstMsg.content;
      S.lastAssistantResponse = asstMsg.content;
      asstMsg.streaming = false;
      S.streaming = false;
      S.abort = null;
      S.streamTarget = null;
      setStreamMode(false);
      persistMessages();
      renderAllMessages();
      renderCtxPill();
      scrollBottom();
      return exactTokens;
    },
    onError(errMsg) {
      $('thinking').classList.add('hidden');
      S.messages = S.messages.filter(m => m.id !== asstId);
      S.streaming = false;
      S.abort = null;
      S.streamTarget = null;
      setStreamMode(false);
      toast(errMsg, 'error', 6000);
      renderAllMessages();
    },
  });
}

export async function regenerate() {
  if (S.streaming) return;
  const lastAsstIdx = S.messages.findLastIndex(m => m.role === 'assistant');
  if (lastAsstIdx === -1) return;
  S.messages.splice(lastAsstIdx, 1);
  const lastUserIdx = S.messages.findLastIndex(m => m.role === 'user');
  if (lastUserIdx === -1) return;
  const text = S.messages[lastUserIdx].content;
  S.messages.splice(lastUserIdx, 1);
  const noticeIdx = S.messages.findIndex(m => m.role === 'notice');
  if (noticeIdx !== -1) S.messages.splice(noticeIdx, 1);
  persistMessages();
  renderAllMessages();
  await sendMessage(text);
}

export function copyLastResponse() {
  const msg = [...S.messages].reverse().find(m => m.role === 'assistant' && m.content);
  if (!msg) { toast('No response to copy yet', 'info'); return; }
  navigator.clipboard.writeText(msg.content)
    .then(() => toast('Copied', 'success'))
    .catch(() => toast('Copy failed — clipboard blocked on file://', 'error'));
}

export function newChat() {
  if (S.abort) { S.abort.abort(); S.abort = null; }
  S.messages = [];
  S.streaming = false;
  S.contextTokens = 0;
  S.usageIsExact = false;
  S.ctxToastFired = false;
  S.lastAssistantResponse = '';
  setStreamMode(false);
  $('thinking').classList.add('hidden');
  persistMessages();
  renderAllMessages();
  renderCtxPill();
}

if (typeof window !== 'undefined') window.newChat = newChat;
