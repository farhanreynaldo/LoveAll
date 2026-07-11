import { test } from 'node:test';
import assert from 'node:assert/strict';

function makeMemoryStorage() {
  const store = new Map();
  return {
    getItem: k => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: k => store.delete(k),
  };
}

test('getOrganizerToken creates a token once and reuses it thereafter', async () => {
  globalThis.localStorage = makeMemoryStorage();
  if (!globalThis.crypto) {
    globalThis.crypto = (await import('node:crypto')).webcrypto;
  }
  const { getOrganizerToken } = await import('../src/persistence.js?t=' + Date.now());

  const first = getOrganizerToken();
  const second = getOrganizerToken();
  assert.equal(first, second);
  assert.match(first, /^[0-9a-f-]{36}$/);
});
