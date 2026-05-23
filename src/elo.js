// Elo for doubles, with margin-aware actual score.

export function seedElo(seedSkill) {
  return 1000 + 100 * seedSkill;
}

export function expectedScore(ratingA, ratingB) {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

/**
 * Returns a new ratings map with updates applied. Input is not mutated.
 */
export function updateElo(ratings, teamA, teamB, gamesA, gamesB, k = 32) {
  const next = { ...ratings };
  const total = gamesA + gamesB;
  if (total === 0) return next;

  const rA = (ratings[teamA[0]] + ratings[teamA[1]]) / 2;
  const rB = (ratings[teamB[0]] + ratings[teamB[1]]) / 2;

  const eA = expectedScore(rA, rB);
  const eB = 1 - eA;

  const sA = gamesA / total;
  const sB = 1 - sA;

  const deltaA = k * (sA - eA);
  const deltaB = k * (sB - eB);

  next[teamA[0]] += deltaA;
  next[teamA[1]] += deltaA;
  next[teamB[0]] += deltaB;
  next[teamB[1]] += deltaB;

  return next;
}
