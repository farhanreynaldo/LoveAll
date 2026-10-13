import { createSession, addPlayer, applyScore } from './state.js';
import { enumerateCandidates } from './scheduler.js';
import { seedElo, updateElo } from './elo.js';

const capacity = 4;

function compareRank(a, b) {
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return 0;
}

function tieBreak(seed, round, candidate) {
  const value = `${seed}:${round}:${candidate.teamA.join(':')}:${candidate.teamB.join(':')}`;
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) hash = Math.imul(hash ^ value.charCodeAt(i), 16777619);
  return hash >>> 0;
}

export function chooseAdaptiveMatch(state) {
  const ready = state.players.filter(p => state.availability[p.id] === 'ready');
  if (ready.length < capacity) return null;
  const ids = ready.map(p => p.id);
  let best = null;
  let bestRank = null;
  let bestTie = Infinity;

  for (const candidate of enumerateCandidates(ids, 'doubles')) {
    const on = new Set([...candidate.teamA, ...candidate.teamB]);
    const waits = ready.map(p => on.has(p.id) ? 0 : state.sitStreak[p.id] + 1);
    const missed = ready.map(p => state.missed[p.id] + (on.has(p.id) ? 0 : 1));
    const partnerRepeats = [candidate.teamA, candidate.teamB]
      .reduce((sum, [a, b]) => sum + (state.partnerCounts[a]?.[b] ?? 0), 0);
    const opponentRepeats = candidate.teamA.reduce((sum, a) =>
      sum + candidate.teamB.reduce((count, b) => count + (state.opponentCounts[a]?.[b] ?? 0), 0), 0);
    const teamRating = team => team.reduce((sum, id) => sum + (state.elo[id] ?? 1300), 0);
    const rank = [
      Math.max(...waits),
      Math.max(...missed) - Math.min(...missed),
      missed.reduce((sum, n) => sum + n * n, 0),
      partnerRepeats,
      opponentRepeats,
      Math.abs(teamRating(candidate.teamA) - teamRating(candidate.teamB)),
    ];
    const tie = tieBreak(state.seed, state.schedule.length, candidate);
    if (!best || compareRank(rank, bestRank) < 0 || (compareRank(rank, bestRank) === 0 && tie < bestTie)) {
      best = candidate;
      bestRank = rank;
      bestTie = tie;
    }
  }
  return best;
}

function pending(match) {
  return { teamA: match.teamA, teamB: match.teamB, status: 'tentative', score: null, manuallyEdited: false };
}

function refreshNext(state) {
  const next = structuredClone(state);
  const last = next.schedule.at(-1);
  if (last?.status === 'in_progress') return next;
  if (last?.status === 'tentative' && last.manuallyEdited &&
      [...last.teamA, ...last.teamB].every(id => next.availability[id] === 'ready')) return next;
  if (last?.status === 'tentative') next.schedule.pop();
  const match = chooseAdaptiveMatch(next);
  if (match) next.schedule.push(pending(match));
  return next;
}

export function setAdaptiveMatch(state, teamA, teamB) {
  if (state.schedule.at(-1)?.status !== 'tentative') throw new Error('Finish the current match first');
  if (!Array.isArray(teamA) || !Array.isArray(teamB)) throw new Error('Choose two players for each team');
  const ids = [...teamA, ...teamB];
  if (teamA.length !== 2 || teamB.length !== 2 || new Set(ids).size !== 4 ||
      ids.some(id => state.availability[id] !== 'ready')) throw new Error('Choose four different available players');
  const next = structuredClone(state);
  next.schedule[next.schedule.length - 1] = { ...pending({ teamA: [...teamA], teamB: [...teamB] }), manuallyEdited: true };
  return next;
}

export function createAdaptiveSession({ players, seed = Date.now() >>> 0 }) {
  if (players.length < capacity || players.length > 12) throw new Error('Doubles needs 4 to 12 players');
  const state = createSession({ players, seed, targetRounds: 1, format: 'doubles' });
  state.mode = 'adaptive';
  state.targetRounds = null;
  state.schedule = [];
  state.availability = Object.fromEntries(players.map(p => [p.id, 'ready']));
  state.missed = Object.fromEntries(players.map(p => [p.id, 0]));
  return refreshNext(state);
}

export function addAdaptivePlayer(state, player) {
  if (state.players.filter(p => state.availability[p.id] !== 'left').length >= 12) {
    throw new Error('The active roster already has 12 players');
  }
  if (state.players.some(p => p.id === player.id)) throw new Error('Player ID already in use');
  const next = addPlayer(state, player);
  next.availability[player.id] = 'ready';
  next.missed[player.id] = 0;
  return refreshNext(next);
}

