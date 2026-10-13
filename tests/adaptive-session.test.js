import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addAdaptivePlayer, cancelAdaptiveMatch, chooseAdaptiveMatch, completeAdaptiveMatch,
  createAdaptiveSession, editAdaptiveScore, setAttendance, setAdaptiveMatch, startAdaptiveMatch,
} from '../src/adaptive-session.js';

const players = n => Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `Player ${i}`, seedSkill: 2 }));
const play = state => completeAdaptiveMatch(startAdaptiveMatch(state), 6, 3);

test('new doubles sessions choose one next match at a time with balanced appearances', () => {
  for (let n = 4; n <= 12; n++) {
    let state = createAdaptiveSession({ players: players(n), seed: 19 });
    for (let i = 0; i < 30; i++) {
      const round = state.schedule.at(-1);
      assert.equal(new Set([...round.teamA, ...round.teamB]).size, 4);
      state = play(state);
    }
    const counts = Object.values(state.roundsPlayed);
    assert.ok(Math.max(...counts) - Math.min(...counts) <= 1, `${n} players: ${counts}`);
    assert.equal(state.schedule.filter(r => r.status === 'completed').length, 30);
    assert.equal(state.schedule.at(-1).status, 'tentative');
  }
});

test('late arrivals and voluntary breaks do not receive waiting credit for missed matches', () => {
  let state = createAdaptiveSession({ players: players(7), seed: 2 });
  state = play(state);
  state = addAdaptivePlayer(state, { id: 'late', name: 'Late', seedSkill: 2 });
  assert.equal(state.missed.late, 0);
  const resting = state.players.find(p => !state.schedule.at(-1).teamA.includes(p.id) && !state.schedule.at(-1).teamB.includes(p.id) && p.id !== 'late');
  const before = state.missed[resting.id];
  state = setAttendance(state, resting.id, 'break');
  state = play(state);
  assert.equal(state.missed[resting.id], before);
  assert.equal(state.sitStreak[resting.id], 0);
  state = setAttendance(state, resting.id, 'ready');
  assert.equal(state.sitStreak[resting.id], 0);
});

test('attendance changes while a match is in progress preserve its lineup', () => {
  let state = createAdaptiveSession({ players: players(7), seed: 3 });
  state = startAdaptiveMatch(state);
  const current = state.schedule.at(-1);
  const on = current.teamA[0];
  const bench = state.players.find(p => ![...current.teamA, ...current.teamB].includes(p.id));
  assert.throws(() => setAttendance(state, on, 'left'), /Finish or cancel/);
  state = setAttendance(state, bench.id, 'left');
  assert.deepEqual(state.schedule.at(-1).teamA, current.teamA);
  assert.deepEqual(state.schedule.at(-1).teamB, current.teamB);
  state = completeAdaptiveMatch(state, 6, 4);
  assert.equal(state.missed[bench.id], 0);
  assert.ok(![...state.schedule.at(-1).teamA, ...state.schedule.at(-1).teamB].includes(bench.id));
});

test('canceling an in-progress match permits a new lineup without recording a round', () => {
  let state = createAdaptiveSession({ players: players(6), seed: 4 });
  const on = state.schedule.at(-1).teamA[0];
  state = cancelAdaptiveMatch(startAdaptiveMatch(state));
  state = setAttendance(state, on, 'break');
  assert.equal(state.schedule.length, 1);
  assert.equal(state.schedule[0].status, 'tentative');
  assert.ok(![...state.schedule[0].teamA, ...state.schedule[0].teamB].includes(on));
});

test('correcting a score updates standings without changing attendance or completed pairings', () => {
  let state = createAdaptiveSession({ players: players(6), seed: 5 });
  state = play(state);
  const first = structuredClone(state.schedule[0]);
  const played = structuredClone(state.roundsPlayed);
  const missed = structuredClone(state.missed);
  state = editAdaptiveScore(state, 0, 2, 6);
  assert.deepEqual(state.schedule[0].teamA, first.teamA);
  assert.deepEqual(state.roundsPlayed, played);
  assert.deepEqual(state.missed, missed);
  assert.equal(state.wins[first.teamB[0]], 1);
  assert.equal(state.wins[first.teamA[0]], 0);
});

test('a newly ready player is eligible for the next matchup', () => {
  let state = createAdaptiveSession({ players: players(4), seed: 6 });
  state = setAttendance(state, 'p0', 'break');
  assert.equal(chooseAdaptiveMatch(state), null);
  state = setAttendance(state, 'p0', 'ready');
  assert.equal(state.schedule.at(-1).status, 'tentative');
});

