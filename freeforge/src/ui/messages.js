import { renderMd } from '../markdown.js';
import { $, esc, S } from '../state.js';
import { toast } from './toast.js';


function injectCodeBlockUI(container) {
  container.querySelectorAll('pre').forEach(pre => {
    const codeEl = pre.querySelector('code');
    if (!codeEl || pre.querySelector('.copy-code-btn')) return;
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
  });
}

export function scrollBottom(smooth = true) {
  const a = $('msgs-area');
  a.scrollTo({ top: a.scrollHeight, behavior: smooth ? 'smooth' : 'instant' });
}

export function setStreamMode(active) {
  S.streaming = active;
  $('send-icon').classList.toggle('hidden', active);
  $('stop-icon').classList.toggle('hidden', !active);
  $('send-btn').setAttribute('aria-label', active ? 'Stop streaming' : 'Send message');
}

export function renderAllMessages() {
  const list = $('msgs-list');
  const empty = $('empty-state');

  if (S.messages.length === 0) {
    empty.classList.remove('hidden');
    list.classList.add('hidden');
    return;
  }

  empty.classList.add('hidden');
  list.classList.remove('hidden');

  const lastAsstIdx = S.messages.findLastIndex(m => m.role === 'assistant');
  list.innerHTML = '';
  S.messages.forEach((msg, idx) => {
    list.appendChild(buildMsgEl(msg, idx === lastAsstIdx && !S.streaming));
  });
}

export function buildMsgEl(msg, showRegen = false) {
  const wrap = document.createElement('div');
  wrap.className = 'msg-bubble';
  wrap.dataset.id = msg.id;

  if (msg.role === 'user') {
    wrap.innerHTML = `
      <div class="flex justify-end">
        <div class="max-w-[82%] sm:max-w-[72%]">
          <div class="px-4 py-3 rounded-2xl rounded-tr-sm text-sm text-white leading-relaxed" style="background:linear-gradient(135deg,#4338ca,#6d28d9)">
            ${esc(msg.content).replace(/\n/g, '<br>')}
          </div>
        </div>
      </div>`;
    return wrap;
  }

  if (msg.role === 'notice') {
    wrap.innerHTML = `
      <div class="flex justify-center">
        <div class="px-3 py-1 rounded-full text-xs text-zinc-600 border border-zinc-800" style="background:#18181b">${esc(msg.content)}</div>
      </div>`;
    return wrap;
  }

  const content = msg.streaming
    ? `<div class="msg-content text-zinc-200 leading-relaxed streaming-cursor whitespace-pre-wrap break-words text-sm">${esc(msg.content)}</div>`
    : `<div class="msg-content text-zinc-200 leading-relaxed text-sm">${renderMd(msg.content)}</div>`;

  wrap.innerHTML = `
    <div class="flex items-start gap-3">
      <div class="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style="background:#27272a;border:1px solid #3f3f46">
        <svg class="w-4 h-4 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
        </svg>
      </div>
      <div class="flex-1 min-w-0">
        <div class="rounded-2xl rounded-tl-sm px-4 py-3" style="background:#27272a;border:1px solid #3f3f46">
          ${content}
        </div>
        <div class="flex items-center gap-3 mt-1.5 ml-1">
          ${!msg.streaming ? `
          <button class="copy-btn text-xs text-zinc-600 hover:text-zinc-400 flex items-center gap-1 transition-colors">
            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
            Copy
          </button>` : ''}
          ${showRegen ? `
          <button class="regen-btn text-xs text-zinc-600 hover:text-zinc-400 flex items-center gap-1 transition-colors">
            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
            Regenerate
          </button>` : ''}
        </div>
      </div>
    </div>`;

  if (!msg.streaming) injectCodeBlockUI(wrap);

  const copyBtn = wrap.querySelector('.copy-btn');
  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(msg.content).then(() => {
        copyBtn.innerHTML = `<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>Copied!`;
        copyBtn.classList.add('text-emerald-400');
        setTimeout(() => {
          copyBtn.innerHTML = `<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>Copy`;
          copyBtn.classList.remove('text-emerald-400');
        }, 2000);
      }).catch(() => toast('Copy failed', 'error'));
    });
  }

  return wrap;
}
