import path from 'node:path';
import { pathToFileURL } from 'node:url';

class MockEventTarget {
  constructor() {
    this.listeners = new Map();
  }

  addEventListener(type, fn) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(fn);
  }

  removeEventListener(type, fn) {
    const list = this.listeners.get(type);
    if (!list) return;
    const idx = list.indexOf(fn);
    if (idx !== -1) list.splice(idx, 1);
  }

  dispatchEvent(event) {
    const e = typeof event === 'string' ? { type: event } : event;
    e.target ??= this;
    e.currentTarget ??= this;
    for (const fn of this.listeners.get(e.type) ?? []) fn(e);
    return true;
  }
}

class MockClassList {
  constructor(owner) {
    this.owner = owner;
    this.set = new Set();
  }

  add(...names) {
    for (const name of names) this.set.add(name);
    this.owner.className = [...this.set].join(' ');
  }

  remove(...names) {
    for (const name of names) this.set.delete(name);
    this.owner.className = [...this.set].join(' ');
  }

  toggle(name, force) {
    const shouldAdd = force ?? !this.set.has(name);
    if (shouldAdd) this.set.add(name);
    else this.set.delete(name);
    this.owner.className = [...this.set].join(' ');
    return shouldAdd;
  }

  contains(name) {
    return this.set.has(name);
  }

  [Symbol.iterator]() {
    return this.set[Symbol.iterator]();
  }

  toString() {
    return [...this.set].join(' ');
  }
}

