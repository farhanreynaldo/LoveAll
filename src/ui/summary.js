import { clearSession } from '../persistence.js';

export function renderSummary(root, go, session) {
  const state = session;
  const totalGames = state.schedule
    .filter(r => r.score)
    .reduce((acc, r) => acc + r.score[0] + r.score[1], 0);
  const elapsedMin = Math.round((Date.now() - state.startedAt) / 60000);
  const completedRounds = state.schedule.filter(r => r.status === 'completed').length;

  const leaderboard = [...state.players].sort((a, b) => {
    const wb = state.wins[b.id] - state.wins[a.id];
    if (wb !== 0) return wb;
    return (state.gamesFor[b.id] - state.gamesAgainst[b.id]) - (state.gamesFor[a.id] - state.gamesAgainst[a.id]);
  });

  const roundsRange = (() => {
    const vals = Object.values(state.roundsPlayed);
    return [Math.min(...vals), Math.max(...vals)];
  })();

  const avgUniquePartners = (() => {
    const counts = state.players.map(p => {
      const partnered = Object.entries(state.partnerCounts[p.id] || {}).filter(([, n]) => n > 0).length;
      return partnered;
    });
    const sum = counts.reduce((a, b) => a + b, 0);
    return (sum / counts.length).toFixed(1);
  })();

  root.innerHTML = `
    <div class="screen-header">
      <div class="title">Session complete</div>
      <button class="icon-btn" id="close-btn" aria-label="close">×</button>
    </div>

    <div class="summary-hero">
      <div class="meta">${completedRounds} rounds · ${formatDuration(elapsedMin)}</div>
      <div class="big">${totalGames} games</div>
      <div class="meta">played across ${state.players.length} players</div>
    </div>

    <div class="label">Leaderboard · wins</div>
    <div class="card" style="padding: 4px 0;">
      ${leaderboard.map((p, i) => `
        <div class="leader-row">
          <span class="rank">${i + 1}</span>
          <span class="name">${escapeHtml(p.name)}</span>
          <span class="stat">${state.wins[p.id]} W · ${state.losses[p.id]} L</span>
        </div>
      `).join('')}
    </div>

    <div class="label">Fairness check</div>
    <div class="card" style="padding: 4px 0;">
      <div class="leader-row">
        <span class="name">Rounds played</span>
        <span class="stat">${roundsRange[0]}–${roundsRange[1]} per player ${roundsRange[1] - roundsRange[0] <= 1 ? '✓' : ''}</span>
      </div>
      <div class="leader-row">
        <span class="name">Unique partners</span>
        <span class="stat">avg ${avgUniquePartners} / ${state.players.length - 1}</span>
      </div>
    </div>

    <button class="btn" id="new-btn" style="margin-top:18px;">New session</button>
    <button class="btn ghost" id="done-btn" style="margin-top:8px;">Done</button>
  `;

  root.querySelector('#close-btn').onclick = () => {
    clearSession();
    go('setup');
  };
  root.querySelector('#new-btn').onclick = () => {
    clearSession();
    go('setup');
  };
  root.querySelector('#done-btn').onclick = () => {
    if (confirm('Clear this session and return to a blank setup?')) {
      clearSession();
      go('setup');
    }
  };

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function formatDuration(min) {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }
}
