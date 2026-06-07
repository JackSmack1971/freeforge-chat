import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
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

test('messages.js innerHTML sinks only use escaped, sanitized, or static content', async () => {
  const source = await read('freeforge/src/ui/messages.js');

  assert.match(source, /list\.innerHTML = '';/);
  assert.match(source, /\$\{esc\(msg\.content\)\.replace\(\/\\n\/g, '<br>'\)\}/);
  assert.match(source, /\$\{esc\(msg\.content\)\}/);
  assert.match(source, /msg\.streaming\s*\?[\s\S]*\$\{esc\(msg\.content\)\}[\s\S]*:\s*`<div class="msg-content text-zinc-200 leading-relaxed text-sm">\$\{renderMd\(msg\.content\)\}<\/div>`/);
  assert.match(source, /copyBtn\.innerHTML = `<svg class="w-3 h-3"[\s\S]*Copied!`;/);
  assert.match(source, /copyBtn\.innerHTML = `<svg class="w-3 h-3"[\s\S]*Copy`;/);
});

test('toast.js escapes toast messages before inserting markup', async () => {
  const source = await read('freeforge/src/ui/toast.js');

  assert.match(source, /el\.innerHTML = `[\s\S]*<span>\$\{esc\(msg\)\}<\/span>`;/);
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
  const textFiles = files.filter(file => /\.(html|js|mjs|cjs|ts|tsx|jsx|md|toml)$/i.test(file));
  const offenders = [];
  const selfPath = path.resolve('tests/security/innerhtml-audit.test.mjs');

  for (const file of textFiles) {
    if (path.resolve(file) === selfPath) continue;
    const source = await readFile(file, 'utf8');
    if (source.includes('document.write')) offenders.push(path.relative(path.resolve('.'), file));
  }

  assert.deepEqual(offenders, []);
});
