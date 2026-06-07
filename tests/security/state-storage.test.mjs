import assert from 'node:assert/strict';
import test from 'node:test';

import { clearStoredKey, getStoredKey, setStoredKey } from '../../freeforge/src/state.js';

class MemoryStorage {
  constructor(seed = {}) {
    this.map = new Map(Object.entries(seed));
  }

  getItem(key) {
    return this.map.has(key) ? this.map.get(key) : null;
  }

  setItem(key, value) {
    this.map.set(key, String(value));
  }

  removeItem(key) {
    this.map.delete(key);
  }
}

function installStorage({ local = {}, session = {} } = {}) {
  globalThis.localStorage = new MemoryStorage(local);
  globalThis.sessionStorage = new MemoryStorage(session);
}

test('getStoredKey prefers sessionStorage when present', () => {
  installStorage({
    local: { ff_key: 'local-key' },
    session: { ff_key: 'session-key' },
  });

  assert.equal(getStoredKey(), 'session-key');
  assert.equal(globalThis.localStorage.getItem('ff_key'), 'local-key');
});

test('getStoredKey migrates a legacy localStorage key into sessionStorage', () => {
  installStorage({
    local: { ff_key: 'legacy-key' },
  });

  assert.equal(getStoredKey(), 'legacy-key');
  assert.equal(globalThis.sessionStorage.getItem('ff_key'), 'legacy-key');
  assert.equal(globalThis.localStorage.getItem('ff_key'), null);
});

test('setStoredKey writes only to sessionStorage and removes any persistent copy', () => {
  installStorage({
    local: { ff_key: 'stale-key' },
  });

  setStoredKey('fresh-key');

  assert.equal(globalThis.sessionStorage.getItem('ff_key'), 'fresh-key');
  assert.equal(globalThis.localStorage.getItem('ff_key'), null);
});

test('clearStoredKey removes the key from both storage backends', () => {
  installStorage({
    local: { ff_key: 'local-key' },
    session: { ff_key: 'session-key' },
  });

  clearStoredKey();

  assert.equal(globalThis.sessionStorage.getItem('ff_key'), null);
  assert.equal(globalThis.localStorage.getItem('ff_key'), null);
});
