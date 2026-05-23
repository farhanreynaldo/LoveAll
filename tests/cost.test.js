import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_WEIGHTS, computeCost } from '../src/cost.js';

function blankState(playerIds) {
  const partnerCounts = {};
  const opponentCounts = {};
  const elo = {};
  const roundsPlayed = {};
  for (const id of playerIds) {
    partnerCounts[id] = {};
    opponentCounts[id] = {};
    elo[id] = 1300;
    roundsPlayed[id] = 0;
    for (const j of playerIds) {
      if (j !== id) {
        partnerCounts[id][j] = 0;
        opponentCounts[id][j] = 0;
      }
    }
  }
  return { partnerCounts, opponentCounts, elo, roundsPlayed };
}

test('cost is zero on a fresh state with equal Elo', () => {
  const state = blankState(['a','b','c','d','e','f']);
  const candidate = { teamA: ['a','b'], teamB: ['c','d'] };
  const c = computeCost(candidate, state, DEFAULT_WEIGHTS);
  assert.equal(c, 0);
});

test('rest_penalty dominates when an overplayed player would play again', () => {
  const state = blankState(['a','b','c','d','e','f']);
  state.roundsPlayed.a = 3;
  const candidateWithA = { teamA: ['a','b'], teamB: ['c','d'] };
  const candidateWithoutA = { teamA: ['b','c'], teamB: ['d','e'] };
  const cWith = computeCost(candidateWithA, state, DEFAULT_WEIGHTS);
  const cWithout = computeCost(candidateWithoutA, state, DEFAULT_WEIGHTS);
  assert.ok(cWith > cWithout);
  assert.ok(cWith > 1000);
});

test('partner_penalty grows quadratically with repetition', () => {
  const state = blankState(['a','b','c','d','e','f']);
  state.partnerCounts.a.b = 2;
  state.partnerCounts.b.a = 2;
  const candidate = { teamA: ['a','b'], teamB: ['c','d'] };
  const c = computeCost(candidate, state, DEFAULT_WEIGHTS);
  assert.equal(c, 40);
});

test('opponent_penalty also grows quadratically', () => {
  const state = blankState(['a','b','c','d','e','f']);
  state.opponentCounts.a.c = 2;
  state.opponentCounts.c.a = 2;
  const candidate = { teamA: ['a','b'], teamB: ['c','d'] };
  const c = computeCost(candidate, state, DEFAULT_WEIGHTS);
  assert.equal(c, 32);
});

test('skill_penalty fires on unbalanced teams', () => {
  const state = blankState(['a','b','c','d','e','f']);
  state.elo.a = 1500;
  state.elo.b = 1500;
  state.elo.c = 1100;
  state.elo.d = 1100;
  const candidate = { teamA: ['a','b'], teamB: ['c','d'] };
  const c = computeCost(candidate, state, DEFAULT_WEIGHTS);
  assert.equal(c, 64);
});