test('a player arriving during a match gets no waiting credit for that match', () => {
  let state = startAdaptiveMatch(createAdaptiveSession({ players: players(6), seed: 7 }));
  state = addAdaptivePlayer(state, { id: 'late', name: 'Late', seedSkill: 2 });
  state = completeAdaptiveMatch(state, 6, 4);
  assert.equal(state.missed.late, 0);
  assert.equal(state.sitStreak.late, 0);
});

test('a departed player keeps their results while a new player takes the roster slot', () => {
  let state = createAdaptiveSession({ players: players(12), seed: 8 });
  state = play(state);
  state = setAttendance(state, 'p0', 'left');
  state = addAdaptivePlayer(state, { id: 'new', name: 'New player', seedSkill: 2 });
  assert.equal(state.players.length, 13);
  assert.equal(state.availability.p0, 'left');
  assert.equal(state.availability.new, 'ready');
  assert.throws(() => setAttendance(state, 'p0', 'ready'), /12 players/);
  assert.ok(![...state.schedule.at(-1).teamA, ...state.schedule.at(-1).teamB].includes('p0'));
});

test('host lineup survives unrelated attendance changes and is replaced if a selected player leaves', () => {
  let state = createAdaptiveSession({ players: players(7), seed: 27 });
  const chosen = ['p0', 'p1', 'p2', 'p3'];
  state = setAdaptiveMatch(state, chosen.slice(0, 2), chosen.slice(2));
  assert.equal(state.schedule.at(-1).manuallyEdited, true);
  assert.throws(() => setAdaptiveMatch(state, ['p0', 'p0'], ['p2', 'p3']), /four different/);
  state = setAttendance(state, 'p6', 'break');
  assert.deepEqual([...state.schedule.at(-1).teamA, ...state.schedule.at(-1).teamB], chosen);
  state = setAttendance(state, 'p0', 'left');
  assert.equal(state.schedule.at(-1).manuallyEdited, false);
  assert.ok(![...state.schedule.at(-1).teamA, ...state.schedule.at(-1).teamB].includes('p0'));
});

test('the adaptive wait rule holds across roster sizes and session seeds', () => {
  for (let n = 4; n <= 12; n++) for (let seed = 0; seed < 12; seed++) {
    let state = createAdaptiveSession({ players: players(n), seed });
    for (let i = 0; i < 20; i++) {
      state = play(state);
      assert.ok(Math.max(...Object.values(state.sitStreak)) <= 2, `${n} players, seed ${seed}, round ${i}`);
      const counts = Object.values(state.roundsPlayed);
      assert.ok(Math.max(...counts) - Math.min(...counts) <= 1, `${n} players, seed ${seed}, round ${i}`);
    }
  }
});

test('changing attendance never puts an unavailable player into the next match', () => {
  for (let seed = 1; seed <= 12; seed++) {
    let state = createAdaptiveSession({ players: players(8), seed });
    for (let round = 0; round < 24; round++) {
      if (round === 2) state = addAdaptivePlayer(state, { id: 'late', name: 'Late', seedSkill: 2 });
      if (round === 5) state = setAttendance(state, 'p7', 'break');
      if (round === 8) state = setAttendance(state, 'p7', 'ready');
      if (round === 11) state = setAttendance(state, 'p6', 'left');
      const match = state.schedule.at(-1);
      const ids = [...match.teamA, ...match.teamB];
      assert.equal(new Set(ids).size, 4);
      assert.ok(ids.every(id => state.availability[id] === 'ready'));
      const missedBefore = state.missed.p7;
      state = play(state);
      if (round >= 5 && round < 8) assert.equal(state.missed.p7, missedBefore);
    }
  }
});

test('longest waiting player wins a place even when their partnerships have repeated', () => {
  const state = createAdaptiveSession({ players: players(6), seed: 31 });
  state.sitStreak.p0 = 2;
  for (const other of state.players) if (other.id !== 'p0') {
    state.partnerCounts.p0[other.id] = 20;
    state.partnerCounts[other.id].p0 = 20;
  }
  const match = chooseAdaptiveMatch(state);
  assert.ok([...match.teamA, ...match.teamB].includes('p0'));
});

test('partner variety decides between otherwise equal four-player lineups', () => {
  const state = createAdaptiveSession({ players: players(4), seed: 32 });
  for (const [a, b] of [['p0', 'p1'], ['p2', 'p3']]) {
    state.partnerCounts[a][b] = 5;
    state.partnerCounts[b][a] = 5;
  }
  const match = chooseAdaptiveMatch(state);
  assert.ok(!match.teamA.includes('p0') || !match.teamA.includes('p1'));
  assert.ok(!match.teamB.includes('p0') || !match.teamB.includes('p1'));
});