function normalizeAttrName(name) {
  return name.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`);
}

function matchesSimpleSelector(node, selector) {
  if (!selector) return false;
  if (!node) return false;
  if (!node.tagName) return false;
  if (selector === node.tagName.toLowerCase()) return true;
  if (selector.startsWith('.')) return node.classList.contains(selector.slice(1));
  if (selector.startsWith('#')) return node.id === selector.slice(1);
  if (selector === 'a[href]') return node.tagName === 'A' && node.href;
  if (selector === 'pre') return node.tagName === 'PRE';
  if (selector === 'code') return node.tagName === 'CODE';
  if (selector === 'span') return node.tagName === 'SPAN';
  if (selector === 'button') return node.tagName === 'BUTTON';
  if (selector === 'input') return node.tagName === 'INPUT';
  if (selector === 'select') return node.tagName === 'SELECT';
  if (selector === 'textarea') return node.tagName === 'TEXTAREA';
  if (selector === 'form') return node.tagName === 'FORM';
  if (selector === '[data-action="new-chat"]') return node.dataset.action === 'new-chat';
  if (selector === '[data-id]') return Boolean(node.dataset.id);
  if (selector === '[tabindex]') return node.attributes.has('tabindex');
  if (selector === '.screen') return node.classList.contains('screen');
  if (/^\[data-id="(.+)"\]$/.test(selector)) return node.dataset.id === selector.match(/^\[data-id="(.+)"\]$/)[1];
  if (/^\[data-action="(.+)"\]$/.test(selector)) return node.dataset.action === selector.match(/^\[data-action="(.+)"\]$/)[1];
  return false;
}

function parseAttributes(node, attrText) {
  const attrRe = /([a-zA-Z0-9:-]+)(?:="([^"]*)")?/g;
  let m;
  while ((m = attrRe.exec(attrText))) {
    const [, name, value = ''] = m;
    node.setAttribute(name, value);
  }
}

function createParsedAnchor(html) {
  const m = html.match(/<a\b([^>]*)>([\s\S]*?)<\/a>/i);
  if (!m) return null;
  const node = new MockElement('a');
  parseAttributes(node, m[1] ?? '');
  node.textContent = m[2].replace(/<[^>]+>/g, '');
  return node;
}

function createParsedPre(html) {
  const m = html.match(/<pre\b([^>]*)>([\s\S]*?)<\/pre>/i);
  if (!m) return null;
  const pre = new MockElement('pre');
  parseAttributes(pre, m[1] ?? '');
  const codeMatch = m[2].match(/<code\b([^>]*)>([\s\S]*?)<\/code>/i);
  if (codeMatch) {
    const code = new MockElement('code');
    parseAttributes(code, codeMatch[1] ?? '');
    code.textContent = codeMatch[2].replace(/<[^>]+>/g, '');
    pre.appendChild(code);
  }
  return pre;
}

function createParsedSpan(html) {
  if (!/<span\b/i.test(html)) return null;
  const span = new MockElement('span');
  span.textContent = html.replace(/<[^>]+>/g, '');
  return span;
}

export class MockElement extends MockEventTarget {
  constructor(tagName = 'div', { id = '' } = {}) {
    super();
    this.tagName = tagName.toUpperCase();
    this.id = id;
    this.dataset = {};
    this.attributes = new Map();
    this.children = [];
    this.parentNode = null;
    this.classList = new MockClassList(this);
    this._className = '';
    this.style = {};
    this.textContent = '';
    this._innerHTML = '';
    this.value = '';
    this.type = '';
    this.disabled = false;
    this.scrollHeight = 0;
    this.offsetParent = {};
    this.role = '';
    this.href = '';
    this.download = '';
    this.tabIndex = 0;
  }

  set className(value) {
    this._className = String(value);
    if (this.classList) this.classList.set = new Set(String(value).split(/\s+/).filter(Boolean));
  }

  get className() {
    return this._className;
  }

  set innerHTML(html) {
    this._innerHTML = String(html);
    this.children = [];
    const span = createParsedSpan(this._innerHTML);
    if (span) this.appendChild(span);
    const preMatches = [...this._innerHTML.matchAll(/<pre\b[\s\S]*?<\/pre>/gi)];
    for (const match of preMatches) {
      const pre = createParsedPre(match[0]);
      if (pre) this.appendChild(pre);
    }
    const anchorMatches = [...this._innerHTML.matchAll(/<a\b[\s\S]*?<\/a>/gi)];
    for (const match of anchorMatches) {
      const anchor = createParsedAnchor(match[0]);
      if (anchor) this.appendChild(anchor);
    }
  }

  get innerHTML() {
    return this._innerHTML;
  }

  appendChild(child) {
    child.parentNode = this;
    this.children.push(child);
    return child;
  }

  append(...nodes) {
    for (const node of nodes.flat()) this.appendChild(node);
  }

  replaceChildren(...nodes) {
    this.children = [];
    this.append(...nodes);
  }

  replaceWith(node) {
    if (!this.parentNode) return;
    const idx = this.parentNode.children.indexOf(this);
    if (idx !== -1) this.parentNode.children.splice(idx, 1, node);
    node.parentNode = this.parentNode;
  }

  remove() {
    if (!this.parentNode) return;
    const idx = this.parentNode.children.indexOf(this);
    if (idx !== -1) this.parentNode.children.splice(idx, 1);
  }

  setAttribute(name, value) {
    const norm = normalizeAttrName(name);
    this.attributes.set(norm, String(value));
    if (norm === 'class') {
      this.className = String(value);
      this.classList.set = new Set(String(value).split(/\s+/).filter(Boolean));
    } else if (norm === 'href') {
      this.href = String(value);
    } else if (norm === 'download') {
      this.download = String(value);
    } else if (norm === 'role') {
      this.role = String(value);
    } else if (norm === 'tabindex') {
      this.tabIndex = Number(value);
    } else if (norm.startsWith('data-')) {
      this.dataset[norm.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = String(value);
    }
  }

  getAttribute(name) {
    return this.attributes.get(normalizeAttrName(name)) ?? null;
  }

  focus() {
    if (this.ownerDocument) this.ownerDocument.activeElement = this;
  }

  click() {
    this.dispatchEvent({ type: 'click', target: this });
  }

  scrollTo(opts) {
    this.scrollToArgs = opts;
  }

  closest(selector) {
    let node = this;
    if (selector === 'form' && this.formOwner) return this.formOwner;
    while (node) {
      if (selector === '.hidden' && node.classList.contains('hidden')) return node;
      if (selector === 'form' && node.tagName === 'FORM') return node;
      if (selector.startsWith('.') && node.classList.contains(selector.slice(1))) return node;
      if (selector.startsWith('[data-action="') && node.dataset.action === selector.match(/^\[data-action="(.+)"\]$/)?.[1]) return node;
      node = node.parentNode;
    }
    return null;
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] ?? null;
  }

  querySelectorAll(selector) {
    if (selector === 'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])') {
      return this.children.filter(el => {
        if (el.classList.contains('hidden')) return false;
        if (el.disabled) return false;
        return ['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName) || el.attributes.has('tabindex');
      });
    }
    const selectors = selector.split(',').map(s => s.trim()).filter(Boolean);
    const found = [];
    const visit = node => {
      for (const simple of selectors) {
        if (matchesSimpleSelector(node, simple)) {
          found.push(node);
          break;
        }
      }
      if (Array.isArray(node.children)) {
        for (const child of node.children) visit(child);
      }
    };
    visit(this);
    return found;
  }
}

export class MockInputElement extends MockElement {}

export class MockTextAreaElement extends MockElement {}

export class MockDocument extends MockEventTarget {
  constructor() {
    super();
    this.elements = new Map();
    this.activeElement = null;
  }

  register(element) {
    if (element.id) {
      element.ownerDocument = this;
      this.elements.set(element.id, element);
    }
    return element;
  }

  createElement(tag) {
    return this.register(new MockElement(tag));
  }

  createElementNS(_ns, tag) {
    return this.register(new MockElement(tag));
  }

  createTextNode(text) {
    return { nodeType: 3, textContent: String(text), parentNode: null };
  }

  getElementById(id) {
    return this.elements.get(id) ?? null;
  }

  querySelector(selector) {
    if (selector === '.screen') return this.querySelectorAll(selector)[0] ?? null;
    const dataIdMatch = selector.match(/^\[data-id="(.+)"\]\s+\.msg-content$/);
    if (dataIdMatch) {
      const root = this.querySelector(`[data-id="${dataIdMatch[1]}"]`);
      return root?.querySelector('.msg-content') ?? null;
    }
    return this.querySelectorAll(selector)[0] ?? null;
  }

  querySelectorAll(selector) {
    if (selector === '.screen') return [...this.elements.values()].filter(el => el.classList.contains('screen'));
    return [...this.elements.values()].flatMap(el => el.querySelectorAll(selector)).filter((el, idx, arr) => arr.indexOf(el) === idx);
  }

  _visit(node, fn) {
    if (fn(node)) return node;
    for (const child of node.children) {
      const hit = this._visit(child, fn);
      if (hit) return hit;
    }
    return null;
  }

  contains(node) {
    return [...this.elements.values()].some(root => Boolean(this._visit(root, current => current === node)));
  }
}

export class MemoryStorage {
  constructor(seed = {}, { throwOnGet = false, throwOnSet = false, throwOnRemove = false } = {}) {
    this.map = new Map(Object.entries(seed));
    this.throwOnGet = throwOnGet;
    this.throwOnSet = throwOnSet;
    this.throwOnRemove = throwOnRemove;
  }

  getItem(key) {
    if (this.throwOnGet) throw new Error('getItem failed');
    return this.map.has(key) ? this.map.get(key) : null;
  }

  setItem(key, value) {
    if (this.throwOnSet) throw new Error('setItem failed');
    this.map.set(key, String(value));
  }

  removeItem(key) {
    if (this.throwOnRemove) throw new Error('removeItem failed');
    this.map.delete(key);
  }
}

export function installGlobals(values) {
  const previous = new Map();
  for (const [key, value] of Object.entries(values)) {
    previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, {
      configurable: true,
      enumerable: true,
      writable: true,
      value,
    });
  }
  return () => {
    for (const [key, value] of previous) {
      if (!value) delete globalThis[key];
      else Object.defineProperty(globalThis, key, value);
    }
  };
}

export async function importFresh(relPath) {
  const url = pathToFileURL(path.resolve(relPath)).href;
  return import(`${url}?v=${Date.now()}-${Math.random()}`);
}

export async function importShared(relPath) {
  return import(pathToFileURL(path.resolve(relPath)).href);
}

export function makeBaseDom() {
  const doc = new MockDocument();
  const taggedIds = [
    ['ctx-pill', 'div'],
    ['toasts', 'div'],
    ['invalid-banner', 'div'],
    ['thinking', 'div'],
    ['sr-alert', 'div'],
    ['sr-status', 'div'],
    ['msgs-area', 'div'],
    ['msgs-list', 'div'],
    ['empty-state', 'div'],
    ['send-icon', 'span'],
    ['stop-icon', 'span'],
    ['send-btn', 'button'],
    ['model-select', 'select'],
    ['settings-modal', 'div'],
    ['settings-key-display', 'div'],
    ['settings-new-key', 'input'],
    ['settings-clear-btn', 'button'],
    ['settings-update-btn', 'button'],
    ['settings-key-error', 'div'],
    ['settings-btn', 'button'],
    ['close-settings-btn', 'button'],
    ['settings-backdrop', 'div'],
    ['banner-update-btn', 'button'],
    ['new-chat-btn', 'button'],
    ['msg-input', 'textarea'],
    ['cmd-palette', 'div'],
    ['cmd-search', 'input'],
    ['cmd-backdrop', 'div'],
    ['palette-trigger-btn', 'button'],
    ['cmd-list', 'div'],
    ['ob-key-input', 'input'],
    ['ob-save-btn', 'button'],
    ['ob-eye-show', 'span'],
    ['ob-eye-hide', 'span'],
    ['ob-toggle-vis', 'button'],
    ['ob-save-label', 'span'],
    ['ob-save-loading', 'span'],
    ['ob-key-error', 'div'],
    ['screen-onboarding', 'div'],
    ['screen-chat', 'div'],
    ['settings-extra-input', 'input'],
  ];
  for (const [id, tag] of taggedIds) {
    const el = tag === 'input'
      ? new MockInputElement(tag, { id })
      : tag === 'textarea'
        ? new MockTextAreaElement(tag, { id })
        : new MockElement(tag, { id });
    doc.register(el);
  }
  doc.getElementById('send-btn').appendChild(doc.createElement('span'));
  doc.getElementById('settings-modal').appendChild(doc.getElementById('settings-clear-btn'));
  doc.getElementById('settings-modal').appendChild(doc.getElementById('settings-update-btn'));
  doc.getElementById('settings-modal').appendChild(doc.getElementById('settings-new-key'));
  const extraInput = doc.register(new MockElement('input', { id: 'settings-extra-input' }));
  doc.getElementById('settings-modal').appendChild(extraInput);
  doc.getElementById('cmd-palette').appendChild(doc.getElementById('cmd-search'));
  doc.getElementById('cmd-palette').appendChild(doc.getElementById('cmd-list'));
  doc.getElementById('cmd-palette').appendChild(doc.getElementById('cmd-backdrop'));
  doc.getElementById('screen-onboarding').classList.add('screen');
  doc.getElementById('screen-chat').classList.add('screen');
  doc.getElementById('screen-onboarding').classList.add('active');
  doc.getElementById('screen-chat').classList.add('hidden');
  doc.getElementById('cmd-palette').classList.add('hidden');
  doc.getElementById('invalid-banner').classList.add('hidden');
  doc.getElementById('thinking').classList.add('hidden');
  doc.getElementById('ob-key-input').type = 'password';
  const obForm = doc.register(new MockElement('form'));
  obForm.appendChild(doc.getElementById('ob-key-input'));
  const settingsForm = doc.register(new MockElement('form'));
  settingsForm.appendChild(doc.getElementById('settings-new-key'));
  doc.getElementById('ob-key-input').formOwner = obForm;
  doc.getElementById('settings-new-key').formOwner = settingsForm;
  doc.getElementById('settings-modal').appendChild(doc.getElementById('settings-key-display'));
  doc.getElementById('settings-modal').appendChild(doc.getElementById('settings-key-error'));
  doc.getElementById('settings-modal').appendChild(doc.getElementById('settings-backdrop'));
  doc.getElementById('settings-modal').appendChild(doc.getElementById('close-settings-btn'));
  doc.getElementById('settings-modal').appendChild(doc.getElementById('settings-clear-btn'));
  doc.getElementById('settings-modal').appendChild(doc.getElementById('settings-update-btn'));
  doc.getElementById('settings-modal').appendChild(doc.getElementById('settings-new-key'));
  doc.getElementById('settings-modal').appendChild(doc.getElementById('settings-btn'));
  return doc;
}

export function makeWindow() {
  return new MockEventTarget();
}

export function makeClipboard() {
  return {
    calls: [],
    writeText(text) {
      this.calls.push(text);
      return Promise.resolve();
    },
  };
}

export function makeFetchResponse({ ok = true, status = 200, json, body } = {}) {
  return {
    ok,
    status,
    json: async () => json,
    body,
  };
}
