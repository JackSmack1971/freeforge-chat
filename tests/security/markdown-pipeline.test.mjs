import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const ESC_IMPL = "const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\\\"/g, '&quot;');";

async function loadMarkdownModule({ parseImpl, sanitizeImpl, markedAvailable = true } = {}) {
  const filePath = path.resolve('freeforge/src/markdown.js');
  const source = await readFile(filePath, 'utf8');
  const transformed = source.replace("import { esc } from './state.js';", ESC_IMPL);

  if (markedAvailable) {
    globalThis.marked = {
      useCalls: [],
      parseCalls: [],
      use(options) {
        this.useCalls.push(options);
      },
      parse(text) {
        this.parseCalls.push(text);
        if (parseImpl) return parseImpl(text);
        return `<p>${text}</p>`;
      },
    };
  } else {
    globalThis.marked = undefined;
  }

  if (sanitizeImpl) {
    globalThis.DOMPurify = {
      calls: [],
      addHook() {},
      sanitize(raw, config) {
        this.calls.push({ raw, config });
        return sanitizeImpl(raw, config);
      },
    };
  } else {
    globalThis.DOMPurify = undefined;
  }

  globalThis.document = {
    createElement() {
      return {
        innerHTML: '',
        querySelectorAll() {
          return [];
        },
      };
    },
  };

  const specifier = `data:text/javascript;base64,${Buffer.from(transformed).toString('base64')}#${Math.random()}`;
  return import(specifier);
}

test('renderMd parses markdown before sanitizing the resulting HTML', async () => {
  const { renderMd } = await loadMarkdownModule({
    parseImpl: text => `<p data-from="marked">${text.toUpperCase()}</p>`,
    sanitizeImpl: raw => `clean:${raw}`,
  });

  const output = renderMd('hello');

  assert.equal(output, 'clean:<p data-from="marked">HELLO</p>');
  assert.deepEqual(globalThis.marked.parseCalls, ['hello']);
  assert.equal(globalThis.DOMPurify.calls.length, 1);
  assert.equal(globalThis.DOMPurify.calls[0].raw, '<p data-from="marked">HELLO</p>');
});

test('renderMd passes the hardened purifier config into DOMPurify', async () => {
  const { renderMd } = await loadMarkdownModule({
    parseImpl: () => '<a href="https://example.com" onclick="evil()">link</a>',
    sanitizeImpl: raw => raw,
  });

  renderMd('link');

  const [{ config }] = globalThis.DOMPurify.calls;
  assert.deepEqual(config.ALLOWED_ATTR, ['href', 'title', 'class']);
  assert.ok(config.ALLOWED_TAGS.includes('a'));
  assert.ok(config.ALLOWED_TAGS.includes('code'));
  assert.equal(config.ALLOWED_URI_REGEXP.toString(), '/^(?:https?|mailto):/i');
  assert.ok(config.FORBID_ATTR.includes('onclick'));
  assert.equal(config.FORCE_BODY, true);
});

test('renderMd strips javascript hrefs while keeping safe links', async () => {
  const { renderMd } = await loadMarkdownModule({
    parseImpl: () => '<a href="javascript:alert(1)">bad</a><a href="https://example.com">ok</a><a href="mailto:test@example.com">mail</a>',
    sanitizeImpl: (raw, config) => raw.replace(/href="javascript:[^"]*"/g, ''),
  });

  const output = renderMd('link');

  assert.doesNotMatch(output, /javascript:alert\(1\)/);
  assert.match(output, /href="https:\/\/example\.com"/);
  assert.match(output, /href="mailto:test@example\.com"/);
});

test('renderMd falls back to escaped plaintext when DOMPurify is unavailable', async () => {
  const { renderMd } = await loadMarkdownModule({
    parseImpl: () => '<img src=x onerror=alert(1)>',
  });

  const output = renderMd('<img src=x onerror=alert(1)>\nnext');

  assert.equal(output, '&lt;img src=x onerror=alert(1)&gt;<br>next');
});

test('renderMd falls back to escaped plaintext when marked.parse throws', async () => {
  const { renderMd } = await loadMarkdownModule({
    parseImpl: () => {
      throw new Error('parse failure');
    },
    sanitizeImpl: () => 'should-not-run',
  });

  const output = renderMd('<b>unsafe</b>');

  assert.equal(output, '&lt;b&gt;unsafe&lt;/b&gt;');
  assert.equal(globalThis.DOMPurify.calls.length, 0);
});

test('markdown.js module initializes without throwing when marked CDN is unavailable', async () => {
  await assert.doesNotReject(
    () => loadMarkdownModule({ markedAvailable: false }),
    'markdown.js must not throw ReferenceError when marked is undefined',
  );
});

test('renderMd returns escaped plaintext when marked CDN is unavailable', async () => {
  const { renderMd } = await loadMarkdownModule({ markedAvailable: false });

  const output = renderMd('<b>hello</b>\nworld');

  assert.equal(output, '&lt;b&gt;hello&lt;/b&gt;<br>world');
});
