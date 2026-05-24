import { seedElo } from '../elo.js';

export function renderPlayer(root, go, session, playerId) {
  const state = session;
  const player = state.players.find(p => p.id === playerId);
  if (!player) {
    root.innerHTML = `<div class="screen-header"><div class="title">Player not found</div><div class="header-actions"><button class="icon-btn theme-toggle-btn" data-theme-toggle aria-label="toggle dark mode" type="button">◐</button><button class="icon-btn" id="back-btn">×</button></div></div>`;
    root.querySelector('#back-btn').onclick = () => go('summary', state);
    return;
  }

  const elo = Math.round(state.elo[player.id] ?? 0);
  const eloStart = seedElo(player.seedSkill);
  const eloDelta = elo - eloStart;
  const wins = state.wins[player.id] ?? 0;
  const losses = state.losses[player.id] ?? 0;
  const gf = state.gamesFor[player.id] ?? 0;
  const ga = state.gamesAgainst[player.id] ?? 0;
  const rounds = state.roundsPlayed[player.id] ?? 0;
  const skillLabel = ['', 'Low', 'Mid', 'High'][player.seedSkill] ?? 'Mid';

  const partners = state.players
    .filter(p => p.id !== player.id)
    .map(p => ({ p, n: state.partnerCounts[player.id]?.[p.id] ?? 0 }))
    .sort((a, b) => b.n - a.n);

  const opponents = state.players
    .filter(p => p.id !== player.id)
    .map(p => ({ p, n: state.opponentCounts[player.id]?.[p.id] ?? 0 }))
    .sort((a, b) => b.n - a.n);

  const eloSign = eloDelta > 0 ? '+' : eloDelta < 0 ? '−' : '±';
  const eloDeltaAbs = Math.abs(eloDelta);

  root.innerHTML = `
    <div class="screen-header">
      <div class="title">${escapeHtml(player.name)}</div>
      <div class="header-actions">
        <button class="icon-btn theme-toggle-btn" data-theme-toggle aria-label="toggle dark mode" type="button">◐</button>
        <button class="icon-btn" id="back-btn" aria-label="back">×</button>
      </div>
    </div>

    <div class="player-intro">
      <div class="player-intro-name">${escapeHtml(firstName(player.name))}</div>
      <div class="player-intro-meta">${rounds} rounds played · seeded ${escapeHtml(skillLabel.toLowerCase())} skill</div>
    </div>

    <div class="label">Record</div>
    <div class="card" style="padding: 4px 0;">
      <div class="leader-row"><span class="name">Wins · Losses</span><span class="stat">${wins} W · ${losses} L</span></div>
      <div class="leader-row"><span class="name">Games for · against</span><span class="stat">${gf} – ${ga}</span></div>
      <div class="leader-row"><span class="name">Rating</span><span class="stat">${elo} <span class="stat-quiet">(${eloSign}${eloDeltaAbs})</span></span></div>
    </div>

    <div class="label">Partner counts</div>
    <div class="card" style="padding: 4px 0;">
      ${partners.map(({ p, n }) => `
        <div class="leader-row"><span class="name">${escapeHtml(p.name)}</span><span class="stat">${n}×</span></div>
      `).join('')}
    </div>

    <div class="label">Opponent counts</div>
    <div class="card" style="padding: 4px 0;">
      ${opponents.map(({ p, n }) => `
        <div class="leader-row"><span class="name">${escapeHtml(p.name)}</span><span class="stat">${n}×</span></div>
      `).join('')}
    </div>

    <button class="btn ghost" id="done-btn" style="margin-top:18px;">Back to summary</button>
  `;

  root.querySelector('#back-btn').onclick = () => go('summary', state);
  root.querySelector('#done-btn').onclick = () => go('summary', state);

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
}

function firstName(full) {
  return String(full).trim().split(/\s+/)[0];
}
