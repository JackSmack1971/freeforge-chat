import { buildRequestContext } from '../agent-runtime.js';
import { streamCompletion } from '../api.js';
import { $, LS, S, snapshotAgent, uid } from '../state.js';
import { renderCtxPill } from '../ui/ctx-pill.js';
import { appendNewMessages, renderAllMessages, replaceMessage, scrollBottom, setStreamMode } from '../ui/messages.js';
import { clearPersistent, toast } from '../ui/toast.js';

const INLINE_EDIT_UNDO_MS = 6000;
const ACTIVE_AGENT_KEY = 'ff_active_agent_id';
const CONVERSATION_AGENT_KEY = 'ff_conversation_agent';

function setLiveRegion(id, text) {
  const region = $(id);
  if (region) region.textContent = text;
}

function inlineEditUndoMatchesToken(undo, token) {
  return Boolean(undo && undo.token === token);
}

function clearInlineEditUndo(token = null) {
  const undo = S.inlineEditUndo;
  if (!undo) return false;
  if (token && !inlineEditUndoMatchesToken(undo, token)) return false;
  if (undo.timeout) clearTimeout(undo.timeout);
  S.inlineEditUndo = null;
  return true;
}

function setInlineEditUndo(slice) {
  clearInlineEditUndo();
  const token = uid();
  const timeout = setTimeout(() => {
    clearInlineEditUndo(token);
  }, INLINE_EDIT_UNDO_MS);
  S.inlineEditUndo = { slice, token, timeout };
  return token;
}

function syncConversationAgent() {
  S.conversationAgent = snapshotAgent(S.activeAgent);
  S.conversationAgentId = S.conversationAgent?.id ?? null;
  LS.set(CONVERSATION_AGENT_KEY, S.conversationAgent);
}

export function setActiveAgent(agent) {
  const nextId = agent?.id ?? null;
  const changed = S.activeAgentId !== nextId;
  S.activeAgentId = nextId;
  S.activeAgent = agent || null;
  if (nextId) LS.set(ACTIVE_AGENT_KEY, nextId);
  else LS.del(ACTIVE_AGENT_KEY);
  if (S.messages.length) {
    newChat();
    return changed;
  }
  syncConversationAgent();
  return changed;
}

function validateSendText(text) {
  const trimmedText = text.trim();
  if (!trimmedText || S.streaming) return { ok: false, trimmedText };
  if (trimmedText.length > 32000) return { ok: false, trimmedText, toast: ['Message too long (max 32,000 characters)', 'error'] };
  if (!S.selectedModel) return { ok: false, trimmedText, toast: ['Select a model first', 'warning'] };
  return { ok: true, trimmedText };
}

function truncateConversationFromUserMessage(messageId) {
  const idx = S.messages.findIndex(m => m.id === messageId && m.role === 'user');
  if (idx === -1) return null;
  const token = setInlineEditUndo(S.messages.slice(idx));
  S.messages.splice(idx);
  S.inlineEditId = null;
  LS.set('ff_msgs', S.messages);
  renderAllMessages();
  return token;
}

export async function sendMessage(text) {
  const validation = validateSendText(text);
  if (!validation.ok) {
    if (validation.toast) toast(...validation.toast);
    return;
  }
  const { trimmedText } = validation;

  if (S.messages.length && S.conversationAgentId && S.activeAgentId && S.conversationAgentId !== S.activeAgentId) {
    newChat();
  }

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

  const convoAgent = S.conversationAgent || snapshotAgent(S.activeAgent);
  if (!S.conversationAgent && convoAgent) syncConversationAgent();
  const request = buildRequestContext(S.messages.filter(m => m.id !== asstId), convoAgent);

  let firstToken = true;
  const ctrl = new AbortController();
  S.abort = ctrl;
  S.streamTarget = null;

  await streamCompletion({
    messages: request.messages,
    modelId: S.selectedModel,
    apiKey: S.apiKey,
    parameters: request.parameters,
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
        S.contextTokens = exactTokens;
        S.usageIsExact = true;
      } else {
        const totalChars = S.messages.filter(m => m.role === 'user' || m.role === 'assistant').reduce((sum, m) => sum + (m.content?.length ?? 0), 0);
        S.contextTokens = Math.ceil(totalChars / 4);
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
      if (!LS.set('ff_msgs', S.messages)) toast('Storage quota exceeded — conversation history may not persist after reload', 'warning', 8000);
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

export async function resendFromUserMessage(messageId, text) {
  const validation = validateSendText(text);
  if (!validation.ok) {
    if (validation.toast) toast(...validation.toast);
    return null;
  }

  const token = truncateConversationFromUserMessage(messageId);
  if (token === null) {
    toast('That message is no longer available', 'error');
    return null;
  }

  void sendMessage(validation.trimmedText);
  return token;
}

export async function regenerate() {
  if (S.streaming) return;
  const lastUser = [...S.messages].reverse().find(m => m.role === 'user');
  if (!lastUser) {
    if (S.messages.length) newChat();
    return;
  }
  const validation = validateSendText(lastUser.content);
  if (!validation.ok) return;
  const token = truncateConversationFromUserMessage(lastUser.id);
  if (token === null) {
    toast('That message is no longer available', 'error');
    return;
  }
  await sendMessage(validation.trimmedText);
}

export function copyLastResponse() {
  const msg = [...S.messages].reverse().find(m => m.role === 'assistant' && m.content);
  if (!msg) {
    toast('No response to copy yet', 'info');
    return;
  }
  navigator.clipboard.writeText(msg.content)
    .then(() => toast('Copied', 'success'))
    .catch(() => toast('Copy failed — clipboard blocked on file://', 'error'));
}

export function newChat() {
  if (S.abort) { S.abort.abort(); S.abort = null; }
  clearInlineEditUndo();
  clearPersistent();
  S.messages = [];
  S.streaming = false;
  S.inlineEditId = null;
  S.contextTokens = 0;
  S.usageIsExact = false;
  S.ctxToastFired = false;
  S.lastAssistantResponse = '';
  syncConversationAgent();
  setStreamMode(false);
  $('thinking').classList.add('hidden');
  LS.set('ff_msgs', []);
  renderAllMessages();
  renderCtxPill();
}

export function restoreInlineEditUndo(token) {
  const undo = S.inlineEditUndo;
  if (!inlineEditUndoMatchesToken(undo, token)) return false;
  const slice = undo.slice;
  clearInlineEditUndo(token);
  S.messages.splice(0, S.messages.length, ...slice);
  S.inlineEditId = null;
  LS.set('ff_msgs', S.messages);
  renderAllMessages();
  renderCtxPill();
  return true;
}

export function hasInlineEditUndo(token) {
  return inlineEditUndoMatchesToken(S.inlineEditUndo, token);
}

export function selfCheckInlineEditUndo() {
  const token = uid();
  return inlineEditUndoMatchesToken({ token }, token) && !inlineEditUndoMatchesToken({ token }, `${token}-x`);
}