export function setAttendance(state, playerId, availability) {
  if (!['ready', 'break', 'left'].includes(availability)) throw new Error('Unknown attendance status');
  if (!state.players.some(p => p.id === playerId)) throw new Error('Player not found');
  if (availability === 'ready' && state.availability[playerId] === 'left' &&
      state.players.filter(p => state.availability[p.id] !== 'left').length >= 12) {
    throw new Error('The active roster already has 12 players');
  }
  const current = state.schedule.at(-1);
  if (current?.status === 'in_progress' && availability !== 'ready' &&
      [...current.teamA, ...current.teamB].includes(playerId)) {
    throw new Error('Finish or cancel this match before changing a player on court');
  }
  const next = structuredClone(state);
  next.availability[playerId] = availability;
  if (current?.status === 'in_progress' && availability !== 'ready') {
    const inProgress = next.schedule.at(-1);
    inProgress.eligibleAtStart = inProgress.eligibleAtStart.filter(id => id !== playerId);
  }
  if (availability !== 'ready') next.sitStreak[playerId] = 0;
  if (availability === 'ready' && state.availability[playerId] !== 'ready') next.sitStreak[playerId] = 0;
  return refreshNext(next);
}

export function startAdaptiveMatch(state) {
  const current = state.schedule.at(-1);
  if (!current || current.status !== 'tentative') throw new Error('No matchup is ready');
  const next = structuredClone(state);
  next.schedule.at(-1).status = 'in_progress';
  next.schedule.at(-1).eligibleAtStart = next.players
    .filter(p => next.availability[p.id] === 'ready').map(p => p.id);
  return next;
}

export function cancelAdaptiveMatch(state) {
  if (state.schedule.at(-1)?.status !== 'in_progress') throw new Error('No match is in progress');
  const next = structuredClone(state);
  next.schedule.at(-1).status = 'tentative';
  delete next.schedule.at(-1).eligibleAtStart;
  return refreshNext(next);
}

export function completeAdaptiveMatch(state, gamesA, gamesB) {
  const current = state.schedule.at(-1);
  if (current?.status !== 'in_progress') throw new Error('Start the match before saving its score');
  if (!Number.isInteger(gamesA) || !Number.isInteger(gamesB) || gamesA < 0 || gamesB < 0 || gamesA + gamesB === 0) {
    throw new Error('Enter a final score');
  }
  const index = state.schedule.length - 1;
  const on = new Set([...current.teamA, ...current.teamB]);
  const eligible = new Set(current.eligibleAtStart.filter(id => state.availability[id] === 'ready'));
  const next = applyScore(state, index, gamesA, gamesB);
  for (const player of next.players) {
    const id = player.id;
    if (eligible.has(id) && !on.has(id)) next.missed[id] += 1;
    if (!eligible.has(id)) next.sitStreak[id] = state.sitStreak[id];
  }
  delete next.schedule[index].eligibleAtStart;
  return refreshNext(next);
}

export function editAdaptiveScore(state, index, gamesA, gamesB) {
  const next = structuredClone(state);
  const round = next.schedule[index];
  if (round?.status !== 'completed') throw new Error('Only completed scores can be edited');
  if (!Number.isInteger(gamesA) || !Number.isInteger(gamesB) || gamesA < 0 || gamesB < 0 || gamesA + gamesB === 0) {
    throw new Error('Enter a final score');
  }
  round.score = [gamesA, gamesB];
  for (const p of next.players) {
    next.wins[p.id] = 0; next.losses[p.id] = 0;
    next.gamesFor[p.id] = 0; next.gamesAgainst[p.id] = 0;
    next.elo[p.id] = seedElo(p.seedSkill);
  }
  for (const r of next.schedule.filter(r => r.status === 'completed')) {
    const [a, b] = r.score;
    const winners = a > b ? r.teamA : b > a ? r.teamB : [];
    const losers = a > b ? r.teamB : b > a ? r.teamA : [];
    for (const id of winners) next.wins[id] += 1;
    for (const id of losers) next.losses[id] += 1;
    for (const id of r.teamA) { next.gamesFor[id] += a; next.gamesAgainst[id] += b; }
    for (const id of r.teamB) { next.gamesFor[id] += b; next.gamesAgainst[id] += a; }
    next.elo = updateElo(next.elo, r.teamA, r.teamB, a, b, next.k);
  }
  return refreshNext(next);
}

export function explainAdaptiveMatch(state) {
  const round = state.schedule.at(-1);
  if (!round || round.status === 'completed') return 'Four available players are needed to continue.';
  if (round.manuallyEdited) return 'Host picked this matchup. Waiting counts will update after the score.';
  const ready = state.players.filter(p => state.availability[p.id] === 'ready');
  const longest = Math.max(...ready.map(p => state.sitStreak[p.id]));
  if (longest === 0) return 'No one is on a wait streak. Missed turns come first; partner repeats and team balance break ties.';
  const on = new Set([...round.teamA, ...round.teamB]);
  const names = ready.filter(p => on.has(p.id) && state.sitStreak[p.id] === longest).map(p => p.name);
  if (!names.length) return 'This matchup keeps the longest wait as short as possible.';
  return `${names.join(', ')} ${names.length === 1 ? 'has' : 'have'} waited ${longest} ${longest === 1 ? 'round' : 'rounds'} and ${names.length === 1 ? 'is' : 'are'} back on court.`;
}
