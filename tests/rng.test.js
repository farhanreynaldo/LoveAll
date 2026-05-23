import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRng, pickOne } from '../src/rng.js';

test('createRng returns same sequence for same seed', () => {
  const a = createRng(42);
  const b = createRng(42);
  const seqA = [a(), a(), a(), a(), a()];
  const seqB = [b(), b(), b(), b(), b()];
  assert.deepEqual(seqA, seqB);
});

test('createRng returns different sequence for different seed', () => {
  const a = createRng(1);
  const b = createRng(2);
  assert.notEqual(a(), b());
});

test('createRng returns values in [0, 1)', () => {
  const r = createRng(7);
  for (let i = 0; i < 1000; i++) {
    const v = r();
    assert.ok(v >= 0 && v < 1, `value ${v} out of range`);
  }
});

test('pickOne returns one element from array using rng', () => {
  const r = createRng(123);
  const arr = ['a', 'b', 'c', 'd'];
  const picked = pickOne(arr, r);
  assert.ok(arr.includes(picked));
});
