import assert from 'node:assert/strict';
import test from 'node:test';

import { importFresh, installGlobals, MemoryStorage, makeBaseDom, makeClipboard } from '../helpers/mock-dom.mjs';

function makeSseBody(chunks) {
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(new TextEncoder().encode(chunk));
      controller.close();
    },
  });
}

test('state.js covers storage helpers, migration, error log, and formatting', async () => {
  const restore = installGlobals({
    localStorage: new MemoryStorage({ ff_key: 'legacy-key', good: '"value"', bad: '{' }),
    sessionStorage: new MemoryStorage({ ff_key: 'session-key' }),
  });
  try {
    const state = await importFresh('freeforge/src/state.js');

    assert.deepEqual(state.LS.get('good'), 'value');
    assert.equal(state.LS.get('missing'), null);
    assert.equal(state.LS.get('bad'), null);

    assert.equal(state.LS.set('answer', { n: 42 }), true);
    assert.deepEqual(globalThis.localStorage.getItem('answer'), '{"n":42}');

    globalThis.localStorage = new MemoryStorage({}, { throwOnSet: true });
    assert.equal(state.LS.set('blocked', 1), false);

    globalThis.localStorage = new MemoryStorage({}, { throwOnRemove: true });
    state.LS.del('answer');

    globalThis.sessionStorage = new MemoryStorage({ ff_key: 'session-key' });
    globalThis.localStorage = new MemoryStorage({ ff_key: 'legacy-key' });
    assert.equal(state.getStoredKey(), 'session-key');

    globalThis.sessionStorage = new MemoryStorage();
    globalThis.localStorage = new MemoryStorage({ ff_key: 'legacy-key' });
    assert.equal(state.getStoredKey(), 'legacy-key');
    assert.equal(globalThis.sessionStorage.getItem('ff_key'), 'legacy-key');
    assert.equal(globalThis.localStorage.getItem('ff_key'), null);

    globalThis.sessionStorage = new MemoryStorage();
    globalThis.localStorage = new MemoryStorage();
    assert.equal(state.getStoredKey(), null);

    globalThis.sessionStorage = new MemoryStorage({}, { throwOnGet: true });
    globalThis.localStorage = new MemoryStorage({}, { throwOnGet: true });
    assert.equal(state.getStoredKey(), null);

    globalThis.sessionStorage = new MemoryStorage({}, { throwOnSet: true, throwOnRemove: true });
    globalThis.localStorage = new MemoryStorage({}, { throwOnRemove: true });
    state.setStoredKey('fresh-key');
    state.clearStoredKey();
  } finally {
    restore();
  }
});

test('state.js records bounded errors and formats keys and context counts', async () => {
  const restore = installGlobals({
    localStorage: new MemoryStorage(),
    sessionStorage: new MemoryStorage(),
  });
  try {
    const state = await importFresh('freeforge/src/state.js');

    assert.notEqual(state.uid(), state.uid());
    assert.equal(state.maskKey(null), '••••••••');
    assert.equal(state.maskKey('short'), '••••••••');
    assert.equal(state.maskKey('sk-or-v1-abcdefgh1234'), 'sk-or-••••••••••••1234');

    assert.equal(state.fmtCtx(0), '');
    assert.equal(state.fmtCtx(999), '999 ctx');
    assert.equal(state.fmtCtx(1500), '2k ctx');
    assert.equal(state.fmtCtx(1_200_000), '1M ctx');

    state.recordError({ type: 'error', msg: 'first' });
    for (let i = 0; i < 50; i += 1) state.recordError({ type: 'error', msg: `m${i}` });

    const log = state.getErrorLog();
    assert.equal(log.length, 50);
    assert.equal(log[0].msg, 'm0');
    assert.equal(log.at(-1).msg, 'm49');

    log.pop();
    assert.equal(state.getErrorLog().length, 50);
  } finally {
    restore();
  }
});

