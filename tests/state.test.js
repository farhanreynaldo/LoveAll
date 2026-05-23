import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createSession,
  applyScore,
  recomputeFromCompleted,
  addPlayer,
  removePlayer,
} from '../src/state.js';

const PLAYERS = [
  { id: 'a', name: 'Aldo', seedSkill: 3 },
  { id: 'b', name: 'Maya', seedSkill: 3 },
  { id: 'c', name: 'Jin', seedSkill: 3 },
  { id: 'd', name: 'Sam', seedSkill: 3 },
  { id: 'e', name: 'Lee', seedSkill: 3 },
  { id: 'f', name: 'Priya', seedSkill: 3 },
];

test('createSession initializes players, schedule, weights, rng seed', () => {
  const s = createSession({ players: PLAYERS, targetRounds: 8, seed: 42 });
  assert.equal(s.players.length, 6);
  assert.equal(s.schedule.length, 8);
  for (const r of s.schedule) assert.equal(r.status, 'tentative');
  assert.equal(s.weights.rest, 1000);
  assert.equal(s.seed, 42);
  for (const p of PLAYERS) {
    assert.equal(s.elo[p.id], 1500);  // seedSkill: 3 (High) maps to 1500
    assert.equal(s.roundsPlayed[p.id], 0);
  }
});

test('applyScore marks round completed and updates wins/losses/games/Elo/counts', () => {
  const s0 = createSession({ players: PLAYERS, targetRounds: 5, seed: 1 });
  const s1 = applyScore(s0, 0, 6, 3);
  const r = s1.schedule[0];
  assert.equal(r.status, 'completed');
  assert.deepEqual(r.score, [6, 3]);
  for (const id of r.teamA) {
    assert.equal(s1.wins[id], 1);
    assert.equal(s1.gamesFor[id], 6);
    assert.equal(s1.gamesAgainst[id], 3);
  }
  for (const id of r.teamB) {
    assert.equal(s1.losses[id], 1);
    assert.equal(s1.gamesFor[id], 3);
    assert.equal(s1.gamesAgainst[id], 6);
  }
  for (const id of [...r.teamA, ...r.teamB]) {
    assert.equal(s1.roundsPlayed[id], 1);
  }
  assert.ok(s1.elo[r.teamA[0]] > 1300);
});

test('recomputeFromCompleted rebuilds derived state from scratch', () => {
  let s = createSession({ players: PLAYERS, targetRounds: 4, seed: 1 });
  s = applyScore(s, 0, 6, 4);
  s = applyScore(s, 1, 3, 6);
  const fresh = recomputeFromCompleted(s);
  assert.deepEqual(fresh.wins, s.wins);
  assert.deepEqual(fresh.elo, s.elo);
  assert.deepEqual(fresh.roundsPlayed, s.roundsPlayed);
});

test('addPlayer extends roster and zeroes their counts', () => {
  const s = createSession({ players: PLAYERS, targetRounds: 4, seed: 1 });
  const next = addPlayer(s, { id: 'g', name: 'Kai', seedSkill: 2 });  // Mid skill level
  assert.equal(next.players.length, 7);
  assert.equal(next.elo.g, 1300);  // seedSkill: 2 (Mid) maps to 1300
  assert.equal(next.roundsPlayed.g, 0);
  assert.equal(next.partnerCounts.a.g, 0);
});

test('removePlayer drops them from state and all counts', () => {
  const s = createSession({ players: PLAYERS, targetRounds: 4, seed: 1 });
  const next = removePlayer(s, 'f');
  assert.equal(next.players.length, 5);
  assert.equal(next.elo.f, undefined);
  assert.equal(next.partnerCounts.a.f, undefined);
});

test('createSession defaults to 30 rounds when targetRounds is omitted', () => {
  const s = createSession({ players: PLAYERS, seed: 1 });
  assert.equal(s.schedule.length, 30);
  for (const r of s.schedule) assert.equal(r.status, 'tentative');
});
