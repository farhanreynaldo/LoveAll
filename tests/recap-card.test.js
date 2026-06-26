import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildStandings, formatDiff } from '../src/recap-card.js';

function session(overrides = {}) {
  const players = overrides.players ?? [
    { id: 'a', name: 'Priya' },
    { id: 'b', name: 'Maya' },
    { id: 'c', name: 'Jin' },
    { id: 'd', name: 'Aldo' },
  ];
  return {
    players,
    wins:        { a: 5, b: 4, c: 3, d: 3 },
    losses:      { a: 1, b: 2, c: 2, d: 3 },
    gamesFor:    { a: 30, b: 26, c: 22, d: 20 },
    gamesAgainst:{ a: 16, b: 20, c: 19, d: 19 },
    ...overrides.maps,
  };
}

test('formatDiff signs positive, negative (U+2212), and zero', () => {
  assert.equal(formatDiff(7), '+7');
  assert.equal(formatDiff(-5), '−5');
  assert.equal(formatDiff(0), '0');
});

test('buildStandings ranks by wins then game differential', () => {
  const { ranked } = buildStandings(session());
  assert.deepEqual(ranked.map(e => e.id), ['a', 'b', 'c', 'd']); // c beats d on diff (+3 vs +1)
  assert.equal(ranked[0].gameDiff, 14);
  assert.equal(ranked[3].gameDiff, 1);
});

test('buildStandings splits podium (top 3) from the rest', () => {
  const { podium, rest } = buildStandings(session());
  assert.equal(podium.length, 3);
  assert.deepEqual(rest.map(e => e.id), ['d']);
});

test('buildStandings podium degrades for groups under 3', () => {
  const two = session({
    players: [{ id: 'a', name: 'Priya' }, { id: 'b', name: 'Maya' }],
    maps: { wins: { a: 2, b: 1 }, losses: { a: 0, b: 1 }, gamesFor: { a: 12, b: 8 }, gamesAgainst: { a: 8, b: 12 } },
  });
  const { podium, rest } = buildStandings(two);
  assert.equal(podium.length, 2);
  assert.equal(rest.length, 0);
});
