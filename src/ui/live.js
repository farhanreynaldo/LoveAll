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
    const round = state.schedule[idx];

    // No auto-navigate — session ends via "End Session" in menu only.
    if (idx < 0) {
      root.innerHTML = `
        <div class="screen-header">
          <div class="title">Session</div>
          <button class="icon-btn" id="menu-btn" aria-label="menu">⋯</button>
        </div>
        <div class="card" style="text-align:center;padding:24px;">
          <p style="color:var(--text-secondary);font-size:14px;">All scheduled rounds complete.</p>
          <p style="color:var(--text-secondary);font-size:13px;margin-top:8px;">Tap ⋯ to end the session.</p>
        </div>
        ${menuOpen ? menuHtml() : ''}
      `;
      bind();
      return;
    }

    if (round.score && scoreDraft[0] === 0 && scoreDraft[1] === 0) {
      scoreDraft = [...round.score];
    }

    const restingIds = state.players
      .map(p => p.id)
      .filter(id => !round.teamA.includes(id) && !round.teamB.includes(id));

    const upcoming = state.schedule
      .slice(idx + 1)
      .filter(r => r.status !== 'completed' && r.status !== 'skipped')
      .slice(0, 5);

    root.innerHTML = `
      <div class="screen-header">
        <div class="title">Round ${idx + 1}</div>
        <button class="icon-btn" id="menu-btn" aria-label="menu">⋯</button>
      </div>

      <div class="label">Now playing</div>
      <div class="card">
        <div class="row" style="padding:10px 4px;">
          <span style="font-size:15px;font-weight:500;">${escapeHtml(round.teamA.map(playerName).join(' · '))}</span>
        </div>
        <div style="padding:2px 4px;color:var(--text-secondary);font-size:13px;">vs</div>
        <div class="row" style="padding:10px 4px;border-bottom:none;">
          <span style="font-size:15px;font-weight:500;">${escapeHtml(round.teamB.map(playerName).join(' · '))}</span>
        </div>
      </div>

      ${restingIds.length > 0 ? `
        <div class="label">Resting</div>
        <div class="card">
          <div class="row" style="border-bottom:none;padding:10px 4px;">
            <span style="font-size:14px;color:var(--text-secondary);">${escapeHtml(restingIds.map(playerName).join(' · '))}</span>
          </div>
        </div>
      ` : ''}

      <div class="label">Game done? Enter final score</div>
      <div class="card">
        <div class="match-team">
          <div>
            <div style="font-size:11px;color:var(--text-secondary);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">
              ${escapeHtml(round.teamA.map(playerName).join(' · '))}
            </div>
            <div class="score">${scoreDraft[0]}</div>
          </div>
        </div>
        <div class="score-controls">
          <button data-team="0" data-delta="-1">−</button>
          <button data-team="0" data-delta="1">+</button>
        </div>
        <div class="match-team" style="border-top:1px solid var(--border-soft);margin-top:8px;">
          <div>
            <div style="font-size:11px;color:var(--text-secondary);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">
              ${escapeHtml(round.teamB.map(playerName).join(' · '))}
            </div>
            <div class="score">${scoreDraft[1]}</div>
          </div>
        </div>
        <div class="score-controls">
          <button data-team="1" data-delta="-1">−</button>
          <button data-team="1" data-delta="1">+</button>
        </div>
      </div>

      <button class="btn" id="save-btn" style="margin-top:8px;"
        ${scoreDraft[0] + scoreDraft[1] === 0 ? 'disabled' : ''}>
        Save &amp; next round →
      </button>

      ${upcoming.length > 0 ? `
        <div class="label" id="schedule-toggle" style="cursor:pointer;display:flex;justify-content:space-between;">
          <span>Upcoming rounds</span>
          <span>${scheduleExpanded ? '▴' : '▾'}</span>
        </div>
        <div class="card" style="padding:4px 12px;" id="schedule-card">
          ${scheduleExpanded
            ? upcoming.map((r, i) => {
                const realIdx = state.schedule.indexOf(r);
                const roundNum = realIdx + 1;
                if (editingRoundIdx === realIdx) {
                  return editorHtml(realIdx);
                }
                return `
                  <div class="schedule-item ${r.status}" data-round-idx="${realIdx}" style="cursor:${r.status === 'tentative' ? 'pointer' : 'default'};">
                    <span>R${roundNum} · ${escapeHtml(r.teamA.map(playerName).join('/'))} vs ${escapeHtml(r.teamB.map(playerName).join('/'))}</span>
                  </div>
                `;
              }).join('')
            : (() => {
                const realIdx0 = state.schedule.indexOf(upcoming[0]);
                return `<div class="schedule-item" style="opacity:0.6;font-size:13px;">
                  R${realIdx0 + 1} · ${escapeHtml(upcoming[0].teamA.map(playerName).join('/'))} vs ${escapeHtml(upcoming[0].teamB.map(playerName).join('/'))}
                </div>`;
              })()
          }
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
          <button id="end-session-btn">End session</button>
          <button id="m-dark">Toggle dark mode</button>
          <button id="m-add">Add player</button>
          <button id="m-remove">Remove player</button>
          <button id="m-skip">Skip current round</button>
          <button id="m-settings">Fairness settings</button>
          <button id="m-cancel" style="color:var(--text-secondary)">Close</button>
        </div>
      </div>
    `;
  }

  function bind() {
    // Score controls
    root.querySelectorAll('[data-delta]').forEach(btn => {
      btn.onclick = () => {
        const team = +btn.dataset.team;
        const delta = +btn.dataset.delta;
        scoreDraft[team] = Math.max(0, scoreDraft[team] + delta);
        render();
      };
    });

    // Save & next
    const saveBtn = root.querySelector('#save-btn');
    if (saveBtn) {
      saveBtn.onclick = () => {
        const idx = currentRoundIndex();
        if (idx < 0) return;
        state = applyScore(state, idx, scoreDraft[0], scoreDraft[1]);
        const newIdx = currentRoundIndex();
        const rng = createRng((state.seed + idx + 1) >>> 0);
        const reopt = reoptimizeFrom(state, newIdx + 1, state.weights, rng);
        state = { ...state, schedule: reopt };
        scoreDraft = [0, 0];
        persist();
        render();
      };
    }

    // Schedule toggle
    const toggle = root.querySelector('#schedule-toggle');
    if (toggle) {
      toggle.onclick = () => {
        scheduleExpanded = !scheduleExpanded;
        render();
      };
    }

    // Menu open
    const menuBtn = root.querySelector('#menu-btn');
    if (menuBtn) {
      menuBtn.onclick = () => { menuOpen = true; render(); };
    }

    // Menu interactions (when open)
    if (menuOpen) {
      // End session
      const endBtn = root.querySelector('#end-session-btn');
      if (endBtn) endBtn.onclick = () => { menuOpen = false; go('summary', state); };

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
        if (state.players.length >= 12) { alert('Max 12 players.'); menuOpen = false; render(); return; }
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
        if (state.players.length <= 4) { alert('Need at least 4 players.'); menuOpen = false; render(); return; }
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
      root.querySelector('#m-settings').onclick = () => {
        menuOpen = false;
        go('settings', state);
      };
    }

    // Open inline editor for tentative upcoming rounds
    root.querySelectorAll('.schedule-item.tentative[data-round-idx]').forEach(item => {
      item.onclick = () => {
        const i = +item.dataset.roundIdx;
        const r = state.schedule[i];
        editingRoundIdx = i;
        editTeamA = [...r.teamA];
        editTeamB = [...r.teamB];
        editResting = state.players.map(p => p.id).filter(id => !r.teamA.includes(id) && !r.teamB.includes(id));
        selectedChip = null;
        render();
      };
    });

    // Player chip tap — select or swap
    root.querySelectorAll('.player-chip[data-zone]').forEach(chip => {
      chip.onclick = () => {
        const zone = chip.dataset.zone;
        const chipIdx = +chip.dataset.chipIdx;
        if (!selectedChip) {
          selectedChip = { zone, index: chipIdx };
          render();
          return;
        }
        // Tapping the same chip deselects
        if (selectedChip.zone === zone && selectedChip.index === chipIdx) {
          selectedChip = null;
          render();
          return;
        }
        // Swap the two players
        const zoneArrays = { A: editTeamA, B: editTeamB, R: editResting };
        const fromArr = zoneArrays[selectedChip.zone];
        const toArr = zoneArrays[zone];
        const fromId = fromArr[selectedChip.index];
        const toId = toArr[chipIdx];
        fromArr[selectedChip.index] = toId;
        toArr[chipIdx] = fromId;
        selectedChip = null;
        render();
      };
    });

    // Cancel inline editor
    const cancelEditBtn = root.querySelector('#editor-cancel');
    if (cancelEditBtn) {
      cancelEditBtn.onclick = () => {
        editingRoundIdx = null;
        selectedChip = null;
        render();
      };
    }

    // Save inline editor
    const saveEditBtn = root.querySelector('#editor-save');
    if (saveEditBtn) {
      saveEditBtn.onclick = () => {
        const i = editingRoundIdx;
        const patchedSchedule = state.schedule.map((r, j) =>
          j === i ? { ...r, teamA: [...editTeamA], teamB: [...editTeamB], manuallyEdited: true } : r
        );
        const rng = createRng((state.seed + i + 5000) >>> 0);
        const reopt = reoptimizeFrom({ ...state, schedule: patchedSchedule }, i + 1, state.weights, rng);
        state = { ...state, schedule: reopt };
        persist();
        editingRoundIdx = null;
        selectedChip = null;
        render();
      };
    }
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  render();
}
