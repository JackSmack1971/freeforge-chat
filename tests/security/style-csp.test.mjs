import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

async function read(relPath) {
  return readFile(path.resolve(relPath), 'utf8');
}

test('style-src is restricted to self-hosted stylesheets', async () => {
  const netlify = await read('netlify.toml');

  assert.match(netlify, /style-src 'self'/);
  assert.doesNotMatch(netlify, /style-src [^"]*'unsafe-inline'/);
  assert.doesNotMatch(netlify, /style-src [^"]*cdn\.jsdelivr\.net/);
});

test('index.html uses a local Tailwind stylesheet', async () => {
  const html = await read('freeforge/index.html');

  assert.match(html, /<link rel="stylesheet" href="styles\/tailwind\.min\.css">/);
  assert.doesNotMatch(html, /https:\/\/cdn\.jsdelivr\.net\/npm\/tailwindcss/);
});

test('tracked UI files avoid inline style attributes and cssText sinks', async () => {
  const files = [
    'freeforge/index.html',
    'freeforge/src/ui/messages.js',
    'freeforge/src/ui/toast.js',
  ];

  for (const relPath of files) {
    const source = await read(relPath);
    assert.doesNotMatch(source, /style=/, `${relPath} should not contain inline style attributes`);
    assert.doesNotMatch(source, /\.style\.cssText/, `${relPath} should not assign cssText`);
    assert.doesNotMatch(source, /setAttribute\((['"])style\1/, `${relPath} should not set style attributes directly`);
  }
});
