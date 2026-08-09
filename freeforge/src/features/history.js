import { $, LS, S, snapshotAgent, uid } from '../state.js';
import { renderCtxPill } from '../ui/ctx-pill.js';
import { createFocusTrap } from '../ui/focus-trap.js';
import { renderAllMessages, renderStreamIcons, scrollBottom } from '../ui/messages.js';
import { toast } from '../ui/toast.js';

const HISTORY_KEY = 'ff_history';
const HISTORY_LIMIT = 10;
const DRAWER_ID = 'history-drawer';
const BACKDROP_ID = 'history-backdrop';
const CLOSE_ID = 'history-close-btn';
const LIST_ID = 'history-list';
const EMPTY_ID = 'history-empty-state';
const CONFIRM_ID = 'history-replace-confirm';
const CONFIRM_NOTE_ID = 'history-replace-note';
const REPLACE_ID = 'history-replace-btn';
const CANCEL_ID = 'history-replace-cancel-btn';
const COMPOSER_ID = 'msg-input';
const TRIGGER_ID = 'history-btn';
const IMPORT_BTN_ID = 'history-import-btn';
const IMPORT_INPUT_ID = 'history-import-input';

let focusTrap = null;
let pendingRestoreId = null;

function getDrawer() {
  return $(DRAWER_ID);
}

function getFocusTrap() {
  if (!focusTrap) focusTrap = createFocusTrap(getDrawer());
  return focusTrap;
}

function normalizeHistory(raw) {
  if (!Array.isArray(raw)) return [];
  const entries = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const messages = Array.isArray(item.messages)
      ? item.messages
          .filter(m => m && typeof m === 'object' && !Array.isArray(m) && typeof m.role === 'string')
          .map(m => ({
            ...m,
            content: typeof m.content === 'string' ? m.content : String(m.content ?? ''),
            streaming: false,
          }))
      : [];
    if (!messages.length) continue;
    entries.push({
      id: typeof item.id === 'string' && item.id ? item.id : uid(),
      savedAt: typeof item.savedAt === 'string' && item.savedAt ? item.savedAt : new Date().toISOString(),
      messages,
      selectedModel: typeof item.selectedModel === 'string' && item.selectedModel ? item.selectedModel : '',
      conversationAgent: item.conversationAgent && typeof item.conversationAgent === 'object' && !Array.isArray(item.conversationAgent)
        ? snapshotAgent(item.conversationAgent)
        : null,
      contextTokens: Number.isFinite(item.contextTokens) && item.contextTokens >= 0 ? item.contextTokens : 0,
      usageIsExact: Boolean(item.usageIsExact),
      lastAssistantResponse: typeof item.lastAssistantResponse === 'string' ? item.lastAssistantResponse : '',
    });
  }
  return entries.slice(0, HISTORY_LIMIT);
}

function readHistory() {
  return normalizeHistory(LS.get(HISTORY_KEY));
}

function writeHistory(entries) {
  LS.set(HISTORY_KEY, entries.slice(0, HISTORY_LIMIT));
}

export function importConversation(text) {
  let parsed;
  try { parsed = JSON.parse(text); } catch { toast('Import failed: invalid JSON', 'error'); return false; }
  const imported = normalizeHistory(Array.isArray(parsed) ? parsed : [parsed]);
  if (!imported.length) { toast('Import failed: no valid conversations found', 'error'); return false; }
  writeHistory([...imported, ...readHistory()]);
  renderHistoryDrawer();
  toast('Conversation imported', 'success');
  return true;
}

export function openImportPicker() {
  $(IMPORT_INPUT_ID)?.click();
}

function cloneMessages(messages) {
  return messages.map(m => ({
    ...m,
    content: typeof m.content === 'string' ? m.content : String(m.content ?? ''),
    streaming: false,
  }));
}

function getFirstUserPrompt(entry) {
  const msg = entry.messages.find(m => m.role === 'user' && String(m.content ?? '').trim());
  return String(msg?.content ?? '').trim();
}

function trimLine(text, limit) {
  const cleaned = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (cleaned.length <= limit) return cleaned;
  return `${cleaned.slice(0, Math.max(0, limit - 1)).trimEnd()}…`;
}

function formatTitle(entry) {
  const prompt = getFirstUserPrompt(entry);
  return trimLine(prompt || 'Untitled conversation', 44);
}

