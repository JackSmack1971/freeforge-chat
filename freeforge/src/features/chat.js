import { streamCompletion } from '../api.js';
import { $, LS, S, uid } from '../state.js';
import { renderCtxPill } from '../ui/ctx-pill.js';
import { appendNewMessages, renderAllMessages, replaceMessage, scrollBottom, setStreamMode } from '../ui/messages.js';
import { toast } from '../ui/toast.js';

function setLiveRegion(id, text) {
  const region = $(id);
  if (region) region.textContent = text;
}

export async function sendMessage(text) {
  const trimmedText = text.trim();
  if (!trimmedText || S.streaming) return;
  if (trimmedText.length > 32000) {
    toast('Message too long (max 32,000 characters)', 'error');
    return;
  }
  if (!S.selectedModel) { toast('Select a model first', 'warning'); return; }

  const isFirst = S.messages.filter(m => m.role === 'user').length === 0;
  S.lastAssistantResponse = '';

  S.messages.push({ id: uid(), role: 'user', content: trimmedText });

  if (isFirst) {
    S.messages.push({ id: uid(), role: 'notice', content: "You're chatting with a free OpenRouter model. Speed and quality may vary." });
  }

  const asstId = uid();
  const asstMsg = { id: asstId, role: 'assistant', content: '', streaming: true };
  S.messages.push(asstMsg);

  setStreamMode(true);
  setLiveRegion('sr-alert', '');
  setLiveRegion('sr-status', 'Assistant is responding…');
  appendNewMessages();
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
        const charEstimate = Math.ceil((trimmedText.length + S.lastAssistantResponse.length) / 4);
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
      setLiveRegion('sr-status', 'Response complete');
      LS.set('ff_msgs', S.messages);
      if (!replaceMessage(asstMsg, true)) renderAllMessages();
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
      setLiveRegion('sr-status', '');
      setLiveRegion('sr-alert', errMsg);
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
  LS.set('ff_msgs', S.messages);
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
  LS.set('ff_msgs', []);
  renderAllMessages();
  renderCtxPill();
}

if (typeof window !== 'undefined') window.newChat = newChat;
