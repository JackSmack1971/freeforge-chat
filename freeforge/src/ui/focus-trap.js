const FOCUSABLE_SELECTOR = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function createFocusTrap(containerEl) {
  let previousFocus = null;

  function getFocusable() {
    if (!containerEl) return [];
    return [...containerEl.querySelectorAll(FOCUSABLE_SELECTOR)].filter(el => el.offsetParent !== null);
  }

  function trapFocus(e) {
    if (e.key !== 'Tab') return;
    const focusable = getFocusable();
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  function open() {
    if (!containerEl) return null;
    previousFocus = document.activeElement;
    containerEl.removeEventListener('keydown', trapFocus);
    containerEl.addEventListener('keydown', trapFocus);
    return getFocusable()[0] || null;
  }

  function close(fallback = null) {
    if (!containerEl) return;
    containerEl.removeEventListener('keydown', trapFocus);
    const target = previousFocus && document.contains(previousFocus) ? previousFocus : fallback;
    if (target) target.focus();
    previousFocus = null;
  }

  return { open, close };
}
