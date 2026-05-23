import { createSession } from '../state.js';
import { saveSession, saveLastRoster, loadLastRoster } from '../persistence.js';

const MIN_PLAYERS = 4;
const MAX_PLAYERS = 12;

export function renderSetup(root, go) {
  const players = [];
  let nextIdCounter = 1;
  let step = 1;
  const lastRoster = loadLastRoster();

  function genId() { return `p${nextIdCounter++}`; }

  function render() {
    if (step === 1) renderStep1();
    else renderStep2();
  }

  function stepIndicator() {
    return `
      <div style="display:flex;gap:6px;justify-content:center;margin-bottom:20px;">
        <span style="width:8px;height:8px;border-radius:50%;background:${step === 1 ? 'var(--text)' : 'var(--border)'};display:inline-block;"></span>
        <span style="width:8px;height:8px;border-radius:50%;background:${step === 2 ? 'var(--text)' : 'var(--border)'};display:inline-block;"></span>
      </div>`;
  }

  function skillDots(current) {
    return [1, 2, 3].map(n =>
      `<span class="dot ${current >= n ? 'filled' : ''}" data-skill="${n}" style="cursor:pointer;"></span>`
    ).join('');
  }

  function renderStep1() {
    const canAdvance = players.length >= MIN_PLAYERS;
    const needed = MIN_PLAYERS - players.length;

    root.innerHTML = `
      ${stepIndicator()}

      <div class="screen-header">
        <div class="title">Who's playing?</div>
        <span style="font-size:12px;color:var(--text-secondary);">${players.length} of ${MIN_PLAYERS} min</span>
      </div>

      <form id="add-form" style="display:flex;gap:6px;margin-bottom:12px;">
        <input type="text" id="new-name" placeholder="Type a name and tap +" autocomplete="off" />
        <button class="btn small" type="submit" ${players.length >= MAX_PLAYERS ? 'disabled' : ''} style="white-space:nowrap;">+</button>
      </form>

      ${players.length === 0 && lastRoster ? `
        <button class="btn ghost small" id="reuse-btn" style="margin-bottom:12px;">
          Reuse last roster (${lastRoster.length} players)
        </button>
      ` : ''}

      ${players.length > 0 ? `
        <div class="card" style="padding:4px 12px;">
          ${players.map((p, i) => `
            <div class="row" data-idx="${i}">
              <input type="text" class="player-name" value="${escapeHtml(p.name)}" data-idx="${i}"
                style="border:none;background:transparent;flex:1;padding:0;font-size:15px;" />
              <span style="font-size:11px;color:var(--text-secondary);text-transform:uppercase;letter-spacing:1px;margin-right:6px;">Skill</span>
              <div class="skill-dots" data-idx="${i}">${skillDots(p.seedSkill)}</div>
              <button class="icon-btn remove-btn" data-idx="${i}" aria-label="remove"
                style="font-size:16px;color:var(--text-secondary);">×</button>
            </div>
          `).join('')}
        </div>
      ` : ''}

      ${!canAdvance && players.length > 0 ? `
        <p style="font-size:12px;color:var(--text-secondary);margin-top:8px;padding:0 4px;">
          Need ${needed} more player${needed === 1 ? '' : 's'} to continue
        </p>
      ` : ''}

      <button class="btn" id="next-btn" style="margin-top:16px;" ${!canAdvance ? 'disabled' : ''}>
        Next →
      </button>
    `;
    bindStep1();
  }

  function bindStep1() {
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

    root.querySelectorAll('.skill-dots').forEach(dots => {
      dots.onclick = e => {
        if (!e.target.classList.contains('dot')) return;
        players[+dots.dataset.idx].seedSkill = +e.target.dataset.skill;
        render();
      };
    });

    root.querySelectorAll('.remove-btn').forEach(btn => {
      btn.onclick = () => {
        players.splice(+btn.dataset.idx, 1);
        render();
      };
    });

    const reuseBtn = root.querySelector('#reuse-btn');
    if (reuseBtn) {
      reuseBtn.onclick = () => {
        for (const p of lastRoster) {
          if (players.length < MAX_PLAYERS) {
            players.push({ id: genId(), name: p.name, seedSkill: Math.min(p.seedSkill, 3) });
          }
        }
        render();
      };
    }

    root.querySelector('#next-btn').onclick = () => {
      if (players.length < MIN_PLAYERS) return;
      step = 2;
      render();
    };
  }

  function renderStep2() {
    root.innerHTML = `
      ${stepIndicator()}

      <div class="screen-header">
        <div class="title">Ready?</div>
        <button class="icon-btn" id="back-btn" style="font-size:14px;">← Back</button>
      </div>

      <div class="label">Players · ${players.length}</div>
      <div class="card">
        <div style="display:flex;flex-wrap:wrap;gap:6px;padding:4px 0;">
          ${players.map(p => `
            <span style="display:inline-flex;align-items:center;gap:6px;background:var(--bg);border:1px solid var(--border);border-radius:16px;padding:5px 10px;font-size:13px;">
              ${escapeHtml(p.name)}
              <span class="skill-dots" style="pointer-events:none;">${skillDots(p.seedSkill)}</span>
            </span>
          `).join('')}
        </div>
      </div>

      <button class="btn" id="start-btn" style="margin-top:18px;">Start session</button>
    `;
    bindStep2();
  }

  function bindStep2() {
    root.querySelector('#back-btn').onclick = () => {
      step = 1;
      render();
    };

    root.querySelector('#start-btn').onclick = () => {
      saveLastRoster(players);
      const session = createSession({ players: [...players] });
      saveSession(session);
      go('live', session);
    };
  }

  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  render();
}
