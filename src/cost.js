export const DEFAULT_WEIGHTS = Object.freeze({
  rest: 1000,
  partner: 10,
  opponent: 8,
  skill: 1,
});

function restPenalty(candidate, state) {
  const onCourt = [...candidate.teamA, ...candidate.teamB];
  const minRounds = Math.min(...Object.values(state.roundsPlayed));
  let sum = 0;
  for (const p of onCourt) {
    const diff = state.roundsPlayed[p] - minRounds;
    sum += diff * diff;
  }
  return sum;
}

function partnerPenalty(candidate, state) {
  const [a1, a2] = candidate.teamA;
  const [b1, b2] = candidate.teamB;
  const pa = state.partnerCounts[a1][a2] ?? 0;
  const pb = state.partnerCounts[b1][b2] ?? 0;
  return pa * pa + pb * pb;
}

function opponentPenalty(candidate, state) {
  const [a1, a2] = candidate.teamA;
  const [b1, b2] = candidate.teamB;
  const pairs = [[a1,b1],[a1,b2],[a2,b1],[a2,b2]];
  let sum = 0;
  for (const [x, y] of pairs) {
    const c = state.opponentCounts[x][y] ?? 0;
    sum += c * c;
  }
  return sum;
}

function skillPenalty(candidate, state) {
  const sumA = state.elo[candidate.teamA[0]] + state.elo[candidate.teamA[1]];
  const sumB = state.elo[candidate.teamB[0]] + state.elo[candidate.teamB[1]];
  const diff = (sumA - sumB) / 100;
  return diff * diff;
}

export function computeCost(candidate, state, weights = DEFAULT_WEIGHTS) {
  return (
    weights.rest * restPenalty(candidate, state) +
    weights.partner * partnerPenalty(candidate, state) +
    weights.opponent * opponentPenalty(candidate, state) +
    weights.skill * skillPenalty(candidate, state)
  );
}
