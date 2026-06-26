import { createSession } from '../state.js';
import { saveSession, saveLastRoster, loadLastRoster } from '../persistence.js';

const MIN_BY_FORMAT = { doubles: 4, singles: 2 };
const MAX_PLAYERS = 12;

export function renderSetup(root, go) {
  const players = [];
  let nextIdCounter = 1;
  let format = 'doubles';
  const lastRoster = loadLastRoster();

  function genId() { return `p${nextIdCounter++}`; }
  function minPlayers() { return MIN_BY_FORMAT[format]; }

  const SKILL_LABELS = { 1: 'Low', 2: 'Mid', 3: 'High' };
  function skillSeg(current, idx) {
    return `
      <div class="segmented compact skill-seg" role="radiogroup" aria-label="Skill level" data-idx="${idx}">
        ${[1, 2, 3].map(n =>
          `<button type="button" class="segment ${current === n ? 'is-active' : ''}" role="radio" aria-checked="${current === n}" data-skill="${n}">${SKILL_LABELS[n]}</button>`
        ).join('')}
      </div>
    `;
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
      ${format === 'singles' ? `<p class="roster-hint">Singles plays two at a time — everyone else rests and rotates in.</p>` : ''}

      <form id="add-form" style="display:flex;gap:6px;margin-bottom:12px;">
        <input type="text" id="new-name" placeholder="Type a name and tap +" autocomplete="off" />
        <button class="btn small" type="submit" ${players.length >= MAX_PLAYERS ? 'disabled' : ''} aria-label="Add player" style="white-space:nowrap;">+</button>
      </form>

      ${players.length === 0 && lastRoster ? `
        <button class="btn ghost small" id="reuse-btn" style="margin-bottom:12px;">
          Reuse last roster (${lastRoster.length} players)
        </button>
      ` : ''}

      ${players.length > 0 ? `
        <p class="roster-hint">Set each player's skill: low, mid, or high.</p>
        <div class="card" style="padding:4px 12px;">
          ${players.map((p, i) => `
            <div class="row roster-row" data-idx="${i}">
              <input type="text" class="player-name" value="${escapeHtml(p.name)}" data-idx="${i}" />
              <span class="roster-skill-label">Skill</span>
              ${skillSeg(p.seedSkill, i)}
              <button class="icon-btn remove-btn" data-idx="${i}" aria-label="remove">×</button>
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
      input.value = '';
      render();
      root.querySelector('#new-name').focus();
    };

    root.querySelectorAll('.player-name').forEach(inp => {
      inp.oninput = e => {
        players[+e.target.dataset.idx].name = e.target.value;
      };
    });

    root.querySelectorAll('.skill-seg').forEach(seg => {
      seg.onclick = e => {
        const btn = e.target.closest('.segment[data-skill]');
        if (!btn) return;
        players[+seg.dataset.idx].seedSkill = +btn.dataset.skill;
        render();
      };
    });

    root.querySelectorAll('.remove-btn').forEach(btn => {
      btn.onclick = () => {
        players.splice(+btn.dataset.idx, 1);
        render();
      };
    });

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