test('api.js fetches, filters, and sorts free models', async () => {
  const restore = installGlobals({
    document: makeBaseDom(),
    window: {},
    navigator: { clipboard: makeClipboard() },
  });
  const calls = [];
  globalThis.fetch = async (url, opts) => {
    calls.push({ url, opts });
    return {
      ok: true,
      status: 200,
      json: async () => ({
        data: [
          { id: 'paid', name: 'Paid', pricing: { prompt: '0.1', completion: '0' } },
          { id: 'z-free', name: 'Zulu', pricing: { prompt: '0', completion: '0' } },
          { id: 'alpha:free', name: 'Alpha', pricing: { prompt: '1', completion: '1' } },
          { id: 'skip', name: 'Skip', pricing: { prompt: '1', completion: '1' } },
        ],
      }),
    };
  };
  try {
    const { fetchFreeModels } = await importFresh('freeforge/src/api.js');
    const models = await fetchFreeModels('abc123');
    assert.equal(calls[0].url, 'https://openrouter.ai/api/v1/models');
    assert.equal(calls[0].opts.headers.Authorization, 'Bearer abc123');
    assert.deepEqual(models.map(m => m.id), ['alpha:free', 'z-free']);

    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({ data: [] }),
    });
    assert.deepEqual(await fetchFreeModels('empty'), []);

    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({}),
    });
    assert.deepEqual(await fetchFreeModels('missing-data'), []);

    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        data: [
          { name: 'A No Id', pricing: { prompt: '0', completion: '0' } },
          { id: 'z:free', pricing: null },
          { id: 'prompt-fail', pricing: { prompt: '1', completion: '0' } },
          { id: 'completion-fail', pricing: { prompt: '0', completion: '1' } },
          { name: 'Missing Pricing', pricing: null },
          { id: 'priced', name: 'Priced', pricing: { prompt: '1', completion: '1' } },
        ],
      }),
    });
    assert.deepEqual((await fetchFreeModels('edge')).map(m => m.name || m.id), ['A No Id', 'z:free']);

    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        data: [
          { id: 'b', pricing: { prompt: '0', completion: '0' } },
          { id: 'a', pricing: { prompt: '0', completion: '0' } },
        ],
      }),
    });
    assert.deepEqual((await fetchFreeModels('sort')).map(m => m.id), ['a', 'b']);

    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        data: [
          { id: 'prompt-missing', pricing: { completion: '0' } },
          { id: 'completion-missing', pricing: { prompt: '0' } },
        ],
      }),
    });
    assert.deepEqual((await fetchFreeModels('missing-fields')).map(m => m.id), []);
  } finally {
    restore();
  }
});

for (const [status, message, pattern] of [
  [401, 'Invalid API key', /Invalid API key/],
  [429, 'Rate limited', /Rate limited/],
  [500, 'Oops', /Failed to fetch models \(500\)/],
]) {
  test(`api.js reports HTTP ${status} errors from fetchFreeModels`, async () => {
    const restore = installGlobals({
      document: makeBaseDom(),
      window: {},
      navigator: { clipboard: makeClipboard() },
    });
    globalThis.fetch = async () => ({
      ok: false,
      status,
      json: async () => ({ error: { message } }),
    });
    try {
      const { fetchFreeModels } = await importFresh('freeforge/src/api.js');
      await assert.rejects(fetchFreeModels('key'), pattern);
    } finally {
      restore();
    }
  });
}

test('api.js falls back to the status-based message when error JSON parsing fails', async () => {
  const restore = installGlobals({
    document: makeBaseDom(),
    window: {},
    navigator: { clipboard: makeClipboard() },
  });
  globalThis.fetch = async () => ({
    ok: false,
    status: 400,
    json: async () => {
      throw new Error('bad json');
    },
  });
  try {
    const { fetchFreeModels } = await importFresh('freeforge/src/api.js');
    await assert.rejects(fetchFreeModels('key'), /Failed to fetch models \(400\)/);
  } finally {
    restore();
  }
});

test('api.js falls back to the status-based message when error JSON omits a message', async () => {
  const restore = installGlobals({
    document: makeBaseDom(),
    window: {},
    navigator: { clipboard: makeClipboard() },
  });
  globalThis.fetch = async () => ({
    ok: false,
    status: 400,
    json: async () => ({ error: {} }),
  });
  try {
    const { streamCompletion } = await importFresh('freeforge/src/api.js');
    let errMsg = '';
    await streamCompletion([], 'model', 'key', {
      signal: new AbortController().signal,
      onToken() {},
      onDone() {},
      onError(msg) {
        errMsg = msg;
      },
    });
    assert.equal(errMsg, 'Bad request: Request failed (400)');
  } finally {
    restore();
  }
});

