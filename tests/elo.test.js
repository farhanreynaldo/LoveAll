import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seedElo, expectedScore, updateElo } from '../src/elo.js';

test('seedElo maps 3 skill levels to Elo ratings', () => {
  assert.equal(seedElo(1), 1100);  // Low
  assert.equal(seedElo(2), 1300);  // Mid
  assert.equal(seedElo(3), 1500);  // High
});

test('expectedScore is 0.5 for equal ratings', () => {
  assert.equal(expectedScore(1300, 1300), 0.5);
});

test('expectedScore favors higher rating', () => {
  const e = expectedScore(1400, 1300);
  assert.ok(e > 0.5 && e < 1);
});

test('updateElo nudges winners up and losers down', () => {
  const ratings = { a1: 1300, a2: 1300, b1: 1300, b2: 1300 };
  const next = updateElo(ratings, ['a1','a2'], ['b1','b2'], 6, 2, 32);
  assert.ok(next.a1 > 1300, 'a1 should rise');
  assert.ok(next.a2 > 1300, 'a2 should rise');
  assert.ok(next.b1 < 1300, 'b1 should drop');
  assert.ok(next.b2 < 1300, 'b2 should drop');
  assert.equal(next.a1, next.a2);
  assert.equal(next.b1, next.b2);
});

test('updateElo is margin-aware: 6-0 moves more than 6-5', () => {
  const r = { a1: 1300, a2: 1300, b1: 1300, b2: 1300 };
  const blowout = updateElo(r, ['a1','a2'], ['b1','b2'], 6, 0, 32);
  const squeaker = updateElo(r, ['a1','a2'], ['b1','b2'], 6, 5, 32);
  assert.ok(blowout.a1 - 1300 > squeaker.a1 - 1300);
});

test('updateElo does not mutate input', () => {
  const r = { a1: 1300, a2: 1300, b1: 1300, b2: 1300 };
  updateElo(r, ['a1','a2'], ['b1','b2'], 6, 2, 32);
  assert.equal(r.a1, 1300);
});

test('updateElo handles 0-0 (skipped/aborted round) gracefully', () => {
  const r = { a1: 1300, a2: 1300, b1: 1300, b2: 1300 };
  const next = updateElo(r, ['a1','a2'], ['b1','b2'], 0, 0, 32);
  assert.deepEqual(next, r);
});