function formatPreview(entry) {
  const prompt = getFirstUserPrompt(entry);
  return trimLine(prompt || 'No prompt captured.', 120);
}

function formatTimestamp(savedAt) {
  const ts = new Date(savedAt);
  if (Number.isNaN(ts.getTime())) return '';
  return ts.toLocaleString();
}

function getHistoryEntry(id) {
  return readHistory().find(entry => entry.id === id) || null;
}

function getComposerText() {
  return $(COMPOSER_ID)?.value?.trim() || '';
}

function hideConfirm() {
  pendingRestoreId = null;
  const confirm = $(CONFIRM_ID);
  const note = $(CONFIRM_NOTE_ID);
  if (confirm) confirm.classList.add('hidden');
  if (note) note.textContent = '';
}

function showConfirm(entry) {
  const confirm = $(CONFIRM_ID);
  const note = $(CONFIRM_NOTE_ID);
  if (!confirm || !note) return;
  pendingRestoreId = entry.id;
  note.textContent = `You have unsent text. Replace it and restore "${formatTitle(entry)}"?`;
  confirm.classList.remove('hidden');
  $(REPLACE_ID)?.focus();
}

function clearInlineUndo() {
  const undo = S.inlineEditUndo;
  if (!undo) return;
  if (undo.timeout) clearTimeout(undo.timeout);
  S.inlineEditUndo = null;
}

function applyArchivedConversation(entry) {
  if (S.abort) {
    S.abort.abort();
    S.abort = null;
  }
  S.activeRequestId = null;
  clearInlineUndo();
  S.streaming = false;
  S.streamTarget = null;
  S.inlineEditId = null;
  S.messages = cloneMessages(entry.messages);
  S.selectedModel = entry.selectedModel || S.selectedModel;
  if (entry.selectedModel) LS.set('ff_model', entry.selectedModel);
  if (entry.selectedModel && $('model-select')) $('model-select').value = entry.selectedModel;
  S.conversationAgent = entry.conversationAgent ? snapshotAgent(entry.conversationAgent) : snapshotAgent(S.activeAgent);
  S.conversationAgentId = S.conversationAgent?.id ?? null;
  S.contextTokens = Number.isFinite(entry.contextTokens) && entry.contextTokens >= 0 ? entry.contextTokens : 0;
  S.usageIsExact = Boolean(entry.usageIsExact);
  S.lastAssistantResponse = entry.lastAssistantResponse;
  renderStreamIcons(false);
  renderAllMessages();
  renderCtxPill();
  scrollBottom(false);
}

function restoreEntry(entry) {
  if (!entry) return;
  applyArchivedConversation(entry);
  hideConfirm();
  closeHistoryDrawer();
}

function renderEmptyState(entries) {
  const empty = $(EMPTY_ID);
  const list = $(LIST_ID);
  if (!empty || !list) return;
  if (entries.length) {
    empty.classList.add('hidden');
    list.classList.remove('hidden');
    return;
  }
  empty.classList.remove('hidden');
  list.classList.add('hidden');
}

export function renderHistoryDrawer() {
  const list = $(LIST_ID);
  if (!list) return;
  const entries = readHistory();
  list.replaceChildren();
  renderEmptyState(entries);

  for (const entry of entries) {
    const card = document.createElement('article');
    card.className = 'rounded-xl border border-zinc-800 bg-zinc-950/60 px-3 py-3';

    const head = document.createElement('div');
    head.className = 'flex items-start justify-between gap-3';

    const meta = document.createElement('div');

    const title = document.createElement('div');
    title.className = 'text-sm font-medium text-zinc-100';
    title.textContent = formatTitle(entry);

    const timestamp = document.createElement('div');
    timestamp.className = 'mt-1 text-xs text-zinc-500';
    timestamp.textContent = formatTimestamp(entry.savedAt);

    meta.append(title, timestamp);

    const restoreBtn = document.createElement('button');
    restoreBtn.type = 'button';
    restoreBtn.className = 'shrink-0 rounded-lg border border-zinc-700 px-2.5 py-1 text-xs font-medium text-zinc-300 hover:border-zinc-600 hover:text-white transition-colors';
    restoreBtn.dataset.historyAction = 'restore';
    restoreBtn.dataset.historyId = entry.id;
    restoreBtn.textContent = 'Restore';

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'shrink-0 rounded-lg border border-red-900/60 px-2.5 py-1 text-xs font-medium text-red-300 hover:border-red-700 hover:text-red-200 transition-colors';
    deleteBtn.dataset.historyAction = 'delete';
    deleteBtn.dataset.historyId = entry.id;
    deleteBtn.setAttribute('aria-label', `Delete ${formatTitle(entry)}`);
    deleteBtn.textContent = 'Delete';

    const actions = document.createElement('div');
    actions.className = 'flex shrink-0 items-center gap-2';
    actions.append(restoreBtn, deleteBtn);

    head.append(meta, actions);

    const preview = document.createElement('p');
    preview.className = 'mt-3 text-sm text-zinc-400';
    preview.textContent = formatPreview(entry);

    card.append(head, preview);
    list.appendChild(card);
  }
}

