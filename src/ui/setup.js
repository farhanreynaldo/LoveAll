import { createSession } from '../state.js';
import { saveSession } from '../persistence.js';

const MIN_PLAYERS = 6;
const MAX_PLAYERS = 8;
const MIN_ROUNDS = 4;
const MAX_ROUNDS = 20;

export function renderSetup(root, go) {
  const players = [];   // { id, name, seedSkill }
  let targetRounds = 10;
  let nextIdCounter = 1;

  function genId() {
    return `p${nextIdCounter++}`;
  }

  function render() {
    root.innerHTML = `
      <div class="screen-header">
        <div class="title">New session</div>
        <button class="icon-btn" id="close-btn" aria-label="close">×</button>
      </div>

      <div class="label">Players · ${players.length}</div>
      <div class="card" id="players-card" style="padding: 4px 12px;">
        ${players.length === 0 ? '<div class="row" style="color:var(--text-secondary)">No players yet</div>' : ''}
        ${players.map((p, i) => `
          <div class="row" data-player-idx="${i}">
            <input type="text" class="player-name" value="${escapeHtml(p.name)}" data-idx="${i}" style="border:none;background:transparent;flex:1;padding:0;font-size:15px;" />
            <div class="skill-dots" data-idx="${i}">
              ${[1,2,3,4,5].map(n =>
                `<span class="dot ${p.seedSkill >= n ? 'filled' : ''}" data-skill="${n}"></span>`
              ).join('')}
            </div>
            <button class="icon-btn remove-btn" data-idx="${i}" aria-label="remove" style="font-size:16px;color:var(--text-secondary);">×</button>
          </div>
        `).join('')}
      </div>

      <form id="add-form" style="display:flex; gap:6px; margin-top:12px;">
        <input type="text" id="new-name" placeholder="Add player…" autocomplete="off" />
        <button class="btn small" type="submit" ${players.length >= MAX_PLAYERS ? 'disabled' : ''}>+</button>
      </form>

      <div class="label">Target rounds</div>
      <div class="card" style="display:flex; justify-content:space-between; align-items:center;">
        <span>Rounds in session</span>
        <div class="stepper">
          <button id="rounds-down" aria-label="fewer rounds">−</button>
          <span class="val" id="rounds-val">${targetRounds}</span>
          <button id="rounds-up" aria-label="more rounds">+</button>
        </div>
      </div>

      <button class="btn" id="start-btn" style="margin-top:18px;" ${players.length < MIN_PLAYERS ? 'disabled' : ''}>
        Start session${players.length < MIN_PLAYERS ? ` (need ${MIN_PLAYERS - players.length} more)` : ''}
      </button>
    `;
    bind();
  }

  function bind() {
    root.querySelector('#close-btn').onclick = () => {
      players.length = 0;
      render();
    };

    root.querySelector('#add-form').onsubmit = e => {
      e.preventDefault();
      const input = root.querySelector('#new-name');
      const name = input.value.trim();
      if (!name) return;
      if (players.length >= MAX_PLAYERS) {
        alert(`Max ${MAX_PLAYERS} players for single-court v1.`);
        return;
      }
      players.push({ id: genId(), name, seedSkill: 3 });
      input.value = '';
      render();
      root.querySelector('#new-name').focus();
    };

    root.querySelectorAll('.player-name').forEach(inp => {
      inp.oninput = e => {
        const i = +e.target.dataset.idx;
        players[i].name = e.target.value;
      };
    });

    root.querySelectorAll('.skill-dots').forEach(dots => {
      dots.onclick = e => {
        if (!e.target.classList.contains('dot')) return;
        const i = +dots.dataset.idx;
        const skill = +e.target.dataset.skill;
        players[i].seedSkill = skill;
        render();
      };
    });

    root.querySelectorAll('.remove-btn').forEach(btn => {
      btn.onclick = () => {
        const i = +btn.dataset.idx;
        players.splice(i, 1);
        render();
      };
    });

    root.querySelector('#rounds-down').onclick = () => {
      if (targetRounds > MIN_ROUNDS) targetRounds--;
      render();
    };
    root.querySelector('#rounds-up').onclick = () => {
      if (targetRounds < MAX_ROUNDS) targetRounds++;
      render();
    };

    root.querySelector('#start-btn').onclick = () => {
      if (players.length < MIN_PLAYERS) return;
      const session = createSession({ players: [...players], targetRounds });
      saveSession(session);
      go('live', session);
    };
  }

  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  render();
}