test('api.js streams SSE content, uses usage totals, and ignores malformed lines', async () => {
  const restore = installGlobals({
    document: makeBaseDom(),
    window: {},
    navigator: { clipboard: makeClipboard() },
  });
  const chunks = [
    'data: {"choices":[{"delta":{"content":"Hel"}}]}\n',
    '\n',
    'data: {"usage":{"total_tokens":12}}\n',
    'data: not-json\n',
    'data: {"choices":[{"delta":{"content":"lo"}}]}\n',
    '\n',
    'data: [DONE]\n',
  ];
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    body: makeSseBody(chunks),
  });
  try {
    const { streamCompletion } = await importFresh('freeforge/src/api.js');
    const tokens = [];
    let doneArgs = null;
    let err = null;
    await streamCompletion(
      [{ role: 'user', content: 'hi' }],
      'model',
      'key',
      {
        signal: new AbortController().signal,
        onToken(delta, full) {
          tokens.push([delta, full]);
        },
        onDone(rawPayload, full) {
          doneArgs = { rawPayload, full };
        },
        onError(msg) {
          err = msg;
        },
      }
    );

    assert.deepEqual(tokens, [['Hel', 'Hel'], ['lo', 'Hello']]);
    assert.equal(doneArgs.full, 'Hello');
    assert.match(doneArgs.rawPayload, /"usage":\{"total_tokens":12\}/);
    assert.equal(err, null);
  } finally {
    restore();
  }
});

test('api.js keeps running when stream cancel also fails after a read error', async () => {
  const restore = installGlobals({
    document: makeBaseDom(),
    window: {},
    navigator: { clipboard: makeClipboard() },
  });
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    body: {
      getReader() {
        return {
          async read() {
            throw new Error('socket closed');
          },
          cancel() {
            throw new Error('cancel failed');
          },
        };
      },
    },
  });
  try {
    const { streamCompletion } = await importFresh('freeforge/src/api.js');
    let errMsg = '';
    await streamCompletion([], 'model', 'key', {
      signal: new AbortController().signal,
      onToken() {},
      onDone() {
        throw new Error('unexpected done');
      },
      onError(msg) {
        errMsg = msg;
      },
    });
    assert.equal(errMsg, 'Stream interrupted.');
  } finally {
    restore();
  }
});

test('api.js returns accumulated content when the stream aborts mid-read', async () => {
  const restore = installGlobals({
    document: makeBaseDom(),
    window: {},
    navigator: { clipboard: makeClipboard() },
  });
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    body: {
      getReader() {
        let step = 0;
        return {
          async read() {
            if (step++ === 0) return { done: false, value: new TextEncoder().encode('data: {"choices":[{"delta":{"content":"Hi"}}]}\n\n') };
            const err = new Error('aborted');
            err.name = 'AbortError';
            throw err;
          },
          cancel() {
            return Promise.resolve();
          },
        };
      },
    },
  });
  try {
    const { streamCompletion } = await importFresh('freeforge/src/api.js');
    let doneArgs = null;
    await streamCompletion([], 'model', 'key', {
      signal: new AbortController().signal,
      onToken() {},
      onDone(rawPayload, full) {
        doneArgs = { rawPayload, full };
      },
      onError() {
        throw new Error('unexpected error');
      },
    });

    assert.deepEqual(doneArgs, { rawPayload: '{}', full: 'Hi' });
  } finally {
    restore();
  }
});

test('api.js maps pre-connection AbortError and network failures correctly', async () => {
  const restore = installGlobals({
    document: makeBaseDom(),
    window: {},
    navigator: { clipboard: makeClipboard() },
  });
  try {
    const { streamCompletion } = await importFresh('freeforge/src/api.js');

    globalThis.fetch = async () => {
      const err = new Error('aborted');
      err.name = 'AbortError';
      throw err;
    };
    let doneArgs = null;
    await streamCompletion([], 'model', 'key', {
      signal: new AbortController().signal,
      onToken() {},
      onDone(rawPayload, full) {
        doneArgs = { rawPayload, full };
      },
      onError() {
        throw new Error('unexpected error');
      },
    });
    assert.deepEqual(doneArgs, { rawPayload: '{}', full: '' });

    globalThis.fetch = async () => {
      throw new Error('offline');
    };
    let errMsg = '';
    await streamCompletion([], 'model', 'key', {
      signal: new AbortController().signal,
      onToken() {},
      onDone() {
        throw new Error('unexpected done');
      },
      onError(msg) {
        errMsg = msg;
      },
    });
    assert.equal(errMsg, 'Network error — check your connection.');
  } finally {
    restore();
  }
});

