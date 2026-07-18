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

test('appendLocalHistory records an entry that loadLocalHistory returns, newest first', async () => {
  globalThis.localStorage = makeMemoryStorage();
  const { appendLocalHistory, loadLocalHistory } = await import('../src/persistence.js?t=' + Date.now());

  appendLocalHistory({ id: 'a', completedAt: 1000, standings: [{ name: 'Aldo' }] });
  appendLocalHistory({ id: 'b', completedAt: 2000, standings: [{ name: 'Bo' }] });

  const history = loadLocalHistory();
  assert.equal(history.length, 2);
  assert.equal(history[0].id, 'b'); // most recently appended first
});

test('appendLocalHistory de-dupes by id instead of creating a second row', async () => {
  globalThis.localStorage = makeMemoryStorage();
  const { appendLocalHistory, loadLocalHistory } = await import('../src/persistence.js?t=' + Date.now());

  appendLocalHistory({ id: 'a', completedAt: 1000, standings: [{ name: 'Aldo' }] });
  appendLocalHistory({ id: 'a', completedAt: 1000, standings: [{ name: 'Aldo' }] }); // retry

  assert.equal(loadLocalHistory().length, 1);
});

test('loadLocalHistory returns an empty array when nothing has been saved', async () => {
  globalThis.localStorage = makeMemoryStorage();
  const { loadLocalHistory } = await import('../src/persistence.js?t=' + Date.now());

  assert.deepEqual(loadLocalHistory(), []);
});
