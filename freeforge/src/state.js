export const S = {
  apiKey: null,
  models: [],
  selectedModel: null,
  messages: [],
  streaming: false,
  abort: null,
  streamTarget: null,
  contextTokens: 0,
  usageIsExact: false,
  ctxToastFired: false,
  lastAssistantResponse: '',
};

export const LS = {
  get(k) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch { return null; } },
  set(k, v) {
    try {
      localStorage.setItem(k, JSON.stringify(v));
      return true;
    } catch {
      return false;
    }
  },
  del(k) { try { localStorage.removeItem(k); } catch {} },
};

export const $ = id => document.getElementById(id);
export const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
const ERROR_LOG_LIMIT = 50;
const errorLog = [];

export function recordError(entry) {
  errorLog.push({ ts: Date.now(), ...entry });
  if (errorLog.length > ERROR_LOG_LIMIT) errorLog.shift();
}

export function getErrorLog() {
  return errorLog.slice();
}

export function getStoredKey() {
  try {
    const sess = sessionStorage.getItem('ff_key');
    if (sess) return sess;
    // One-time migration: move plaintext key from localStorage into sessionStorage
    // so it no longer rests on disk between browser restarts (CWE-922).
    const local = localStorage.getItem('ff_key');
    if (local) {
      sessionStorage.setItem('ff_key', local);
      localStorage.removeItem('ff_key');
      return local;
    }
    return null;
  } catch { return null; }
}
export function setStoredKey(key) {
  try { sessionStorage.setItem('ff_key', key); } catch {}
  // Ensure no plaintext copy lingers in persistent storage.
  try { localStorage.removeItem('ff_key'); } catch {}
}
export function clearStoredKey() {
  try { sessionStorage.removeItem('ff_key'); } catch {}
  try { localStorage.removeItem('ff_key'); } catch {}
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
