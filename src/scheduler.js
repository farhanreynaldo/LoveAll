import { computeCost, DEFAULT_WEIGHTS } from './cost.js';

function foursomes(players) {
  const result = [];
  const n = players.length;
  for (let i = 0; i < n - 3; i++) {
    for (let j = i + 1; j < n - 2; j++) {
      for (let k = j + 1; k < n - 1; k++) {
        for (let l = k + 1; l < n; l++) {
          result.push([players[i], players[j], players[k], players[l]]);
        }
      }
    }
  }
  return result;
}

function pairings(four) {
  const [a, b, c, d] = four;
  return [
    { teamA: [a, b], teamB: [c, d] },
    { teamA: [a, c], teamB: [b, d] },
    { teamA: [a, d], teamB: [b, c] },
  ];
}

export function enumerateCandidates(players, format = 'doubles') {
  if (format === 'singles') {
    const out = [];
    for (let i = 0; i < players.length; i++) {
      for (let j = i + 1; j < players.length; j++) {
        out.push({ teamA: [players[i]], teamB: [players[j]] });
      }
    }
    return out;
  }
  const out = [];
  for (const four of foursomes(players)) {
    for (const p of pairings(four)) out.push(p);
  }
  return out;
}

export function pickBestCandidate(state, weights, rng) {
  const candidates = enumerateCandidates(state.players, state.format);
  let minCost = Infinity;
  let best = [];
  for (const c of candidates) {
    const cost = computeCost(c, state, weights);
    if (cost < minCost) {
      minCost = cost;
      best = [c];
    } else if (cost === minCost) {
      best.push(c);
    }
  }
  return best[Math.floor(rng() * best.length)];
}

export function simulate(state, candidate) {
  const partnerCounts = structuredClone(state.partnerCounts);
  const opponentCounts = structuredClone(state.opponentCounts);
  const roundsPlayed = { ...state.roundsPlayed };

  const onCourt = [...candidate.teamA, ...candidate.teamB];
  // A completed round can reference a player who was later removed mid-session;
  // their stat/count maps are gone. Skip those ids so replaying history to
  // rebuild counts doesn't dereference a missing entry (they no longer count).
  for (const p of onCourt) {
    if (p in roundsPlayed) roundsPlayed[p] += 1;
  }

  const inc = (map, x, y) => {
    if (!map[x]) return;
    map[x][y] = (map[x][y] ?? 0) + 1;
  };
  for (const team of [candidate.teamA, candidate.teamB]) {
    for (let i = 0; i < team.length; i++) {
      for (let j = i + 1; j < team.length; j++) {
        inc(partnerCounts, team[i], team[j]);
        inc(partnerCounts, team[j], team[i]);
      }
    }
  }

  for (const a of candidate.teamA) {
    for (const b of candidate.teamB) {
      inc(opponentCounts, a, b);
      inc(opponentCounts, b, a);
    }
  }

  return { ...state, partnerCounts, opponentCounts, roundsPlayed };
}

export function generateSchedule(state, targetRounds, weights = DEFAULT_WEIGHTS, rng) {
  const rounds = [];
  let s = state;
  for (let i = 0; i < targetRounds; i++) {
    const cand = pickBestCandidate(s, weights, rng);
    rounds.push(cand);
    s = simulate(s, cand);
  }
  return rounds;
}

const REPLACE_THRESHOLD = 0.05;

/**
 * Re-optimize the unlocked, non-manually-edited tail of the schedule starting
 * at fromIndex. Returns a NEW schedule array.
 *
 * State contract: `state.roundsPlayed`/`partnerCounts`/`opponentCounts` should
 * already reflect *completed* rounds (because applyScore updated them). This
 * function simulates forward through any tentative/locked rounds before
 * fromIndex to account for their fairness impact when scoring later rounds.
 */
export function reoptimizeFrom(state, fromIndex, weights, rng) {
  const result = state.schedule.map(r => ({ ...r, teamA: [...r.teamA], teamB: [...r.teamB] }));

  let s = {
    players: Array.isArray(state.players) && typeof state.players[0] === 'object'
      ? state.players.map(p => p.id)
      : state.players,
    format: state.format,
    roundsPlayed: { ...state.roundsPlayed },
    partnerCounts: structuredClone(state.partnerCounts),
    opponentCounts: structuredClone(state.opponentCounts),
    elo: { ...state.elo },
  };

  for (let i = 0; i < fromIndex; i++) {
    const r = result[i];
    if (r.status === 'tentative' || r.status === 'locked') {
      s = simulate(s, r);
    }
  }

  for (let i = fromIndex; i < result.length; i++) {
    const existing = result[i];
    if (existing.status === 'completed' || existing.status === 'locked' || existing.manuallyEdited) {
      s = simulate(s, existing);
      continue;
    }
    const existingCost = computeCost(existing, s, weights);
    const candidate = pickBestCandidate(s, weights, rng);
    const candidateCost = computeCost(candidate, s, weights);
    if (existingCost === 0 || candidateCost < existingCost * (1 - REPLACE_THRESHOLD)) {
      result[i] = { ...existing, teamA: candidate.teamA, teamB: candidate.teamB };
    }
    s = simulate(s, result[i]);
  }
  return result;
}
