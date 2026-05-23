import { seedElo } from '../elo.js';

export function renderPlayer(root, go, session, playerId) {
  const state = session;
  const player = state.players.find(p => p.id === playerId);
  if (!player) {
    // Defensive: shouldn't happen via normal navigation
    root.innerHTML = `<div class="screen-header"><div class="title">Player not found</div><button class="icon-btn" id="back-btn">×</button></div>`;
    root.querySelector('#back-btn').onclick = () => go('summary', state);
    return;
  }

  const elo = Math.round(state.elo[player.id] ?? 0);
  const wins = state.wins[player.id] ?? 0;
  const losses = state.losses[player.id] ?? 0;
  const gf = state.gamesFor[player.id] ?? 0;
  const ga = state.gamesAgainst[player.id] ?? 0;
  const rounds = state.roundsPlayed[player.id] ?? 0;

  const partners = state.players
    .filter(p => p.id !== player.id)
    .map(p => ({ p, n: state.partnerCounts[player.id]?.[p.id] ?? 0 }))
    .sort((a, b) => b.n - a.n);

  const opponents = state.players
    .filter(p => p.id !== player.id)
    .map(p => ({ p, n: state.opponentCounts[player.id]?.[p.id] ?? 0 }))
    .sort((a, b) => b.n - a.n);

  root.innerHTML = `
    <div class="screen-header">
      <div class="title">${escapeHtml(player.name)}</div>
      <button class="icon-btn" id="back-btn" aria-label="back">×</button>
    </div>

    <div class="summary-hero">
      <div class="meta">Elo</div>
      <div class="big">${elo}</div>
      <div class="meta">started at ${seedElo(player.seedSkill)} (skill ${['', 'Low', 'Mid', 'High'][player.seedSkill] ?? 'Mid'})</div>
    </div>

    <div class="label">Record</div>
    <div class="card" style="padding: 4px 0;">
      <div class="leader-row"><span class="name">Rounds played</span><span class="stat">${rounds}</span></div>
      <div class="leader-row"><span class="name">Wins · Losses</span><span class="stat">${wins} W · ${losses} L</span></div>
      <div class="leader-row"><span class="name">Games for · against</span><span class="stat">${gf} – ${ga}</span></div>
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
