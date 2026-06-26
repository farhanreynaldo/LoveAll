import { applyScore, removePlayer, addPlayer, recomputeFromCompleted } from '../state.js';
import { reoptimizeFrom } from '../scheduler.js';
import { createRng } from '../rng.js';
import { saveSession, clearSession } from '../persistence.js';

export function renderLive(root, go, session) {
  let state = session;
  let scoreDraft = [0, 0];
  let scheduleExpanded = true;
  let menuOpen = false;
  let menuView = 'main';       // 'main' | 'add' | 'remove' | 'skip'
  let addDraft = { name: '', skill: 2 };
  let pendingRemoveId = null;  // player id awaiting confirm in remove view
  let skipReason = '';
  let editingRoundIdx = null;  // index of round currently being edited, or null
  let editTeamA = [];          // local copies during edit
  let editTeamB = [];
  let editResting = [];
  let editLocked = false;      // whether the editing round should be saved as locked
  let selectedChip = null;     // { zone: 'A'|'B'|'R', index: number } of selected chip
  let editingScoreIdx = null;  // index of completed round whose score is being edited
  let editScoreDraft = [0, 0];
  let lastAnchoredRoundIdx = null;  // tracks which round we last scrolled to; null on first mount

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
          <div class="header-actions">
            <button class="icon-btn theme-toggle-btn" data-theme-toggle aria-label="toggle dark mode" type="button">◐</button>
            <button class="icon-btn" id="menu-btn" aria-label="menu">⋯</button>
          </div>
        </div>
        <div class="card" style="text-align:center;padding:24px;">
          <p style="color:var(--text-secondary);font-size:var(--text-control);">All scheduled rounds complete.</p>
        </div>
        <button class="btn" id="end-session-final" style="margin-top:12px;">End session &amp; see results</button>
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

    const upcomingPreview = state.schedule
      .slice(idx + 1)
      .find(r => r.status !== 'completed' && r.status !== 'skipped');
    const fullList = state.schedule;

    root.innerHTML = `
      <div class="screen-header">
        <div class="title">Round ${idx + 1}</div>
        <div class="header-actions">
          <button class="icon-btn theme-toggle-btn" data-theme-toggle aria-label="toggle dark mode" type="button">◐</button>
          <button class="icon-btn" id="menu-btn" aria-label="menu">⋯</button>
        </div>
      </div>

      <div class="label">Now playing</div>
      <div class="card card-hero">
        <div class="row">
          <span class="team-name">${escapeHtml(round.teamA.map(playerName).join(' & '))}</span>
        </div>
        <div class="match-vs">vs</div>
        <div class="row">
          <span class="team-name">${escapeHtml(round.teamB.map(playerName).join(' & '))}</span>
        </div>
      </div>
      ${idx === 0 ? `
        <p class="schedule-hint" style="margin-top:6px;">Tap R1 below to choose different starters.</p>
      ` : ''}

      ${restingIds.length > 0 ? `
        <div class="label">Resting</div>
        <div class="card">
          <div class="row" style="border-bottom:none;padding:10px 4px;">
            <span style="font-size:var(--text-control);color:var(--text-secondary);">${escapeHtml(restingIds.map(playerName).join(', '))}</span>
          </div>
        </div>
      ` : ''}

      <div class="label">Final score</div>
      <div class="card score-card">
        <label class="match-team">
          <span class="team-name score-team-name">${escapeHtml(round.teamA.map(playerName).join(' & '))}</span>
          <input type="number" inputmode="numeric" pattern="[0-9]*" min="0" class="score-input${scoreDraft[0] === 0 ? ' is-empty' : ''}" data-team="0" value="${scoreDraft[0]}" aria-label="Score for ${escapeHtml(round.teamA.map(playerName).join(' and '))}" />
        </label>
        <label class="match-team">
          <span class="team-name score-team-name">${escapeHtml(round.teamB.map(playerName).join(' & '))}</span>
          <input type="number" inputmode="numeric" pattern="[0-9]*" min="0" class="score-input${scoreDraft[1] === 0 ? ' is-empty' : ''}" data-team="1" value="${scoreDraft[1]}" aria-label="Score for ${escapeHtml(round.teamB.map(playerName).join(' and '))}" />
        </label>
      </div>

      <button class="btn" id="save-btn" style="margin-top:8px;"
        ${scoreDraft[0] + scoreDraft[1] === 0 ? 'disabled' : ''}>
        Save &amp; next round →
      </button>
      <div class="inline-action-row">
        <button class="text-link quiet" id="skip-round-link" type="button">
          Skip this round
        </button>
      </div>

      ${fullList.length > 0 ? `
        <div class="label">Schedule</div>
        <p class="schedule-hint">
          Tap any round to edit
          <span class="schedule-hint-sep" aria-hidden="true">·</span>
          <button class="text-link" id="schedule-toggle" type="button">
            ${scheduleExpanded ? 'Collapse ▴' : 'Show all ▾'}
          </button>
        </p>
        <div class="card" style="padding:4px 12px;" id="schedule-card">
          ${scheduleExpanded
            ? fullList.map((r, realIdx) => {
                if (editingScoreIdx === realIdx) {
                  return scoreEditorHtml(realIdx);
                }
                if (editingRoundIdx === realIdx) {
                  return editorHtml(realIdx);
                }
                return scheduleRowHtml(r, realIdx, realIdx === idx);
              }).join('')
            : (upcomingPreview ? (() => {
                const realIdx0 = state.schedule.indexOf(upcomingPreview);
                return `<div class="schedule-item" style="opacity:0.6;font-size:var(--text-meta);">
                  R${realIdx0 + 1} · ${escapeHtml(upcomingPreview.teamA.map(playerName).join('/'))} vs ${escapeHtml(upcomingPreview.teamB.map(playerName).join('/'))}
                </div>`;
              })() : `<div class="schedule-item" style="opacity:0.6;font-size:var(--text-meta);">No upcoming rounds</div>`)
          }
        </div>
      ` : ''}

      ${menuOpen ? menuHtml() : ''}
    `;
    bind();
    anchorCurrentRound(idx);
  }

  // Bring the active round into view, but only when it actually changed
  // (so typing into the score input doesn't repeatedly trigger scroll).
  // `block: 'nearest'` is a no-op when the row is already visible, so we
  // never yank the page away from Now Playing unnecessarily.
  function anchorCurrentRound(idx) {
    if (idx < 0) { lastAnchoredRoundIdx = idx; return; }
    const changed = lastAnchoredRoundIdx !== null && lastAnchoredRoundIdx !== idx;
    lastAnchoredRoundIdx = idx;
    if (!changed) return;
    const row = root.querySelector(`.schedule-item.is-current[data-round-idx="${idx}"]`);
    if (!row) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    row.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' });
  }

  function scheduleRowHtml(r, realIdx, isCurrent) {
    const roundNum = realIdx + 1;
    const teams = `${escapeHtml(r.teamA.map(playerName).join('/'))} vs ${escapeHtml(r.teamB.map(playerName).join('/'))}`;
    const isCompleted = r.status === 'completed';
    const isSkipped = r.status === 'skipped';
    const isLocked = r.status === 'locked';
    const isPlanned = r.status === 'tentative' || isLocked;
    const isEditable = isCompleted || isPlanned;
    const tag = isCurrent ? '· now ' : '';
    const scoreLabel = isCompleted && r.score ? ` · ${r.score[0]}:${r.score[1]}` : '';
    const skipLabel = isSkipped ? (r.skipReason ? ` (skipped: ${escapeHtml(r.skipReason)})` : ' (skipped)') : '';
    const editedClass = r.manuallyEdited ? ' edited' : '';
    const showAffordance = isEditable && !isCurrent;
    const chevronSvg = `<svg class="schedule-item-affordance" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-label="edit players" role="img"><path d="M9 6l6 6-6 6"/></svg>`;
    const pencilSvg = `<svg class="schedule-item-affordance edit" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-label="edit score" role="img"><path d="M14.5 4.5l5 5"/><path d="M16 3l5 5-11 11H5v-5z"/></svg>`;
    const affordanceGlyph = showAffordance
      ? (isCompleted ? pencilSvg : chevronSvg)
      : '';
    return `
      <div class="schedule-item ${r.status}${editedClass}${showAffordance ? ' editable' : ''}${isCurrent ? ' is-current' : ''}" data-round-idx="${realIdx}" data-action="${isCompleted ? 'edit-score' : (isPlanned ? 'edit-players' : '')}">
        <span>R${roundNum} ${tag}· ${teams}${scoreLabel}${skipLabel}</span>
        ${affordanceGlyph}
      </div>
    `;
  }

  function scoreEditorHtml(i) {
    const r = state.schedule[i];
    return `
      <div class="schedule-item-editor" data-round-idx="${i}">
        <div class="editor-label">Round ${i + 1} · edit final score</div>
        <div class="match-team">
          <div class="editor-team-name">${escapeHtml(r.teamA.map(playerName).join(' & '))}</div>
          <input type="number" inputmode="numeric" pattern="[0-9]*" min="0" class="score-input edit-score-input" data-team="0" value="${editScoreDraft[0]}" />
        </div>
        <div class="match-team" style="border-top:1px solid var(--border-soft);">
          <div class="editor-team-name">${escapeHtml(r.teamB.map(playerName).join(' & '))}</div>
          <input type="number" inputmode="numeric" pattern="[0-9]*" min="0" class="score-input edit-score-input" data-team="1" value="${editScoreDraft[1]}" />
        </div>
        <div class="editor-actions">
          <button class="btn small ghost" id="score-edit-cancel">Cancel</button>
          <button class="btn small" id="score-edit-save">Save</button>
        </div>
      </div>
    `;
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
        <div class="editor-lock-row">
          <button class="player-chip ${editLocked ? 'selected' : ''}" id="editor-lock" type="button">
            ${editLocked ? 'Locked: re-optimize won\'t touch this round' : 'Lock this round'}
          </button>
        </div>
        <div class="editor-actions">
          <button class="btn small ghost" id="editor-cancel">Cancel</button>
          <button class="btn small" id="editor-save">Save</button>
        </div>
      </div>
    `;
  }

  function menuHtml() {
    let inner;
    if (menuView === 'add') inner = addViewHtml();
    else if (menuView === 'remove') inner = removeViewHtml();
    else if (menuView === 'skip') inner = skipViewHtml();
    else inner = mainMenuHtml();
    return `<div class="menu-sheet" id="menu-sheet"><div class="menu">${inner}</div></div>`;
  }

  function mainMenuHtml() {
    return `
      <button id="end-session-btn">End session</button>
      <button id="m-add">Add player</button>
      <button id="m-remove">Remove player</button>
      <button id="m-settings">Fairness settings</button>
      <button id="m-cancel" style="color:var(--text-secondary)">Close</button>
    `;
  }

  function addViewHtml() {
    const skillSeg = [1,2,3].map(n =>
      `<button type="button" class="segment ${addDraft.skill === n ? 'is-active' : ''}" role="radio" aria-checked="${addDraft.skill === n}" data-add-skill="${n}">${({1:'Low',2:'Mid',3:'High'})[n]}</button>`
    ).join('');
    const atMax = state.players.length >= 12;
    return `
      <div class="sheet-view">
        <div class="sheet-header">
          <button class="sheet-back" id="sheet-back" aria-label="back">←</button>
          <div class="sheet-title">Add player</div>
        </div>
        ${atMax ? `<p class="sheet-hint">Roster is full (12 maximum).</p>` : ''}
        <input type="text" id="add-name" placeholder="Player name" value="${escapeHtml(addDraft.name)}" autocomplete="off" ${atMax ? 'disabled' : ''} />
        <div class="sheet-row">
          <span class="sheet-row-label">Skill</span>
          <div class="segmented compact skill-seg" id="add-skill-seg" role="radiogroup" aria-label="Skill level">${skillSeg}</div>
        </div>
        <div class="sheet-actions">
          <button class="btn ghost small" id="add-cancel">Cancel</button>
          <button class="btn small" id="add-save" ${atMax || !addDraft.name.trim() ? 'disabled' : ''}>Add</button>
        </div>
      </div>
    `;
  }

  function removeViewHtml() {
    const tooFew = state.players.length <= 4;
    const pending = pendingRemoveId ? state.players.find(p => p.id === pendingRemoveId) : null;
    return `
      <div class="sheet-view">
        <div class="sheet-header">
          <button class="sheet-back" id="sheet-back" aria-label="back">←</button>
          <div class="sheet-title">Remove player</div>
        </div>
        ${tooFew ? `<p class="sheet-hint">Need at least 4 players. Add someone first.</p>` : ''}
        ${pending ? `
          <p class="sheet-hint">Remove <strong>${escapeHtml(pending.name)}</strong>? Their stats will be dropped from this session.</p>
          <div class="sheet-actions">
            <button class="btn ghost small" id="remove-cancel">Cancel</button>
            <button class="btn small" id="remove-confirm">Remove</button>
          </div>
        ` : `
          <div class="chip-row" style="padding:4px 0;">
            ${state.players.map(p =>
              `<button class="player-chip" data-remove-id="${p.id}" ${tooFew ? 'disabled' : ''}>${escapeHtml(p.name)}</button>`
            ).join('')}
          </div>
          <div class="sheet-actions">
            <button class="btn ghost small" id="remove-back">Done</button>
          </div>
        `}
      </div>
    `;
  }

  function skipViewHtml() {
    const idx = currentRoundIndex();
    if (idx < 0) {
      return `
        <div class="sheet-view">
          <div class="sheet-header">
            <button class="sheet-back" id="sheet-back" aria-label="back">←</button>
            <div class="sheet-title">Skip round</div>
          </div>
          <p class="sheet-hint">No active round to skip.</p>
          <div class="sheet-actions">
            <button class="btn ghost small" id="skip-cancel">Close</button>
          </div>
        </div>
      `;
    }
    return `
      <div class="sheet-view">
        <div class="sheet-header">
          <button class="sheet-back" id="sheet-back" aria-label="back">←</button>
          <div class="sheet-title">Skip round ${idx + 1}?</div>
        </div>
        <p class="sheet-hint">Useful when someone's running late. We'll add a fresh round at the end so everyone still gets the same number of games.</p>
        <input type="text" id="skip-reason" placeholder="Reason (optional)" value="${escapeHtml(skipReason)}" autocomplete="off" />
        <div class="sheet-actions">
          <button class="btn ghost small" id="skip-cancel">Cancel</button>
          <button class="btn small" id="skip-confirm">Skip and shuffle</button>
        </div>
      </div>
    `;
  }

  function bindMenu() {
    const closeMenu = () => { menuOpen = false; menuView = 'main'; pendingRemoveId = null; render(); };

    root.querySelector('#menu-sheet').onclick = e => {
      if (e.target.id === 'menu-sheet') closeMenu();
    };
    const back = root.querySelector('#sheet-back');
    if (back) back.onclick = () => { menuView = 'main'; pendingRemoveId = null; render(); };

    if (menuView === 'main') {
      const endBtn = root.querySelector('#end-session-btn');
      if (endBtn) endBtn.onclick = () => { menuOpen = false; go('summary', state); };
      root.querySelector('#m-cancel').onclick = closeMenu;
      root.querySelector('#m-add').onclick = () => { menuView = 'add'; render(); };
      root.querySelector('#m-remove').onclick = () => { menuView = 'remove'; render(); };
      root.querySelector('#m-settings').onclick = () => { menuOpen = false; go('settings', state); };
      return;
    }

    if (menuView === 'add') {
      const nameInput = root.querySelector('#add-name');
      if (nameInput) {
        nameInput.oninput = e => {
          addDraft.name = e.target.value;
          const saveBtn = root.querySelector('#add-save');
          if (saveBtn) saveBtn.disabled = !addDraft.name.trim() || state.players.length >= 12;
        };
      }
      root.querySelectorAll('#add-skill-seg .segment[data-add-skill]').forEach(seg => {
        seg.onclick = () => {
          addDraft.skill = +seg.dataset.addSkill;
          render();
          root.querySelector('#add-name')?.focus();
        };
      });
      root.querySelector('#add-cancel').onclick = () => { menuView = 'main'; render(); };
      const saveBtn = root.querySelector('#add-save');
      if (saveBtn) {
        saveBtn.onclick = () => {
          const name = addDraft.name.trim();
          if (!name || state.players.length >= 12) return;
          const id = `p${Date.now()}`;
          state = addPlayer(state, { id, name, seedSkill: addDraft.skill });
          const idx = currentRoundIndex();
          const rng = createRng((state.seed + 1000) >>> 0);
          const reopt = reoptimizeFrom(state, idx + 1, state.weights, rng);
          state = { ...state, schedule: reopt };
          persist();
          closeMenu();
        };
      }
      return;
    }

    if (menuView === 'remove') {
      root.querySelectorAll('[data-remove-id]').forEach(btn => {
        btn.onclick = () => {
          pendingRemoveId = btn.dataset.removeId;
          render();
        };
      });
      const backBtn = root.querySelector('#remove-back');
      if (backBtn) backBtn.onclick = () => { menuView = 'main'; render(); };
      const cancelBtn = root.querySelector('#remove-cancel');
      if (cancelBtn) cancelBtn.onclick = () => { pendingRemoveId = null; render(); };
      const confirmBtn = root.querySelector('#remove-confirm');
      if (confirmBtn) {
        confirmBtn.onclick = () => {
          if (!pendingRemoveId || state.players.length <= 4) return;
          state = removePlayer(state, pendingRemoveId);
          const idx = currentRoundIndex();
          const rng = createRng((state.seed + 2000) >>> 0);
          const reopt = reoptimizeFrom(state, idx + 1, state.weights, rng);
          state = { ...state, schedule: reopt };
          persist();
          closeMenu();
        };
      }
      return;
    }

    if (menuView === 'skip') {
      const reasonInput = root.querySelector('#skip-reason');
      if (reasonInput) {
        reasonInput.oninput = e => { skipReason = e.target.value; };
      }
      root.querySelector('#skip-cancel').onclick = () => { menuView = 'main'; render(); };
      const confirmBtn = root.querySelector('#skip-confirm');
      if (confirmBtn) {
        confirmBtn.onclick = () => {
          const idx = currentRoundIndex();
          if (idx < 0) { closeMenu(); return; }
          const reason = skipReason.trim() || null;
          const newSchedule = state.schedule.map((r, i) =>
            i === idx ? { ...r, status: 'skipped', score: null, skipReason: reason } : r
          );
          // Append a placeholder tentative round; reoptimizeFrom will replace
          // it with a fair matchup, naturally favoring players who missed the
          // skipped round (lower roundsPlayed → lower cost).
          const ids = state.players.map(p => p.id);
          const placeholder = state.format === 'singles'
            ? { teamA: ids.slice(0, 1), teamB: ids.slice(1, 2) }
            : { teamA: ids.slice(0, 2), teamB: ids.slice(2, 4) };
          newSchedule.push({
            ...placeholder,
            status: 'tentative',
            score: null,
            manuallyEdited: false,
          });
          const rng = createRng((state.seed + 3000) >>> 0);
          const reopt = reoptimizeFrom({ ...state, schedule: newSchedule }, idx + 1, state.weights, rng);
          state = { ...state, schedule: reopt };
          scoreDraft = [0, 0];
          persist();
          closeMenu();
        };
      }
      return;
    }
  }

  function bind() {
    // Score inputs (current round)
    root.querySelectorAll('.score-input[data-team]:not(.edit-score-input)').forEach(inp => {
      inp.oninput = e => {
        const team = +e.target.dataset.team;
        const v = parseInt(e.target.value, 10);
        scoreDraft[team] = Number.isNaN(v) ? 0 : Math.max(0, v);
        e.target.classList.toggle('is-empty', scoreDraft[team] === 0);
        const saveBtn = root.querySelector('#save-btn');
        if (saveBtn) saveBtn.disabled = scoreDraft[0] + scoreDraft[1] === 0;
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
      menuBtn.onclick = () => {
        menuOpen = true;
        menuView = 'main';
        addDraft = { name: '', skill: 2 };
        pendingRemoveId = null;
        skipReason = '';
        render();
      };
    }

    // Inline skip-round entry point (opens the same skip sheet as the menu)
    const skipLink = root.querySelector('#skip-round-link');
    if (skipLink) {
      skipLink.onclick = () => {
        menuOpen = true;
        menuView = 'skip';
        skipReason = '';
        render();
      };
    }

    // End session button on completed screen
    const endFinalBtn = root.querySelector('#end-session-final');
    if (endFinalBtn) endFinalBtn.onclick = () => go('summary', state);

    if (menuOpen) bindMenu();

    // Open inline editor for tentative or locked rounds (player swap + lock)
    root.querySelectorAll('.schedule-item[data-action="edit-players"]').forEach(item => {
      item.onclick = () => {
        const i = +item.dataset.roundIdx;
        const r = state.schedule[i];
        editingRoundIdx = i;
        editingScoreIdx = null;
        editTeamA = [...r.teamA];
        editTeamB = [...r.teamB];
        editResting = state.players.map(p => p.id).filter(id => !r.teamA.includes(id) && !r.teamB.includes(id));
        editLocked = r.status === 'locked';
        selectedChip = null;
        render();
      };
    });

    // Open inline score editor for completed rounds
    root.querySelectorAll('.schedule-item[data-action="edit-score"]').forEach(item => {
      item.onclick = () => {
        const i = +item.dataset.roundIdx;
        const r = state.schedule[i];
        editingScoreIdx = i;
        editingRoundIdx = null;
        editScoreDraft = r.score ? [...r.score] : [0, 0];
        render();
      };
    });

    // Score-edit inputs
    root.querySelectorAll('.edit-score-input').forEach(inp => {
      inp.oninput = e => {
        const team = +e.target.dataset.team;
        const v = parseInt(e.target.value, 10);
        editScoreDraft[team] = Number.isNaN(v) ? 0 : Math.max(0, v);
      };
    });

    const scoreCancel = root.querySelector('#score-edit-cancel');
    if (scoreCancel) {
      scoreCancel.onclick = () => {
        editingScoreIdx = null;
        render();
      };
    }

    const scoreSave = root.querySelector('#score-edit-save');
    if (scoreSave) {
      scoreSave.onclick = () => {
        const i = editingScoreIdx;
        if (editScoreDraft[0] + editScoreDraft[1] === 0) {
          alert('Score cannot be 0–0.');
          return;
        }
        const patched = state.schedule.map((r, j) =>
          j === i ? { ...r, status: 'completed', score: [editScoreDraft[0], editScoreDraft[1]] } : r
        );
        state = recomputeFromCompleted({ ...state, schedule: patched });
        persist();
        editingScoreIdx = null;
        render();
      };
    }

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

    // Lock toggle inside the player-edit editor
    const lockBtn = root.querySelector('#editor-lock');
    if (lockBtn) {
      lockBtn.onclick = () => { editLocked = !editLocked; render(); };
    }

    // Save inline editor
    const saveEditBtn = root.querySelector('#editor-save');
    if (saveEditBtn) {
      saveEditBtn.onclick = () => {
        const i = editingRoundIdx;
        const newStatus = editLocked ? 'locked' : 'tentative';
        const patchedSchedule = state.schedule.map((r, j) =>
          j === i ? { ...r, teamA: [...editTeamA], teamB: [...editTeamB], status: newStatus, manuallyEdited: true } : r
        );
        const rng = createRng((state.seed + i + 5000) >>> 0);
        const reopt = reoptimizeFrom({ ...state, schedule: patchedSchedule }, i + 1, state.weights, rng);
        state = { ...state, schedule: reopt };
        persist();
        editingRoundIdx = null;
        editLocked = false;
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
