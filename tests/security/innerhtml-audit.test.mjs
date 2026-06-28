import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

async function read(relPath) {
  return readFile(path.resolve(relPath), 'utf8');
}

async function collectFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(entries.map(async entry => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return collectFiles(fullPath);
    return [fullPath];
  }));
  return files.flat();
}

test('messages.js renders user-authored content with text nodes and limits HTML sinks to sanitized markdown', async () => {
  const source = await read('freeforge/src/ui/messages.js');

  assert.match(source, /list\.innerHTML = '';/);
  assert.doesNotMatch(source, /wrap\.innerHTML\s*=/);
  assert.match(source, /bubble\.textContent = msg\.content;/);
  assert.match(source, /badge\.textContent = msg\.content;/);
  assert.match(source, /content\.textContent = msg\.content;/);
  assert.match(source, /content\.innerHTML = renderMd\(msg\.content\);/);
  assert.match(source, /setButtonContent\(copyBtn, 'M5 13l4 4L19 7', 'Copied!'\);/);
  assert.match(source, /setButtonContent\(copyBtn, 'M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z', 'Copy'\);/);
});

test('toast.js escapes toast messages and uses data-action for buttons, not inline onclick', async () => {
  const source = await read('freeforge/src/ui/toast.js');

  // Message content is always HTML-escaped — no raw insertion
  assert.match(source, /esc\(msg\)/);
  // The safeAction bypass that allowed onclick through unescaped is gone
  assert.doesNotMatch(source, /safeAction/);
  // Action buttons use data-action attribute, not inline onclick handlers
  assert.match(source, /btn\.dataset\.action/);
  assert.doesNotMatch(source, /onclick/);
});

test('models.js limits innerHTML to static placeholders and uses textContent for model labels', async () => {
  const source = await read('freeforge/src/features/models.js');

  assert.match(source, /sel\.innerHTML = '';/);
  assert.match(source, /sel\.innerHTML = '<option value="">Loading models…<\/option>';/);
  assert.match(source, /sel\.innerHTML = '<option value="">No free models found<\/option>';/);
  assert.match(source, /sel\.innerHTML = '<option value="">Failed to load models<\/option>';/);
  assert.match(source, /sel\.innerHTML = '<option value="">No free models<\/option>';/);
  assert.match(source, /opt\.textContent = \(m\.name \|\| m\.id\) \+ ctx;/);
});

test('repository contains no document.write calls', async () => {
  const files = await collectFiles(path.resolve('.'));
  const textFiles = files.filter(file => /\.(html|js|mjs|cjs|ts|tsx|jsx)$/i.test(file));
  const offenders = [];
  const selfPath = path.resolve('tests/security/innerhtml-audit.test.mjs');

  for (const file of textFiles) {
    if (path.resolve(file) === selfPath) continue;
    const source = await readFile(file, 'utf8');
    if (source.includes('document.write')) offenders.push(path.relative(path.resolve('.'), file));
  }

  assert.deepEqual(offenders, []);
});
