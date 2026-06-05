import { esc } from './state.js';

// Module-level initialization (SEC-07): call once at module load, not per-render.
// marked.use() must not be called inside a function or loop per marked.js docs.
marked.use({ breaks: true, gfm: true });

// Explicit allowlist prevents CSS injection (style=) and blocks tags outside
// the markdown rendering surface area. Keep attributes narrow so untrusted
// model output cannot inject duplicate app IDs/classes, and do not allow
// images because assistant output should not trigger passive third-party
// fetches from the user's browser.
const PURIFY_CONFIG = {
  ALLOWED_TAGS: [
    'p', 'br', 'strong', 'em', 'b', 'i', 'u', 's', 'del', 'ins',
    'code', 'pre', 'blockquote', 'ul', 'ol', 'li',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'a', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'hr',
  ],
  ALLOWED_ATTR: ['href', 'title', 'class'],
  FORBID_ATTR: ['style', 'onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur'],
  FORCE_BODY: true,
};

if (typeof DOMPurify !== 'undefined') {
  DOMPurify.addHook('uponSanitizeAttribute', (node, data) => {
    if (data.attrName !== 'class') return;
    const isLanguageClass = /^language-[a-z0-9_-]+$/i.test(data.attrValue);
    if (node.nodeName !== 'CODE' || !isLanguageClass) data.keepAttr = false;
  });
}

export function renderMd(text) {
  if (!text) return '';
  try {
    const raw = marked.parse(text);
    // Sanitize LLM-generated HTML before injecting into the DOM.
    // SEC-04: fallback to escaped text (not raw HTML) when DOMPurify is unavailable.
    return typeof DOMPurify !== 'undefined' ? DOMPurify.sanitize(raw, PURIFY_CONFIG) : esc(text).replace(/\n/g, '<br>');
  } catch {
    return esc(text).replace(/\n/g, '<br>');
  }
}
