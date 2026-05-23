import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  enumerateCandidates,
  pickBestCandidate,
  simulate,
  generateSchedule,
  reoptimizeFrom,
} from '../src/scheduler.js';
import { createRng } from '../src/rng.js';
import { DEFAULT_WEIGHTS } from '../src/cost.js';

function blankState(ids) {
  const partnerCounts = {};
  const opponentCounts = {};
  const elo = {};
  const roundsPlayed = {};
  for (const id of ids) {
    partnerCounts[id] = {};
    opponentCounts[id] = {};
    elo[id] = 1300;
    roundsPlayed[id] = 0;
    for (const j of ids) if (j !== id) { partnerCounts[id][j] = 0; opponentCounts[id][j] = 0; }
  }
  return { players: ids, partnerCounts, opponentCounts, elo, roundsPlayed };
}

test('enumerateCandidates yields C(n,4)*3 candidates', () => {
  const eight = enumerateCandidates(['a','b','c','d','e','f','g','h']);
  assert.equal(eight.length, 70 * 3);
  const six = enumerateCandidates(['a','b','c','d','e','f']);
  assert.equal(six.length, 15 * 3);
});

test('each candidate has teamA and teamB of 2 distinct players covering 4 unique ids', () => {
  const cs = enumerateCandidates(['a','b','c','d','e','f']);
  for (const c of cs) {
    assert.equal(c.teamA.length, 2);
    assert.equal(c.teamB.length, 2);
    const all = new Set([...c.teamA, ...c.teamB]);
    assert.equal(all.size, 4);
  }
});

test('pickBestCandidate returns lowest-cost candidate', () => {
  const state = blankState(['a','b','c','d','e','f']);
  state.roundsPlayed.a = 5;
  const rng = createRng(1);
  const best = pickBestCandidate(state, DEFAULT_WEIGHTS, rng);
  assert.ok(!best.teamA.includes('a') && !best.teamB.includes('a'),
    'a should be excluded from best candidate due to rest penalty');
});

test('pickBestCandidate uses rng for ties; same seed → same pick', () => {
  const state = blankState(['a','b','c','d','e','f']);
  const r1 = createRng(42);
  const r2 = createRng(42);
  const a = pickBestCandidate(state, DEFAULT_WEIGHTS, r1);
  const b = pickBestCandidate(state, DEFAULT_WEIGHTS, r2);
  assert.deepEqual(a, b);
});

test('simulate advances roundsPlayed and partner/opponent counts', () => {
  const state = blankState(['a','b','c','d','e','f']);
  const candidate = { teamA: ['a','b'], teamB: ['c','d'] };
  const next = simulate(state, candidate);
  assert.equal(next.roundsPlayed.a, 1);
  assert.equal(next.roundsPlayed.e, 0);
  assert.equal(next.partnerCounts.a.b, 1);
  assert.equal(next.partnerCounts.b.a, 1);
  assert.equal(next.opponentCounts.a.c, 1);
  assert.equal(next.opponentCounts.c.a, 1);
});

test('simulate does not mutate input', () => {
  const state = blankState(['a','b','c','d','e','f']);
  const candidate = { teamA: ['a','b'], teamB: ['c','d'] };
  simulate(state, candidate);
  assert.equal(state.roundsPlayed.a, 0);
});

test('generateSchedule produces exactly N rounds', () => {
  const state = blankState(['a','b','c','d','e','f']);
  const rng = createRng(7);
  const sched = generateSchedule(state, 10, DEFAULT_WEIGHTS, rng);
  assert.equal(sched.length, 10);
});

test('generateSchedule distributes rest fairly for 6 players over 9 rounds', () => {
  const state = blankState(['a','b','c','d','e','f']);
  const rng = createRng(99);
  const sched = generateSchedule(state, 9, DEFAULT_WEIGHTS, rng);
  let s = state;
  for (const r of sched) s = simulate(s, r);
  const counts = Object.values(s.roundsPlayed);
  const max = Math.max(...counts);
  const min = Math.min(...counts);
  assert.ok(max - min <= 1, `rounds-played range too wide: ${min}..${max}`);
});

test('reoptimizeFrom does not touch rounds before fromIndex', () => {
  const state = blankState(['a','b','c','d','e','f']);
  const rng1 = createRng(1);
  const original = generateSchedule(state, 6, DEFAULT_WEIGHTS, rng1);
  const wrapped = original.map(c => ({ teamA: c.teamA, teamB: c.teamB, status: 'tentative', score: null, manuallyEdited: false }));
  const reoptimized = reoptimizeFrom({ ...state, schedule: wrapped }, 3, DEFAULT_WEIGHTS, createRng(2));
  for (let i = 0; i < 3; i++) {
    assert.deepEqual(reoptimized[i].teamA, wrapped[i].teamA);
    assert.deepEqual(reoptimized[i].teamB, wrapped[i].teamB);
  }
});

test('reoptimizeFrom skips manually edited rounds', () => {
  const state = blankState(['a','b','c','d','e','f']);
  const sched = generateSchedule(state, 5, DEFAULT_WEIGHTS, createRng(1))
    .map(c => ({ teamA: c.teamA, teamB: c.teamB, status: 'tentative', score: null, manuallyEdited: false }));
  sched[2].manuallyEdited = true;
  const before = { teamA: [...sched[2].teamA], teamB: [...sched[2].teamB] };
  const after = reoptimizeFrom({ ...state, schedule: sched }, 0, DEFAULT_WEIGHTS, createRng(2));
  assert.deepEqual(after[2].teamA, before.teamA);
  assert.deepEqual(after[2].teamB, before.teamB);
});
