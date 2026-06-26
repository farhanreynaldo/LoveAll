import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createSession,
  applyScore,
  recomputeFromCompleted,
  addPlayer,
  removePlayer,
} from '../src/state.js';
import { reoptimizeFrom } from '../src/scheduler.js';
import { createRng } from '../src/rng.js';

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

test('removePlayer retains the name so historical rounds never show a raw id', () => {
  // Regression: completed rounds legitimately reference a removed player by id.
  // Without name retention, the live screen rendered the id ("p7") as the name.
  const s = createSession({ players: PLAYERS, targetRounds: 4, seed: 1 });
  const next = removePlayer(s, 'f');
  const retained = next.removedPlayers.find(p => p.id === 'f');
  assert.equal(retained?.name, 'Priya');
});

test('removePlayer scrubs pending rounds and reoptimize replays history without throwing', () => {
  // Regression: removing a player mid-session used to leave them in the
  // schedule while their count maps were deleted, so reoptimizeFrom threw on
  // the missing maps. Completed rounds stay intact; pending rounds drop them.
  let s = createSession({ players: PLAYERS, targetRounds: 6, seed: 7 });
  s = applyScore(s, 0, 6, 2); // round 0 becomes completed history
  const idx = s.schedule.findIndex(r => r.status !== 'completed' && r.status !== 'skipped');
  const victim = s.schedule[idx].teamA[0]; // someone in the current match

  s = removePlayer(s, victim);

  // Pending rounds no longer reference the removed player.
  for (let i = idx; i < s.schedule.length; i++) {
    const r = s.schedule[i];
    assert.ok(!r.teamA.includes(victim) && !r.teamB.includes(victim));
  }
  // Completed round keeps them (history is the record of who actually played).
  assert.ok([...s.schedule[0].teamA, ...s.schedule[0].teamB].includes(victim));

  // Reoptimizing from the current round must not throw on the purged maps.
  const rng = createRng((s.seed + 2000) >>> 0);
  const reopt = reoptimizeFrom(s, idx, s.weights, rng);
  assert.ok(!reopt[idx].teamA.includes(victim) && !reopt[idx].teamB.includes(victim));
});

test('removePlayer then recomputeFromCompleted does not NaN-poison survivors and reoptimize does not throw', () => {
  // Regression: applyScore re-applied a completed round that referenced a
  // removed player; undefined stats + elo produced NaN that spread to survivors.
  let s = createSession({ players: PLAYERS, targetRounds: 6, seed: 7 });
  s = applyScore(s, 0, 6, 2);
  const victim = s.schedule[0].teamA[0];
  s = removePlayer(s, victim);
  s = recomputeFromCompleted(s);
  // No survivor Elo value should be NaN.
  for (const [id, val] of Object.entries(s.elo)) {
    assert.ok(!Number.isNaN(val), `s.elo[${id}] is NaN after recomputeFromCompleted`);
  }
  // The removed player's wins key should be absent (undefined), not NaN.
  assert.equal(s.wins[victim], undefined, `s.wins[${victim}] should be undefined, not NaN`);
  // Reoptimizing from round 1 should not throw.
  assert.doesNotThrow(() => {
    reoptimizeFrom(s, 1, s.weights, createRng(1));
  });
});

test('createSession defaults to 30 rounds when targetRounds is omitted', () => {
  const s = createSession({ players: PLAYERS, seed: 1 });
  assert.equal(s.schedule.length, 30);
  for (const r of s.schedule) assert.equal(r.status, 'tentative');
});

test('createSession defaults to doubles when format omitted (back-compat)', () => {
  const players = [
    { id: 'a', name: 'A', seedSkill: 2 },
    { id: 'b', name: 'B', seedSkill: 2 },
    { id: 'c', name: 'C', seedSkill: 2 },
    { id: 'd', name: 'D', seedSkill: 2 },
  ];
  const s = createSession({ players, targetRounds: 1, seed: 1 });
  assert.equal(s.format, 'doubles');
  assert.equal(s.schedule[0].teamA.length, 2);
});

test('createSession with format singles schedules 1v1 rounds', () => {
  const players = [
    { id: 'a', name: 'A', seedSkill: 2 },
    { id: 'b', name: 'B', seedSkill: 2 },
    { id: 'c', name: 'C', seedSkill: 2 },
  ];
  const s = createSession({ players, targetRounds: 2, seed: 1, format: 'singles' });
  assert.equal(s.format, 'singles');
  assert.equal(s.schedule.length, 2);
  assert.equal(s.schedule[0].teamA.length, 1);
  assert.equal(s.schedule[0].teamB.length, 1);
});

test('createSession defaults fairnessPreset to balanced with default weights (back-compat)', () => {
  const players = [
    { id: 'a', name: 'A', seedSkill: 2 },
    { id: 'b', name: 'B', seedSkill: 2 },
    { id: 'c', name: 'C', seedSkill: 2 },
    { id: 'd', name: 'D', seedSkill: 2 },
  ];
  const s = createSession({ players, targetRounds: 1, seed: 1 });
  assert.equal(s.fairnessPreset, 'balanced');
  assert.equal(s.weights.skill, 1);
});

test('createSession with fairnessPreset even derives boosted skill weight', () => {
  const players = [
    { id: 'a', name: 'A', seedSkill: 2 },
    { id: 'b', name: 'B', seedSkill: 2 },
    { id: 'c', name: 'C', seedSkill: 2 },
    { id: 'd', name: 'D', seedSkill: 2 },
  ];
  const s = createSession({ players, targetRounds: 1, seed: 1, fairnessPreset: 'even' });
  assert.equal(s.fairnessPreset, 'even');
  assert.ok(s.weights.skill > 1);
});
