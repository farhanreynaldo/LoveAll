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

const CARD = {
  w: 1080, h: 1920, pad: 80,
  bg: '#fafaf7', surface: '#ffffff', ink: '#1a1a1a', secondary: '#8a8a85', border: '#e8e6df',
  medal: { 0: '#c9a227', 1: '#9a9a9a', 2: '#b07a45' },
};

function recapDate(ts) {
  const d = new Date(ts);
  const day = d.toLocaleDateString(undefined, { weekday: 'long' });
  const date = d.toLocaleDateString(undefined, { month: 'long', day: 'numeric' });
  const hour = d.getHours();
  const slot = hour < 11 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
  return `${day} ${slot} · ${date}`;
}

function durationLabel(ms) {
  const min = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(min / 60), m = min % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function fitText(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + '…').width > maxWidth) t = t.slice(0, -1);
  return t + '…';
}

function medallion(ctx, x, y, r, rank) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = CARD.medal[rank] ?? CARD.ink;
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = `700 ${Math.round(r)}px ui-sans-serif, system-ui, -apple-system, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(rank + 1), x, y + 1);
}

export async function renderRecapCard(state) {
  if (document.fonts && document.fonts.ready) {
    try { await document.fonts.ready; } catch { /* proceed with fallback face */ }
  }
  const { podium, rest } = buildStandings(state);
  const canvas = document.createElement('canvas');
  canvas.width = CARD.w; canvas.height = CARD.h;
  const ctx = canvas.getContext('2d');
  const FONT = 'ui-sans-serif, system-ui, -apple-system, sans-serif';
  const cx = CARD.w / 2;

  // Background
  ctx.fillStyle = CARD.bg;
  ctx.fillRect(0, 0, CARD.w, CARD.h);

  // Header: wordmark + date
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = CARD.ink;
  ctx.font = `800 52px ${FONT}`;
  ctx.fillText('LoveAll', cx, 150);
  ctx.fillStyle = CARD.secondary;
  ctx.font = `500 30px ${FONT}`;
  ctx.fillText(recapDate(state.startedAt), cx, 200);

  // Podium — champion centered, runners flanking
  const champ = podium[0];
  if (champ) {
    medallion(ctx, cx, 330, 46, 0);
    ctx.fillStyle = CARD.ink;
    ctx.font = `700 64px ${FONT}`;
    ctx.fillText(fitText(ctx, champ.name, CARD.w - 2 * CARD.pad), cx, 470);
    ctx.font = `700 52px ${FONT}`;
    ctx.fillText(`${champ.wins}–${champ.losses}`, cx, 540);
    ctx.fillStyle = CARD.secondary;
    ctx.font = `500 32px ${FONT}`;
    ctx.fillText(`${formatDiff(champ.gameDiff)} games`, cx, 590);
  }
  const flanks = [[podium[1], cx - 230], [podium[2], cx + 230]];
  for (let i = 0; i < flanks.length; i++) {
    const [p, x] = flanks[i];
    if (!p) continue;
    medallion(ctx, x, 700, 34, i + 1);
    ctx.fillStyle = CARD.ink;
    ctx.font = `600 38px ${FONT}`;
    ctx.fillText(fitText(ctx, p.name, 380), x, 800);
    ctx.font = `600 36px ${FONT}`;
    ctx.fillText(`${p.wins}–${p.losses}`, x, 850);
    ctx.fillStyle = CARD.secondary;
    ctx.font = `500 26px ${FONT}`;
    ctx.fillText(`${formatDiff(p.gameDiff)}`, x, 890);
  }

  // Divider
  let y = 980;
  ctx.strokeStyle = CARD.border; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(CARD.pad, y); ctx.lineTo(CARD.w - CARD.pad, y); ctx.stroke();

  // Rest list
  y = 1060;
  const rowH = 96;
  for (let i = 0; i < rest.length; i++) {
    const p = rest[i];
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillStyle = CARD.secondary;
    ctx.font = `600 34px ${FONT}`;
    ctx.fillText(String(i + 4), CARD.pad, y);
    ctx.fillStyle = CARD.ink;
    ctx.font = `500 40px ${FONT}`;
    ctx.fillText(fitText(ctx, p.name, 560), CARD.pad + 70, y);
    ctx.textAlign = 'right';
    ctx.font = `600 40px ${FONT}`;
    ctx.fillText(`${p.wins}–${p.losses}`, CARD.w - CARD.pad - 110, y);
    ctx.fillStyle = CARD.secondary;
    ctx.font = `500 30px ${FONT}`;
    ctx.fillText(formatDiff(p.gameDiff), CARD.w - CARD.pad, y);
    y += rowH;
    if (y > CARD.h - 220) break; // never collide with the footer
  }

  // Footer chip
  const completedRounds = state.schedule.filter(r => r.status === 'completed').length;
  const totalGames = state.schedule.filter(r => r.score).reduce((a, r) => a + r.score[0] + r.score[1], 0);
  const footer = `${completedRounds} rounds · ${totalGames} games · ${durationLabel(Date.now() - state.startedAt)} on court`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = CARD.secondary;
  ctx.font = `500 30px ${FONT}`;
  ctx.fillText(footer, cx, CARD.h - 110);

  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => (blob ? resolve(blob) : reject(new Error('toBlob returned null'))), 'image/png');
  });
}
