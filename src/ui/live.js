import { applyScore, removePlayer, addPlayer, recomputeFromCompleted } from '../state.js';
import { reoptimizeFrom } from '../scheduler.js';
import { createRng } from '../rng.js';
import { saveSession, clearSession } from '../persistence.js';
import { toggleDarkMode } from '../theme.js';

export function renderLive(root, go, session) {
  let state = session;
  let scoreDraft = [0, 0];
  let scheduleExpanded = false;
  let menuOpen = false;
  let editingRoundIdx = null;  // index of round currently being edited, or null
  let editTeamA = [];          // local copies during edit
  let editTeamB = [];
  let editResting = [];
  let selectedChip = null;     // { zone: 'A'|'B'|'R', index: number } of selected chip

  function currentRoundIndex() {
    return state.schedule.findIndex(r => r.status !== 'completed' && r.status !== 'skipped');
  }

  function playerName(id) {
    return state.players.find(p => p.id === id)?.name ?? id;
  }

  function persist() {
    saveSession(state);
  }

  function render() {
    const idx = currentRoundIndex();
    if (idx < 0) {
      go('summary', state);
      return;
    }
    const round = state.schedule[idx];
    const isLocked = round.status === 'locked';
    if (round.score && scoreDraft[0] === 0 && scoreDraft[1] === 0) {
      scoreDraft = [...round.score];
    }
    const nextRound = state.schedule[idx + 1];
    const restingIds = state.players
      .map(p => p.id)
      .filter(id => !round.teamA.includes(id) && !round.teamB.includes(id));

    root.innerHTML = `
      <div class="screen-header">
        <div class="title">Round ${idx + 1} of ${state.targetRounds}</div>
        <button class="icon-btn" id="menu-btn" aria-label="menu">⋯</button>
      </div>

      <div class="card">
        <div class="match-team">
          <div class="names">${escapeHtml(round.teamA.map(playerName).join(' · '))}</div>
          <div class="score">${scoreDraft[0]}</div>
        </div>
        <div class="score-controls">
          <button data-team="0" data-delta="-1">−</button>
          <button data-team="0" data-delta="1">+</button>
        </div>
        <div class="match-team" style="border-top: 1px solid var(--border-soft); margin-top: 8px;">
          <div class="names">${escapeHtml(round.teamB.map(playerName).join(' · '))}</div>
          <div class="score">${scoreDraft[1]}</div>
        </div>
        <div class="score-controls">
          <button data-team="1" data-delta="-1">−</button>
          <button data-team="1" data-delta="1">+</button>
        </div>
      </div>

      ${!isLocked ? `<button class="btn small ghost" id="start-btn" style="margin-top:8px;">Start round</button>` : ''}
      <button class="btn" id="save-btn" style="margin-top:8px;" ${scoreDraft[0] + scoreDraft[1] === 0 ? 'disabled' : ''}>
        Save &amp; next round
      </button>

      <div class="next-block">
        ${nextRound ? `Up next · ${escapeHtml(nextRound.teamA.map(playerName).join(', '))} vs ${escapeHtml(nextRound.teamB.map(playerName).join(', '))}<br>` : ''}
        Resting · ${escapeHtml(restingIds.map(playerName).join(', ')) || '—'}
      </div>

      <div class="label" id="sched-toggle" style="cursor:pointer;">
        ${scheduleExpanded ? '▾' : '▸'} Full schedule
      </div>
      ${scheduleExpanded ? `
        <div class="card schedule-list">
          ${state.schedule.map((r, i) => {
            if (editingRoundIdx === i) return editorHtml(i);
            return `
              <div class="schedule-item ${r.status} ${r.manuallyEdited ? 'edited' : ''}" data-round-idx="${i}">
                <span>R${i+1} · ${escapeHtml(r.teamA.map(playerName).join(', '))} vs ${escapeHtml(r.teamB.map(playerName).join(', '))}</span>
                <span>${r.score ? `${r.score[0]}–${r.score[1]}` : ''}</span>
              </div>
            `;
          }).join('')}
        </div>
      ` : ''}

      ${menuOpen ? menuHtml() : ''}
    `;
    bind();
  }

  function editorHtml(i) {
    const chip = (id, zone, idx) => {
      const isSelected = selectedChip && selectedChip.zone === zone && selectedChip.index === idx;
      return `<button class="player-chip ${isSelected ? 'selected' : ''}" data-zone="${zone}" data-chip-idx="${idx}">${escapeHtml(playerName(id))}</button>`;
    };
    return `
      <div class="schedule-item-editor" data-round-idx="${i}">
        <div class="editor-label">Round ${i + 1} · tap a player, then tap another to swap</div>
        <div class="editor-section">
          <div class="editor-section-label">Team A</div>
          <div class="chip-row">
            ${editTeamA.map((id, idx) => chip(id, 'A', idx)).join('')}
          </div>
        </div>
        <div class="editor-section">
          <div class="editor-section-label">Team B</div>
          <div class="chip-row">
            ${editTeamB.map((id, idx) => chip(id, 'B', idx)).join('')}
          </div>
        </div>
        <div class="editor-section">
          <div class="editor-section-label">Resting</div>
          <div class="chip-row">
            ${editResting.map((id, idx) => chip(id, 'R', idx)).join('')}
          </div>
        </div>
        <div class="editor-actions">
          <button class="btn small ghost" id="editor-cancel">Cancel</button>
          <button class="btn small" id="editor-save">Save</button>
        </div>
      </div>
    `;
  }

  function menuHtml() {
    return `
      <div class="menu-sheet" id="menu-sheet">
        <div class="menu">
          <button id="m-dark">Toggle dark mode</button>
          <button id="m-add">Add player</button>
          <button id="m-remove">Remove player</button>
          <button id="m-skip">Skip current round</button>
          <button id="m-end">End session early</button>
          <button id="m-cancel" style="color:var(--text-secondary)">Close</button>
        </div>
      </div>
    `;
  }

  function bind() {
    root.querySelectorAll('.score-controls button').forEach(btn => {
      btn.onclick = () => {
        const team = +btn.dataset.team;
        const delta = +btn.dataset.delta;
        scoreDraft[team] = Math.max(0, scoreDraft[team] + delta);
        render();
      };
    });

    const startBtn = root.querySelector('#start-btn');
    if (startBtn) {
      startBtn.onclick = () => {
        const idx = currentRoundIndex();
        state.schedule[idx].status = 'locked';
        persist();
        render();
      };
    }

    root.querySelector('#save-btn').onclick = () => {
      const idx = currentRoundIndex();
      if (scoreDraft[0] + scoreDraft[1] === 0) return;
      state = applyScore(state, idx, scoreDraft[0], scoreDraft[1]);
      const rng = createRng((state.seed + idx + 1) >>> 0);
      const reopt = reoptimizeFrom(state, idx + 2, state.weights, rng);
      state = { ...state, schedule: reopt };
      scoreDraft = [0, 0];
      persist();
      render();
    };

    root.querySelector('#menu-btn').onclick = () => { menuOpen = true; render(); };
    if (menuOpen) {
      root.querySelector('#menu-sheet').onclick = e => {
        if (e.target.id === 'menu-sheet' || e.target.id === 'm-cancel') {
          menuOpen = false; render();
        }
      };
      root.querySelector('#m-dark').onclick = () => {
        toggleDarkMode();
        menuOpen = false;
        render();
      };
      root.querySelector('#m-add').onclick = () => {
        const name = prompt('New player name?');
        if (!name || !name.trim()) { menuOpen = false; render(); return; }
        if (state.players.length >= 8) { alert('Max 8 players.'); menuOpen = false; render(); return; }
        const skillStr = prompt('Seed skill 1–5?', '3');
        const skill = Math.max(1, Math.min(5, parseInt(skillStr, 10) || 3));
        const id = `p${Date.now()}`;
        state = addPlayer(state, { id, name: name.trim(), seedSkill: skill });
        const idx = currentRoundIndex();
        const rng = createRng((state.seed + 1000) >>> 0);
        const reopt = reoptimizeFrom(state, idx + 1, state.weights, rng);
        state = { ...state, schedule: reopt };
        persist();
        menuOpen = false;
        render();
      };
      root.querySelector('#m-remove').onclick = () => {
        const names = state.players.map(p => `${p.name} (${p.id})`).join('\n');
        const id = prompt(`Remove which player?\nEnter the id in parens:\n${names}`);
        if (!id || !state.players.find(p => p.id === id.trim())) {
          menuOpen = false; render(); return;
        }
        if (state.players.length <= 6) { alert('Need at least 6 players.'); menuOpen = false; render(); return; }
        if (!confirm(`Remove ${id}?`)) { menuOpen = false; render(); return; }
        state = removePlayer(state, id.trim());
        const idx = currentRoundIndex();
        const rng = createRng((state.seed + 2000) >>> 0);
        const reopt = reoptimizeFrom(state, idx + 1, state.weights, rng);
        state = { ...state, schedule: reopt };
        persist();
        menuOpen = false;
        render();
      };
      root.querySelector('#m-skip').onclick = () => {
        if (!confirm('Skip this round? It will not count toward stats.')) {
          menuOpen = false; render(); return;
        }
        const idx = currentRoundIndex();
        state.schedule[idx].status = 'skipped';
        state.schedule[idx].score = null;
        scoreDraft = [0, 0];
        persist();
        menuOpen = false;
        render();
      };
      root.querySelector('#m-end').onclick = () => {
        if (!confirm('End the session now and view summary?')) return;
        menuOpen = false;
        go('summary', state);
      };
    }

    root.querySelector('#sched-toggle').onclick = () => {
      scheduleExpanded = !scheduleExpanded;
      render();
    };

    if (scheduleExpanded) {
      root.querySelectorAll('.schedule-item.completed').forEach(el => {
        el.onclick = () => {
          const i = +el.dataset.roundIdx;
          const r = state.schedule[i];
          const current = r.score ? `${r.score[0]}-${r.score[1]}` : '';
          const input = prompt(`Edit score for round ${i + 1} (format A-B):`, current);
          if (!input) return;
          const m = input.match(/^(\d+)\s*-\s*(\d+)$/);
          if (!m) { alert('Use format like "6-3"'); return; }
          const a = +m[1], b = +m[2];
          state.schedule[i].score = [a, b];
          state = recomputeFromCompleted(state);
          const idx = currentRoundIndex();
          const fromIdx = idx >= 0 ? idx + 1 : state.schedule.length;
          const rng = createRng((state.seed + i + 3000) >>> 0);
          const reopt = reoptimizeFrom(state, fromIdx, state.weights, rng);
          state = { ...state, schedule: reopt };
          persist();
          render();
        };
      });

      root.querySelectorAll('.schedule-item.tentative').forEach(el => {
        el.onclick = () => {
          const i = +el.dataset.roundIdx;
          const r = state.schedule[i];
          editingRoundIdx = i;
          editTeamA = [...r.teamA];
          editTeamB = [...r.teamB];
          const onCourt = [...r.teamA, ...r.teamB];
          editResting = state.players.map(p => p.id).filter(id => !onCourt.includes(id));
          selectedChip = null;
          render();
        };
      });

      if (editingRoundIdx !== null) {
        root.querySelectorAll('.player-chip').forEach(chipEl => {
          chipEl.onclick = () => {
            const zone = chipEl.dataset.zone;
            const idx = +chipEl.dataset.chipIdx;
            if (selectedChip && selectedChip.zone === zone && selectedChip.index === idx) {
              selectedChip = null;
            } else if (selectedChip) {
              // swap selectedChip with the just-tapped chip
              const zones = { A: editTeamA, B: editTeamB, R: editResting };
              const src = zones[selectedChip.zone];
              const dst = zones[zone];
              const tmp = src[selectedChip.index];
              src[selectedChip.index] = dst[idx];
              dst[idx] = tmp;
              selectedChip = null;
            } else {
              selectedChip = { zone, index: idx };
            }
            render();
          };
        });

        const cancelBtn = root.querySelector('#editor-cancel');
        if (cancelBtn) cancelBtn.onclick = () => {
          editingRoundIdx = null;
          selectedChip = null;
          render();
        };

        const saveBtn = root.querySelector('#editor-save');
        if (saveBtn) saveBtn.onclick = () => {
          const i = editingRoundIdx;
          state.schedule[i].teamA = [...editTeamA];
          state.schedule[i].teamB = [...editTeamB];
          state.schedule[i].manuallyEdited = true;
          editingRoundIdx = null;
          selectedChip = null;
          persist();
          render();
        };
      }
    }
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  render();
}
