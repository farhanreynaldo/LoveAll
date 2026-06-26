// Elo for doubles, with margin-aware actual score.

// Maps 3 skill levels (1=Low, 2=Mid, 3=High) to Elo seeds.
export function seedElo(seedSkill) {
  const map = { 1: 1100, 2: 1300, 3: 1500 };
  return map[seedSkill] ?? 1300;
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

  const avg = team => team.reduce((s, id) => s + ratings[id], 0) / team.length;
  const rA = avg(teamA);
  const rB = avg(teamB);

  const eA = expectedScore(rA, rB);
  const eB = 1 - eA;

  const sA = gamesA / total;
  const sB = 1 - sA;

  const deltaA = k * (sA - eA);
  const deltaB = k * (sB - eB);

  for (const id of teamA) next[id] += deltaA;
  for (const id of teamB) next[id] += deltaB;

  return next;
}
