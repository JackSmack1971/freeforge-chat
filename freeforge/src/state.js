if (!Array.prototype.findLastIndex) {
  Array.prototype.findLastIndex = function (fn) {
    for (let i = this.length - 1; i >= 0; i--) {
      if (fn(this[i], i, this)) return i;
    }
    return -1;
  };
}

export const S = {
  apiKey: null,
  models: [],
  selectedModel: null,
  messages: [],
  streaming: false,
  abort: null,
  streamTarget: null,
};

export const LS = {
  get(k) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  del(k) { try { localStorage.removeItem(k); } catch {} },
};

export const $ = id => document.getElementById(id);
export const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

export function getStoredKey() {
  try { return localStorage.getItem('ff_key'); } catch { return null; }
}
export function setStoredKey(key) {
  try { localStorage.setItem('ff_key', key); } catch {}
}

export function maskKey(k) {
  if (!k || k.length < 8) return '••••••••';
  return k.slice(0, 6) + '••••••••••••' + k.slice(-4);
}

export function fmtCtx(n) {
  if (!n) return '';
  if (n >= 1e6) return `${(n / 1e6).toFixed(0)}M ctx`;
  if (n >= 1e3) return `${Math.round(n / 1e3)}k ctx`;
  return `${n} ctx`;
}
