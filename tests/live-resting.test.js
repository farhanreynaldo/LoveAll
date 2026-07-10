import { test } from 'node:test';
import assert from 'node:assert/strict';
import { restingLabel } from '../src/ui/live.js';

test('restingLabel omits the streak when it is 0', () => {
  assert.equal(restingLabel('Sam', 0), 'Sam');
});

test('restingLabel shows the streak when it is 1 or more', () => {
  assert.equal(restingLabel('Sam', 1), 'Sam · sat out 1');
  assert.equal(restingLabel('Sam', 2), 'Sam · sat out 2');
});
