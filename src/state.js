import { seedElo, updateElo } from './elo.js';
import { simulate, generateSchedule } from './scheduler.js';
import { DEFAULT_WEIGHTS } from './cost.js';
import { createRng } from './rng.js';

function blankCounts(playerIds) {
  const out = {};
  for (const a of playerIds) {
    out[a] = {};
    for (const b of playerIds) if (a !== b) out[a][b] = 0;
  }
  return out;
}

function blankPerPlayer(playerIds, value) {
  const out = {};
  for (const id of playerIds) out[id] = value;
  return out;
}

export function createSession({ players, targetRounds = 30, seed = Date.now() >>> 0, weights = DEFAULT_WEIGHTS, k = 32, format = 'doubles' }) {
  const ids = players.map(p => p.id);
  const state = {
    players,
    targetRounds,
    seed,
    weights,
    k,
    format,
    elo: Object.fromEntries(players.map(p => [p.id, seedElo(p.seedSkill)])),
    roundsPlayed: blankPerPlayer(ids, 0),
    partnerCounts: blankCounts(ids),
    opponentCounts: blankCounts(ids),
    wins: blankPerPlayer(ids, 0),
    losses: blankPerPlayer(ids, 0),
    gamesFor: blankPerPlayer(ids, 0),
    gamesAgainst: blankPerPlayer(ids, 0),
    startedAt: Date.now(),
    schedule: [],
    darkMode: false,
  };
  // generateSchedule requires state.players to be a list of player IDs (not full objects).
  // Pass a temporary shape with `players` as ids for scheduling purposes only.
  const schedulingState = { ...state, players: ids };
  const rng = createRng(seed);
  const tentative = generateSchedule(schedulingState, targetRounds, weights, rng);
  state.schedule = tentative.map(c => ({
    teamA: c.teamA, teamB: c.teamB,
    status: 'tentative', score: null, manuallyEdited: false,
  }));
  return state;
}

export function applyScore(state, roundIndex, gamesA, gamesB) {
  const next = structuredClone(state);
  const r = next.schedule[roundIndex];
  r.status = 'completed';
  r.score = [gamesA, gamesB];
  const winners = gamesA > gamesB ? r.teamA : (gamesB > gamesA ? r.teamB : null);
  const losers  = gamesA > gamesB ? r.teamB : (gamesB > gamesA ? r.teamA : null);

  const sim = simulate({
    players: next.players.map(p => p.id),
    roundsPlayed: next.roundsPlayed,
    partnerCounts: next.partnerCounts,
    opponentCounts: next.opponentCounts,
    elo: next.elo,
  }, { teamA: r.teamA, teamB: r.teamB });
  next.roundsPlayed = sim.roundsPlayed;
  next.partnerCounts = sim.partnerCounts;
  next.opponentCounts = sim.opponentCounts;

  if (winners && losers) {
    for (const id of winners) next.wins[id] += 1;
    for (const id of losers)  next.losses[id] += 1;
  }
  for (const id of r.teamA) { next.gamesFor[id] += gamesA; next.gamesAgainst[id] += gamesB; }
  for (const id of r.teamB) { next.gamesFor[id] += gamesB; next.gamesAgainst[id] += gamesA; }

  next.elo = updateElo(next.elo, r.teamA, r.teamB, gamesA, gamesB, next.k);

  return next;
}

export function recomputeFromCompleted(state) {
  // Start from a fresh session (same players, rounds, seed, weights), then
  // re-apply every completed round in order, preserving the original schedule
  // (so locked/tentative rounds keep their team assignments).
  const fresh = createSession({
    players: state.players,
    targetRounds: state.targetRounds,
    seed: state.seed,
    weights: state.weights,
    k: state.k,
    format: state.format ?? 'doubles',
  });
  // Overwrite the freshly-generated schedule with the existing one, but reset
  // each round's status/score; we will re-apply scores below.
  let s = { ...fresh, schedule: state.schedule.map(r => ({
    teamA: [...r.teamA],
    teamB: [...r.teamB],
    status: r.status === 'completed' ? 'tentative' : r.status,
    score: null,
    manuallyEdited: r.manuallyEdited,
  })) };
  for (let i = 0; i < state.schedule.length; i++) {
    const r = state.schedule[i];
    if (r.status === 'completed' && r.score) {
      s = applyScore(s, i, r.score[0], r.score[1]);
    }
  }
  return s;
}

export function addPlayer(state, player) {
  const next = structuredClone(state);
  next.players.push(player);
  const id = player.id;
  next.elo[id] = seedElo(player.seedSkill);
  next.roundsPlayed[id] = 0;
  next.wins[id] = 0;
  next.losses[id] = 0;
  next.gamesFor[id] = 0;
  next.gamesAgainst[id] = 0;
  next.partnerCounts[id] = {};
  next.opponentCounts[id] = {};
  for (const other of next.players) {
    if (other.id === id) continue;
    next.partnerCounts[id][other.id] = 0;
    next.opponentCounts[id][other.id] = 0;
    next.partnerCounts[other.id][id] = 0;
    next.opponentCounts[other.id][id] = 0;
  }
  return next;
}

export function removePlayer(state, playerId) {
  const next = structuredClone(state);
  next.players = next.players.filter(p => p.id !== playerId);
  delete next.elo[playerId];
  delete next.roundsPlayed[playerId];
  delete next.wins[playerId];
  delete next.losses[playerId];
  delete next.gamesFor[playerId];
  delete next.gamesAgainst[playerId];
  delete next.partnerCounts[playerId];
  delete next.opponentCounts[playerId];
  for (const other of next.players) {
    delete next.partnerCounts[other.id][playerId];
    delete next.opponentCounts[other.id][playerId];
  }
  return next;
}
