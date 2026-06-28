/**
 * Regression tests for api.js error handling paths.
 * Uses static source inspection to avoid DOM dependency in the test runner.
 * Each test asserts that the relevant branch exists with the expected message,
 * catching regressions where error handlers are removed or silenced.
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

async function read(relPath) {
  return readFile(path.resolve(relPath), 'utf8');
}

// ── fetchFreeModels error branches ──────────────────────────────────────────

test('fetchFreeModels throws on HTTP 401 with "Invalid API key"', async () => {
  const src = await read('freeforge/src/api.js');
  assert.match(src, /res\.status === 401[\s\S]*?throw new Error\('Invalid API key'\)/);
});

test('fetchFreeModels throws on HTTP 429 with rate-limit message', async () => {
  const src = await read('freeforge/src/api.js');
  assert.match(src, /res\.status === 429[\s\S]*?throw new Error\('Rate limited/);
});

test('fetchFreeModels throws on other non-ok status with status code in message', async () => {
  const src = await read('freeforge/src/api.js');
  assert.match(src, /throw new Error\(`Failed to fetch models \(\$\{res\.status\}\)`\)/);
});

// ── streamCompletion pre-connection error branches ───────────────────────────

test('streamCompletion calls onDone on AbortError before connection is established', async () => {
  const src = await read('freeforge/src/api.js');
  assert.match(src, /e\.name === 'AbortError'[\s\S]*?return onDone\('\{\}', ''\)/);
});

test('streamCompletion calls onError with network message on non-abort pre-connection failure', async () => {
  const src = await read('freeforge/src/api.js');
  assert.match(src, /onError\('Network error — check your connection\.'\)/);
});

// ── streamCompletion HTTP error branches ─────────────────────────────────────

test('streamCompletion calls showInvalidBanner and onError on HTTP 401', async () => {
  const src = await read('freeforge/src/api.js');
  assert.match(src, /res\.status === 401[\s\S]*?showInvalidBanner\(\)[\s\S]*?onError\('Invalid API key/);
});

test('streamCompletion calls onError on HTTP 429 with rate-limit message', async () => {
  const src = await read('freeforge/src/api.js');
  assert.match(src, /res\.status === 429[\s\S]*?onError\('Rate limited — try again in a moment\.'\)/);
});

test('streamCompletion calls onError on HTTP 400 with bad-request prefix', async () => {
  const src = await read('freeforge/src/api.js');
  assert.match(src, /res\.status === 400[\s\S]*?onError\(`Bad request:/);
});

test('streamCompletion calls onError on HTTP 413 with context-too-long message', async () => {
  const src = await read('freeforge/src/api.js');
  assert.match(src, /res\.status === 413[\s\S]*?onError\('Context too long — start a new chat\.'\)/);
});

// ── streamCompletion mid-stream abort ────────────────────────────────────────

test('streamCompletion calls onDone with accumulated content on mid-stream AbortError', async () => {
  const src = await read('freeforge/src/api.js');
  assert.match(src, /e\.name === 'AbortError'[\s\S]*?return onDone\(donePayload, full\)/);
});

test('streamCompletion calls onError on non-abort mid-stream error', async () => {
  const src = await read('freeforge/src/api.js');
  assert.match(src, /onError\('Stream interrupted\.'\)/);
});
