import { S, $, LS, uid } from '../state.js';
import { streamCompletion } from '../api.js';
import { toast } from '../ui/toast.js';
import { renderAllMessages, scrollBottom, setStreamMode } from '../ui/messages.js';

export async function sendMessage(text) {
  text = text.trim();
  if (!text || S.streaming) return;
  if (text.length > 32000) {
    toast('Message too long (max 32,000 characters)', 'error');
    return;
  }
  if (!S.selectedModel) { toast('Select a model first', 'warning'); return; }

  const isFirst = S.messages.filter(m => m.role === 'user').length === 0;

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
  S.streamTarget = null;

  await streamCompletion(payload, S.selectedModel, S.apiKey, {
    onToken(_delta, full) {
      if (firstToken) {
        firstToken = false;
        $('thinking').classList.add('hidden');
        S.streamTarget = document.querySelector(`[data-id="${asstId}"] .msg-content`);
      }
      asstMsg.content = full;
      if (S.streamTarget) S.streamTarget.textContent = full;
      scrollBottom(false);
    },
    onDone(full) {
      $('thinking').classList.add('hidden');
      asstMsg.content = full || asstMsg.content;
      asstMsg.streaming = false;
      S.streaming = false;
      S.abort = null;
      S.streamTarget = null;
      setStreamMode(false);
      LS.set('ff_msgs', S.messages);
      renderAllMessages();
      scrollBottom();
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
  LS.set('ff_msgs', S.messages);
  renderAllMessages();
  await sendMessage(text);
}

export function newChat() {
  if (S.abort) { S.abort.abort(); S.abort = null; }
  S.messages = [];
  S.streaming = false;
  setStreamMode(false);
  $('thinking').classList.add('hidden');
  LS.set('ff_msgs', []);
  renderAllMessages();
}
