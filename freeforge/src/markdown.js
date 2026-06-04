import { esc } from './state.js';

// Module-level initialization (SEC-07): call once at module load, not per-render.
// marked.use() must not be called inside a function or loop per marked.js docs.
marked.use({ breaks: true, gfm: true });

export function renderMd(text) {
  if (!text) return '';
  try {
    const raw = marked.parse(text);
    // Sanitize LLM-generated HTML before injecting into the DOM.
    // SEC-04: fallback to escaped text (not raw HTML) when DOMPurify is unavailable.
    return typeof DOMPurify !== 'undefined' ? DOMPurify.sanitize(raw) : esc(text).replace(/\n/g, '<br>');
  } catch {
    return esc(text).replace(/\n/g, '<br>');
  }
}
