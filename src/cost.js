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
  let sum = 0;
  for (const team of [candidate.teamA, candidate.teamB]) {
    for (let i = 0; i < team.length; i++) {
      for (let j = i + 1; j < team.length; j++) {
        const c = state.partnerCounts[team[i]][team[j]] ?? 0;
        sum += c * c;
      }
    }
  }
  return sum;
}

function opponentPenalty(candidate, state) {
  let sum = 0;
  for (const x of candidate.teamA) {
    for (const y of candidate.teamB) {
      const c = state.opponentCounts[x][y] ?? 0;
      sum += c * c;
    }
  }
  return sum;
}

function skillPenalty(candidate, state) {
  const teamSum = team => team.reduce((s, id) => s + state.elo[id], 0);
  const diff = (teamSum(candidate.teamA) - teamSum(candidate.teamB)) / 100;
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
