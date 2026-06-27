import { createSession } from '../state.js';
import { saveSession, saveLastRoster, loadLastRoster } from '../persistence.js';

const MIN_BY_FORMAT = { doubles: 4, singles: 2 };
const MAX_PLAYERS = 12;

export function renderSetup(root, go) {
  const players = [];
  let nextIdCounter = 1;
  let format = 'doubles';
  let lastRemoved = null;  // { player, idx } of the most recent removal, for undo
  const lastRoster = loadLastRoster();

  function genId() { return `p${nextIdCounter++}`; }
  function minPlayers() { return MIN_BY_FORMAT[format]; }

  const SKILL_LABELS = { 1: 'Low', 2: 'Mid', 3: 'High' };
  // A single pill that shows the current skill and cycles low -> mid -> high
  // on tap. Compact enough to sit on the name's line without truncating it.
  function skillPill(current, idx) {
    const label = SKILL_LABELS[current] ?? 'Mid';
    return `<button type="button" class="skill-pill" data-idx="${idx}" aria-label="Skill: ${label}. Tap to change.">${label}</button>`;
  }

  function render() {
    const min = minPlayers();
    const canStart = players.length >= min;
    const needed = min - players.length;

    root.innerHTML = `
      <div class="screen-header">
        <div class="title">Who's playing?</div>
        <div class="header-actions">
          <span style="font-size:var(--text-meta);color:var(--text-secondary);">${
            canStart
              ? `${players.length} player${players.length === 1 ? '' : 's'}`
              : `Need ${needed} to start`
          }</span>
          <button class="icon-btn theme-toggle-btn" data-theme-toggle aria-label="toggle dark mode" type="button">◐</button>
        </div>
      </div>

      <div class="segmented" role="radiogroup" aria-label="Match format">
        <button type="button" class="segment ${format === 'doubles' ? 'is-active' : ''}" role="radio" aria-checked="${format === 'doubles'}" data-format="doubles">Doubles</button>
        <button type="button" class="segment ${format === 'singles' ? 'is-active' : ''}" role="radio" aria-checked="${format === 'singles'}" data-format="singles">Singles</button>
      </div>

      <form id="add-form" style="display:flex;gap:6px;margin-bottom:12px;">
        <input type="text" id="new-name" placeholder="Type a name and tap +" autocomplete="off" />
        <button class="btn small" type="submit" ${players.length >= MAX_PLAYERS ? 'disabled' : ''} aria-label="Add player" style="white-space:nowrap;padding:10px 16px;">+</button>
      </form>

      ${players.length === 0 && lastRoster ? `
        <button class="btn ghost small" id="reuse-btn" style="margin-bottom:12px;">
          Reuse last roster (${lastRoster.length} players)
        </button>
      ` : ''}

      ${lastRemoved ? `
        <div class="undo-banner" role="status">
          <span>Removed ${escapeHtml(lastRemoved.player.name)}.</span>
          <button type="button" class="undo-btn" id="undo-remove">Undo</button>
        </div>
      ` : ''}

      ${players.length > 0 ? `
        <p class="roster-hint">Tap a player's skill to cycle low, mid, high.</p>
        <div class="card" style="padding:4px 12px;">
          ${players.map((p, i) => `
            <div class="row roster-row" data-idx="${i}">
              <input type="text" class="player-name" value="${escapeHtml(p.name)}" data-idx="${i}" />
              ${skillPill(p.seedSkill, i)}
              <button class="icon-btn remove-btn" data-idx="${i}" aria-label="remove ${escapeHtml(p.name)}">×</button>
            </div>
          `).join('')}
        </div>
      ` : ''}

      <button class="btn" id="start-btn" style="margin-top:16px;" ${!canStart ? 'disabled' : ''}>
        Start session
      </button>
    `;
    bind();
  }

  function bind() {
    root.querySelector('#add-form').onsubmit = e => {
      e.preventDefault();
      const input = root.querySelector('#new-name');
      const name = input.value.trim();
      if (!name || players.length >= MAX_PLAYERS) return;
      players.push({ id: genId(), name, seedSkill: 2 });
      lastRemoved = null;
      input.value = '';
      render();
      root.querySelector('#new-name').focus();
    };

    root.querySelectorAll('.player-name').forEach(inp => {
      inp.oninput = e => {
        players[+e.target.dataset.idx].name = e.target.value;
      };
    });

    // Skill pill cycles low -> mid -> high in place (no re-render), so the
    // tap lands instantly and any in-progress name edit isn't disturbed.
    root.querySelectorAll('.skill-pill').forEach(btn => {
      btn.onclick = () => {
        const i = +btn.dataset.idx;
        const next = (players[i].seedSkill % 3) + 1;
        players[i].seedSkill = next;
        const label = SKILL_LABELS[next];
        btn.textContent = label;
        btn.setAttribute('aria-label', `Skill: ${label}. Tap to change.`);
      };
    });

    root.querySelectorAll('.remove-btn').forEach(btn => {
      btn.onclick = () => {
        const idx = +btn.dataset.idx;
        lastRemoved = { player: players[idx], idx };
        players.splice(idx, 1);
        render();
      };
    });

    const undoBtn = root.querySelector('#undo-remove');
    if (undoBtn) {
      undoBtn.onclick = () => {
        const { player, idx } = lastRemoved;
        players.splice(Math.min(idx, players.length), 0, player);
        lastRemoved = null;
        render();
      };
    }

    root.querySelectorAll('.segment[data-format]').forEach(seg => {
      seg.onclick = () => {
        format = seg.dataset.format;
        render();
      };
    });

    const reuseBtn = root.querySelector('#reuse-btn');
    if (reuseBtn) {
      reuseBtn.onclick = () => {
        for (const p of lastRoster) {
          if (players.length < MAX_PLAYERS) {
            const skillRemap = { 1: 1, 2: 1, 3: 2, 4: 3, 5: 3 };
            players.push({ id: genId(), name: p.name, seedSkill: skillRemap[p.seedSkill] ?? 2 });
          }
        }
        lastRemoved = null;
        render();
      };
    }

    root.querySelector('#start-btn').onclick = () => {
      if (players.length < minPlayers()) return;
      saveLastRoster(players);
      const session = createSession({ players: [...players], format });
      saveSession(session);
      go('live', session);
    };
  }

  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  render();
}
