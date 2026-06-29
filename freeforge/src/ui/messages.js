import { renderMd } from '../markdown.js';
import { $, S } from '../state.js';
import { toast } from './toast.js';

let renderedCount = 0;
const DEFAULT_STARTER_PROMPTS = [
  'Explain quantum computing',
  'Write a Python script',
  'Help me brainstorm ideas',
  'Debug my code',
];

function getStarterPrompts() {
  const prompts = S.conversationAgent?.instructions?.starterPrompts;
  return Array.isArray(prompts) && prompts.length ? prompts : DEFAULT_STARTER_PROMPTS;
}

function renderStarterPrompts() {
  const host = document.getElementById('starter-prompts');
  if (!host) return;
  host.textContent = '';
  for (const prompt of getStarterPrompts()) {
    const btn = document.createElement('button');
    btn.className = 'suggestion text-xs px-3 py-1.5 rounded-full border border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 transition-colors';
    btn.type = 'button';
    btn.textContent = prompt;
    host.appendChild(btn);
  }
}

function injectCodeBlockUI(container) {
  for (const pre of container.querySelectorAll('pre')) {
    const codeEl = pre.querySelector('code');
    if (!codeEl || pre.querySelector('.copy-code-btn')) continue;
    const langClass = [...codeEl.classList].find(c => c.startsWith('language-'));
    const lang = langClass ? langClass.replace('language-', '') : '';

    if (lang) {
      const label = document.createElement('span');
      label.className = 'lang-label';
      label.textContent = lang;
      pre.appendChild(label);
    }
    const btn = document.createElement('button');
    btn.className = 'copy-code-btn';
    btn.textContent = 'Copy';
    btn.addEventListener('click', () => {
      navigator.clipboard.writeText(codeEl.textContent)
        .then(() => toast('Copied', 'success'))
        .catch(() => toast('Copy failed — clipboard blocked on file://', 'error'));
    });
    pre.appendChild(btn);
  }
}

export function scrollBottom(smooth = true) {
  const a = $('msgs-area');
  a.scrollTo({ top: a.scrollHeight, behavior: smooth ? 'smooth' : 'instant' });
}

export function setStreamMode(active) {
  S.streaming = active;
  $('send-icon').classList.toggle('hidden', active);
  $('stop-icon').classList.toggle('hidden', !active);
  $('send-btn').setAttribute('aria-label', active ? 'Stop generating' : 'Send message');
}

function syncMessageVisibility() {
  const list = $('msgs-list');
  const empty = $('empty-state');
  renderStarterPrompts();

  if (S.messages.length === 0) {
    empty.classList.remove('hidden');
    list.classList.add('hidden');
    list.innerHTML = '';
    renderedCount = 0;
    return;
  }

  empty.classList.add('hidden');
  list.classList.remove('hidden');
}

export function appendNewMessages() {
  const list = $('msgs-list');
  syncMessageVisibility();
  if (S.messages.length === 0) return;

  const lastAsstIdx = S.messages.findLastIndex(m => m.role === 'assistant');
  while (renderedCount < S.messages.length) {
    const idx = renderedCount;
    const msg = S.messages[idx];
    list.appendChild(buildMsgEl(msg, idx === lastAsstIdx && !S.streaming));
    renderedCount += 1;
  }
}

export function replaceMessage(msg, showRegen = false) {
  const current = document.querySelector(`[data-id="${msg.id}"]`);
  if (!current) return false;
  current.replaceWith(buildMsgEl(msg, showRegen));
  return true;
}

export function renderAllMessages() {
  const list = $('msgs-list');
  syncMessageVisibility();
  if (S.messages.length === 0) return;

  list.innerHTML = '';
  renderedCount = 0;
  appendNewMessages();
}

function el(tag, className = '') {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}

function svgIcon(pathData, { strokeWidth = '2.0', classes = 'w-4 h-4' } = {}) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', classes);
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('viewBox', '0 0 24 24');

  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('stroke-linecap', 'round');
  path.setAttribute('stroke-linejoin', 'round');
  path.setAttribute('stroke-width', strokeWidth);
  path.setAttribute('d', pathData);
  svg.appendChild(path);
  return svg;
}

function setButtonContent(btn, iconPath, label, options = {}) {
  btn.replaceChildren(svgIcon(iconPath, { classes: 'w-3 h-3', ...options }), document.createTextNode(label));
}

function getInlineEditMsg() {
  return S.messages.find(m => m.id === S.inlineEditId && m.role === 'user') || null;
}

export function startInlineEdit(messageId) {
  const msg = S.messages.find(m => m.id === messageId && m.role === 'user');
  if (!msg) return;
  S.inlineEditId = messageId;
  renderAllMessages();
  requestAnimationFrame(() => {
    const textarea = document.querySelector(`[data-id="${messageId}"] .msg-inline-textarea`);
    textarea?.focus();
    textarea?.setSelectionRange(textarea.value.length, textarea.value.length);
  });
}

export function cancelInlineEdit() {
  if (!S.inlineEditId) return;
  S.inlineEditId = null;
  renderAllMessages();
}

