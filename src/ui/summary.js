import { clearSession } from '../persistence.js';
import { buildStandings, formatDiff, renderRecapCard } from '../recap-card.js';

export function renderSummary(root, go, session) {
  const state = session;
  const isSingles = state.format === 'singles';
  const totalGames = state.schedule
    .filter(r => r.score)
    .reduce((acc, r) => acc + r.score[0] + r.score[1], 0);
  const elapsedMin = Math.round((Date.now() - state.startedAt) / 60000);
  const completedRounds = state.schedule.filter(r => r.status === 'completed').length;

  const { ranked, podium } = buildStandings(state);
  const leaderboard = ranked;

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

  const champion = leaderboard[0];
  const dateLine = formatDateLine(state.startedAt);

  const mostPlayedPair = isSingles ? null : findMostPlayedPair(state);
  const closestMatch = findClosestMatch(state);

  root.innerHTML = `
    <div class="screen-header">
      <div class="title">Session complete</div>
      <div class="header-actions">
        <button class="icon-btn theme-toggle-btn" data-theme-toggle aria-label="toggle dark mode" type="button">◐</button>
      </div>
    </div>

    <article class="recap" aria-label="session recap">
      <header class="recap-stamp">
        <span class="recap-mark">LoveAll</span>
        <span class="recap-date">${escapeHtml(dateLine)}</span>
      </header>

      <div class="recap-hero">
        <div class="recap-kicker">Winner</div>
        <div class="recap-champion">${escapeHtml(champion.name)}</div>
      </div>

      <div class="recap-strip" role="group" aria-label="session totals">
        <div class="recap-strip-item"><span class="n">${completedRounds}</span><span class="u">rounds</span></div>
        <div class="recap-strip-item"><span class="n">${totalGames}</span><span class="u">games</span></div>
        <div class="recap-strip-item"><span class="n">${formatDuration(elapsedMin)}</span><span class="u">on court</span></div>
      </div>

      <ol class="roll" aria-label="final standings">
        ${leaderboard.map((p, i) => `
            <li class="roll-row${i === 0 ? ' is-leader' : ''}" data-player-id="${p.id}">
              <span class="roll-rank">${i + 1}</span>
              <span class="roll-name">${escapeHtml(p.name)}</span>
              <span class="roll-record">
                <span class="roll-wl">${p.wins}–${p.losses}</span>
                <span class="roll-diff">${formatDiff(p.gameDiff)}</span>
              </span>
              <span class="roll-chevron" aria-hidden="true">›</span>
            </li>
        `).join('')}
      </ol>

      ${(mostPlayedPair || closestMatch) ? `
        <section class="recap-notes" aria-label="notes from the day">
          <div class="recap-notes-label">Notes</div>
          ${mostPlayedPair ? `
            <div class="recap-note">
              <span class="recap-note-label">Most-played pair</span>
              <span class="recap-note-body">${escapeHtml(mostPlayedPair.names)} <span class="recap-note-tail">${mostPlayedPair.count}× together</span></span>
            </div>` : ''}
          ${closestMatch ? `
            <div class="recap-note">
              <span class="recap-note-label">Closest match</span>
              <span class="recap-note-body">Round ${closestMatch.round} <span class="recap-note-tail">${closestMatch.score}</span></span>
            </div>` : ''}
          <div class="recap-note">
            <span class="recap-note-label">Fairness</span>
            <span class="recap-note-body">${roundsRange[0]}–${roundsRange[1]} rounds per player ${roundsRange[1] - roundsRange[0] <= 1 ? '· evenly spread' : ''}</span>
          </div>
          ${isSingles ? '' : `
          <div class="recap-note">
            <span class="recap-note-label">Partners</span>
            <span class="recap-note-body">avg ${avgUniquePartners} of ${state.players.length - 1} possible</span>
          </div>`}
        </section>` : ''}

    </article>

      <div class="recap-actions" id="recap-actions"></div>
  `;

  const actions = root.querySelector('#recap-actions');

  function wireShare() {
    root.querySelector('#share-btn').onclick = () => shareRanking({
      leaderboard, state, dateLine, totalGames, completedRounds, elapsedMin, champion,
    }, root.querySelector('#share-btn'));
  }

  function showActions() {
    actions.innerHTML = `
      <button class="btn" id="share-btn" type="button">Share the ranking</button>
      <button class="btn ghost" id="new-btn" type="button">New session</button>`;
    wireShare();
    root.querySelector('#new-btn').onclick = showConfirm;
  }

  function showConfirm() {
    actions.innerHTML = `
      <p class="recap-confirm" role="status">Start a new session? This clears today's recap.</p>
      <button class="btn" id="confirm-new" type="button">Clear and start</button>
      <button class="btn ghost" id="cancel-new" type="button">Cancel</button>`;
    root.querySelector('#confirm-new').onclick = () => { clearSession(); go('setup'); };
    root.querySelector('#cancel-new').onclick = showActions;
  }

  showActions();

  root.querySelectorAll('.roll-row').forEach(el => {
    el.onclick = () => go('player', state, el.dataset.playerId);
  });

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function formatDuration(min) {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }
}

