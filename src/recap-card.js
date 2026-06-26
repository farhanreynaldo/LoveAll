export function formatDiff(n) {
  if (n > 0) return `+${n}`;
  if (n < 0) return `−${Math.abs(n)}`; // U+2212 minus sign
  return '0';
}

export function buildStandings(state) {
  const { players, wins, losses, gamesFor, gamesAgainst } = state;
  const ranked = players
    .map(p => ({
      id: p.id,
      name: p.name,
      wins: wins[p.id] ?? 0,
      losses: losses[p.id] ?? 0,
      gameDiff: (gamesFor[p.id] ?? 0) - (gamesAgainst[p.id] ?? 0),
    }))
    .sort((a, b) => (b.wins - a.wins) || (b.gameDiff - a.gameDiff));
  return { ranked, podium: ranked.slice(0, 3), rest: ranked.slice(3) };
}