function buildInlineEditor(msg) {
  const editor = el('div', 'msg-inline-editor px-4 py-3 rounded-2xl rounded-tr-sm');
  const textarea = el('textarea', 'msg-inline-textarea w-full resize-none rounded-xl border border-zinc-700 bg-zinc-950/70 px-3 py-2 text-sm leading-relaxed text-zinc-100 placeholder-zinc-500 focus:border-indigo-400 focus:outline-none');
  textarea.value = msg.content;
  textarea.setAttribute('aria-label', 'Edit message');
  textarea.rows = Math.max(2, Math.min(8, msg.content.split('\n').length || 2));

  const actions = el('div', 'msg-inline-actions flex items-center justify-end gap-2');
  const confirmBtn = el('button', 'msg-inline-confirm rounded-lg border border-indigo-400/40 bg-indigo-500/20 px-3 py-1.5 text-xs font-medium text-indigo-100 transition-colors hover:border-indigo-300 hover:bg-indigo-500/30');
  confirmBtn.type = 'button';
  confirmBtn.dataset.inlineEditConfirm = 'true';
  confirmBtn.textContent = 'Save';

  const cancelBtn = el('button', 'msg-inline-cancel rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:border-zinc-500 hover:text-white');
  cancelBtn.type = 'button';
  cancelBtn.dataset.inlineEditCancel = 'true';
  cancelBtn.textContent = 'Cancel';

  actions.append(confirmBtn, cancelBtn);
  editor.append(textarea, actions);
  return editor;
}

export function buildMsgEl(msg, showRegen = false) {
  const wrap = document.createElement('div');
  wrap.className = 'msg-bubble';
  wrap.dataset.id = msg.id;

  if (msg.role === 'user') {
    const row = el('div', 'flex justify-end');
    const shell = el('div', 'max-w-[82%] sm:max-w-[72%]');
    const activeEdit = getInlineEditMsg();
    if (activeEdit && activeEdit.id === msg.id) {
      shell.appendChild(buildInlineEditor(msg));
    } else {
      const bubble = el('div', 'msg-user-surface px-4 py-3 rounded-2xl rounded-tr-sm text-sm text-white leading-relaxed whitespace-pre-wrap break-words');
      bubble.dataset.inlineEditTarget = 'true';
      bubble.textContent = msg.content;
      shell.appendChild(bubble);
    }
    row.appendChild(shell);
    wrap.appendChild(row);
    return wrap;
  }

  if (msg.role === 'notice') {
    const row = el('div', 'flex justify-center');
    const badge = el('div', 'msg-notice-surface px-3 py-1 rounded-full text-xs text-zinc-600 border border-zinc-800');
    badge.textContent = msg.content;
    row.appendChild(badge);
    wrap.appendChild(row);
    return wrap;
  }

  const row = el('div', 'flex items-start gap-3');
  const avatar = el('div', 'assistant-avatar-surface w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5');
  const agent = S.conversationAgent;
  if (agent?.icon?.value) {
    avatar.classList.add('text-sm');
    avatar.textContent = agent.icon.value;
    avatar.title = agent.name || 'Assistant';
  } else {
    const avatarIcon = svgIcon('M13 10V3L4 14h7v7l9-11h-7z');
    avatarIcon.classList.add('text-zinc-400');
    avatar.appendChild(avatarIcon);
  }

  const main = el('div', 'flex-1 min-w-0');
  const bubble = el('div', 'assistant-bubble-surface rounded-2xl rounded-tl-sm px-4 py-3');
  const content = el('div', `msg-content text-zinc-200 leading-relaxed text-sm${msg.streaming ? ' streaming-cursor whitespace-pre-wrap break-words' : ''}`);
  if (msg.streaming) {
    content.textContent = msg.content;
  } else {
    content.innerHTML = renderMd(msg.content);
  }
  bubble.appendChild(content);

  const actions = el('div', 'flex items-center gap-3 mt-1.5 ml-1');
  if (!msg.streaming) {
    const copyBtn = el('button', 'copy-btn text-xs text-zinc-600 hover:text-zinc-400 flex items-center gap-1 transition-colors');
    setButtonContent(copyBtn, 'M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z', 'Copy');
    actions.appendChild(copyBtn);
  }
  if (showRegen) {
    const regenBtn = el('button', 'regen-btn text-xs text-zinc-600 hover:text-zinc-400 flex items-center gap-1 transition-colors');
    setButtonContent(regenBtn, 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15', 'Regenerate');
    actions.appendChild(regenBtn);
  }

  main.append(bubble, actions);
  row.append(avatar, main);
  wrap.appendChild(row);

  if (!msg.streaming) injectCodeBlockUI(wrap);

  const copyBtn = wrap.querySelector('.copy-btn');
  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(msg.content).then(() => {
        setButtonContent(copyBtn, 'M5 13l4 4L19 7', 'Copied!');
        copyBtn.classList.add('text-emerald-400');
        setTimeout(() => {
          setButtonContent(copyBtn, 'M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z', 'Copy');
          copyBtn.classList.remove('text-emerald-400');
        }, 2000);
      }).catch(() => toast('Copy failed', 'error'));
    });
  }

  return wrap;
}