function formatDateLine(ts) {
  const d = new Date(ts);
  const day = d.toLocaleDateString(undefined, { weekday: 'long' });
  const date = d.toLocaleDateString(undefined, { month: 'long', day: 'numeric' });
  const hour = d.getHours();
  const slot = hour < 11 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
  return `${day} ${slot} · ${date}`;
}

function firstName(full) {
  return String(full).trim().split(/\s+/)[0];
}

function findMostPlayedPair(state) {
  let best = null;
  for (const p of state.players) {
    const partners = state.partnerCounts[p.id] || {};
    for (const [pid, n] of Object.entries(partners)) {
      if (!n) continue;
      if (pid <= p.id) continue;
      if (!best || n > best.count) {
        const other = state.players.find(x => x.id === pid);
        if (!other) continue;
        best = { count: n, names: `${firstName(p.name)} & ${firstName(other.name)}` };
      }
    }
  }
  return best && best.count >= 2 ? best : null;
}

function findClosestMatch(state) {
  let best = null;
  state.schedule.forEach((r, i) => {
    if (!r.score || r.status !== 'completed') return;
    const [a, b] = r.score;
    const diff = Math.abs(a - b);
    const total = a + b;
    if (total < 2) return;
    if (!best || diff < best.diff || (diff === best.diff && total > best.total)) {
      best = { diff, total, round: i + 1, score: `${Math.max(a, b)}–${Math.min(a, b)}` };
    }
  });
  return best;
}

async function shareRanking(ctx, btn) {
  const { leaderboard, state, dateLine, totalGames, completedRounds, elapsedMin, champion } = ctx;
  const lines = [
    `🎾 ${dateLine}`,
    '',
    ...leaderboard.map((p, i) => {
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
      return `${medal} ${p.name} — ${state.wins[p.id]}W ${state.losses[p.id]}L`;
    }),
    '',
    `${completedRounds} rounds · ${totalGames} games · ${formatDurationPlain(elapsedMin)}`,
  ];
  const text = lines.join('\n');
  const title = `LoveAll — ${firstName(champion.name)} wins the session`;

  let blob;
  try {
    blob = await renderRecapCard(state);
  } catch {
    flashLabel(btn, 'Could not build image');
    return;
  }

  const file = new File([blob], 'loveall-ranking.png', { type: 'image/png' });

  if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title, text });
      return;
    } catch (err) {
      if (err && err.name === 'AbortError') return;
    }
  }
  // Fallback: download the image, copy the text.
  try {
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url; a.download = 'loveall-ranking.png';
    a.click();
    URL.revokeObjectURL(url);
  } catch { /* download unavailable; still try clipboard */ }
  try {
    await navigator.clipboard.writeText(text);
    flashLabel(btn, 'Image saved · text copied');
  } catch {
    flashLabel(btn, 'Image saved');
  }
}

function flashLabel(btn, msg) {
  if (!btn) return;
  const prev = btn.textContent;
  btn.textContent = msg;
  btn.disabled = true;
  setTimeout(() => {
    btn.textContent = prev;
    btn.disabled = false;
  }, 1600);
}

function formatDurationPlain(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