test('api.js maps generic streamCompletion HTTP failures to the fallback error path', async () => {
  const restore = installGlobals({
    document: makeBaseDom(),
    window: {},
    navigator: { clipboard: makeClipboard() },
  });
  globalThis.fetch = async () => ({
    ok: false,
    status: 500,
    json: async () => ({ error: { message: 'boom' } }),
  });
  try {
    const { streamCompletion } = await importFresh('freeforge/src/api.js');
    let errMsg = '';
    await streamCompletion([], 'model', 'key', {
      signal: new AbortController().signal,
      onToken() {},
      onDone() {
        throw new Error('unexpected done');
      },
      onError(msg) {
        errMsg = msg;
      },
    });
    assert.equal(errMsg, 'boom');
  } finally {
    restore();
  }
});

test('api.js falls back to the status-based message when streamCompletion error JSON omits a message', async () => {
  const restore = installGlobals({
    document: makeBaseDom(),
    window: {},
    navigator: { clipboard: makeClipboard() },
  });
  globalThis.fetch = async () => ({
    ok: false,
    status: 413,
    json: async () => ({ error: {} }),
  });
  try {
    const { streamCompletion } = await importFresh('freeforge/src/api.js');
    let errMsg = '';
    await streamCompletion([], 'model', 'key', {
      signal: new AbortController().signal,
      onToken() {},
      onDone() {},
      onError(msg) {
        errMsg = msg;
      },
    });
    assert.equal(errMsg, 'Context too long — start a new chat.');
  } finally {
    restore();
  }
});

test('api.js falls back to the status-based message when streamCompletion error JSON has an empty message', async () => {
  const restore = installGlobals({
    document: makeBaseDom(),
    window: {},
    navigator: { clipboard: makeClipboard() },
  });
  globalThis.fetch = async () => ({
    ok: false,
    status: 400,
    json: async () => ({ error: { message: '' } }),
  });
  try {
    const { streamCompletion } = await importFresh('freeforge/src/api.js');
    let errMsg = '';
    await streamCompletion([], 'model', 'key', {
      signal: new AbortController().signal,
      onToken() {},
      onDone() {},
      onError(msg) {
        errMsg = msg;
      },
    });
    assert.equal(errMsg, 'Bad request: Request failed (400)');
  } finally {
    restore();
  }
});

test('api.js falls back to the status-based message when streamCompletion error JSON parsing fails', async () => {
  const restore = installGlobals({
    document: makeBaseDom(),
    window: {},
    navigator: { clipboard: makeClipboard() },
  });
  globalThis.fetch = async () => ({
    ok: false,
    status: 400,
    json: async () => {
      throw new Error('bad json');
    },
  });
  try {
    const { streamCompletion } = await importFresh('freeforge/src/api.js');
    let errMsg = '';
    await streamCompletion([], 'model', 'key', {
      signal: new AbortController().signal,
      onToken() {},
      onDone() {},
      onError(msg) {
        errMsg = msg;
      },
    });
    assert.equal(errMsg, 'Bad request: Request failed (400)');
  } finally {
    restore();
  }
});

test('api.js reports streamCompletion 401 and 429 errors even when the body is empty', async () => {
  const restore = installGlobals({
    document: makeBaseDom(),
    window: {},
    navigator: { clipboard: makeClipboard() },
  });
  try {
    const { streamCompletion } = await importFresh('freeforge/src/api.js');
    for (const [status, expected] of [
      [401, 'Invalid API key — update it in Settings.'],
      [429, 'Rate limited — try again in a moment.'],
    ]) {
      globalThis.fetch = async () => ({
        ok: false,
        status,
        json: async () => ({}),
      });
      let errMsg = '';
      await streamCompletion([], 'model', 'key', {
        signal: new AbortController().signal,
        onToken() {},
        onDone() {},
        onError(msg) {
          errMsg = msg;
        },
      });
      assert.equal(errMsg, expected);
    }
  } finally {
    restore();
  }
});