export function archiveCurrentThread() {
  if (!S.messages.length) return false;
  const entries = readHistory();
  entries.unshift({
    id: uid(),
    savedAt: new Date().toISOString(),
    messages: cloneMessages(S.messages),
    selectedModel: S.selectedModel || '',
    conversationAgent: snapshotAgent(S.conversationAgent || S.activeAgent),
    contextTokens: Number.isFinite(S.contextTokens) && S.contextTokens >= 0 ? S.contextTokens : 0,
    usageIsExact: Boolean(S.usageIsExact),
    lastAssistantResponse: typeof S.lastAssistantResponse === 'string' ? S.lastAssistantResponse : '',
  });
  writeHistory(entries);
  renderHistoryDrawer();
  return true;
}

export function openHistoryDrawer() {
  const drawer = getDrawer();
  if (!drawer) return;
  hideConfirm();
  renderHistoryDrawer();
  drawer.classList.remove('hidden');
  drawer.classList.add('open');
  drawer.setAttribute('aria-hidden', 'false');
  getFocusTrap().open();
  $(CLOSE_ID)?.focus();
}

export function closeHistoryDrawer() {
  const drawer = getDrawer();
  if (!drawer || drawer.classList.contains('hidden')) return;
  hideConfirm();
  drawer.classList.add('hidden');
  drawer.classList.remove('open');
  drawer.setAttribute('aria-hidden', 'true');
  getFocusTrap().close($(TRIGGER_ID));
}

function handleRestoreClick(id) {
  const entry = getHistoryEntry(id);
  if (!entry) return;
  if (getComposerText()) {
    showConfirm(entry);
    return;
  }
  restoreEntry(entry);
}

function deleteEntry(id) {
  const entries = readHistory();
  if (!entries.some(entry => entry.id === id)) return;
  writeHistory(entries.filter(entry => entry.id !== id));
  renderHistoryDrawer();
}

function confirmPendingRestore() {
  if (!pendingRestoreId) return;
  const entry = getHistoryEntry(pendingRestoreId);
  if (!entry) {
    hideConfirm();
    return;
  }
  const composer = $(COMPOSER_ID);
  if (composer) {
    composer.value = '';
    composer.style.height = 'auto';
  }
  restoreEntry(entry);
}

export function initHistoryDrawer() {
  $(BACKDROP_ID)?.addEventListener('click', closeHistoryDrawer);
  $(CLOSE_ID)?.addEventListener('click', closeHistoryDrawer);
  $(LIST_ID)?.addEventListener('click', e => {
    const action = e.target.closest('[data-history-action]');
    if (!action) return;
    const id = action.dataset.historyId;
    if (!id) return;
    if (action.dataset.historyAction === 'restore') handleRestoreClick(id);
    if (action.dataset.historyAction === 'delete') deleteEntry(id);
  });
  $(REPLACE_ID)?.addEventListener('click', confirmPendingRestore);
  $(CANCEL_ID)?.addEventListener('click', hideConfirm);
  $(IMPORT_BTN_ID)?.addEventListener('click', openImportPicker);
  $(IMPORT_INPUT_ID)?.addEventListener('change', e => {
    const file = e.target.files?.[0];
    if (!file) return;
    file.text().then(importConversation).catch(() => toast('Import failed: could not read file', 'error'));
    e.target.value = '';
  });
  renderHistoryDrawer();
}
