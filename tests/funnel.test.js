import test from 'node:test';
import assert from 'node:assert/strict';
import { track, readFunnel } from '../src/funnel.js';

test('funnel events are bounded and malformed storage is recoverable', () => {
  const data = new Map();
  globalThis.localStorage = {
    getItem: key => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
  };
  data.set('loveall:funnel', '{bad');
  assert.deepEqual(readFunnel(), []);
  for (let i = 0; i < 205; i++) track('visit');
  assert.equal(readFunnel().length, 200);
  assert.throws(() => track('purchase_complete'), /Unknown funnel event/);
  delete globalThis.localStorage;
});
