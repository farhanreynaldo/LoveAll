import {
  addAdaptivePlayer, cancelAdaptiveMatch, completeAdaptiveMatch,
  editAdaptiveScore, explainAdaptiveMatch, setAttendance, startAdaptiveMatch,
  setAdaptiveMatch,
} from '../adaptive-session.js';
import { saveSession, appendLocalHistory } from '../persistence.js';
import { saveHistory } from '../sync.js';
import { WORKER_URL } from '../config.js';
import { buildStandings } from '../recap-card.js';
import { track } from '../funnel.js';

const escapeHtml = value => String(value).replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function renderAdaptiveLive(root, go, initial) {
  let state = initial;
  let score = [0, 0];
  let editIndex = null;
  let editScore = [0, 0];
  let ending = false;
  let editingMatch = false;
  let error = '';

  const name = id => state.players.find(p => p.id === id)?.name ?? id;
  const active = () => state.schedule.at(-1)?.status === 'in_progress';
  const save = next => {
    state = next;
    saveSession(state);
    error = '';
    render();
  };
  const act = fn => {
    try { fn(); } catch (e) { error = e.message; render(); }
  };

  function endSession() {
    const endedAt = Date.now();
    state = { ...state, endedAt };
    saveSession(state);
    const entry = { id: crypto.randomUUID(), completedAt: endedAt, groupId: state.groupId, groupName: state.groupName, standings: buildStandings(state).ranked };
    appendLocalHistory(entry);
    track('session_completed', { format: 'doubles', matches: state.schedule.filter(r => r.status === 'completed').length });
    saveHistory(WORKER_URL, entry);
    go('summary', state);
  }

  function render() {
    const last = state.schedule.at(-1);
    const round = last?.status === 'completed' ? null : last;
    const playing = round ? new Set([...round.teamA, ...round.teamB]) : new Set();
    const ready = state.players.filter(p => state.availability[p.id] === 'ready');
    const rosterFull = state.players.filter(p => state.availability[p.id] !== 'left').length >= 12;
    const waiting = ready.filter(p => !playing.has(p.id));
    const completed = state.schedule.map((r, i) => ({ ...r, index: i })).filter(r => r.status === 'completed');
    const roundNumber = completed.length + 1;

    root.innerHTML = `
      <div class="screen-header">
        <div class="title">Session</div>
        <div class="header-actions">
          <button class="icon-btn theme-toggle-btn" data-theme-toggle aria-label="toggle dark mode" type="button">◐</button>
        </div>
      </div>

      <h1 class="adaptive-heading">${round ? (active() ? 'On court' : 'Next matchup') : 'Waiting for players'}</h1>
      <p class="adaptive-context">${round ? `Round ${roundNumber}` : `${ready.length} available. Four are needed for doubles.`}</p>

      ${round ? `
        <div class="card adaptive-match" aria-label="Current matchup">
          <div class="adaptive-team">${escapeHtml(round.teamA.map(name).join(' and '))}</div>
          <div class="adaptive-versus">vs</div>
          <div class="adaptive-team">${escapeHtml(round.teamB.map(name).join(' and '))}</div>
        </div>
        <p class="adaptive-reason">${escapeHtml(explainAdaptiveMatch(state))}</p>
        ${!active() ? `<button class="text-link adaptive-secondary" id="adaptive-change" type="button">Change matchup</button>
          ${editingMatch ? `<form id="adaptive-lineup" class="card adaptive-lineup">
            <p>Choose two players for each team.</p>
            ${[...round.teamA, ...round.teamB].map((id, i) => `<label>${i < 2 ? 'Team 1' : 'Team 2'} player ${i % 2 + 1}<select name="player" aria-label="${i < 2 ? 'Team 1' : 'Team 2'} player ${i % 2 + 1}">${ready.map(p => `<option value="${escapeHtml(p.id)}" ${p.id === id ? 'selected' : ''}>${escapeHtml(p.name)}</option>`).join('')}</select></label>`).join('')}
            <button class="btn small" type="submit">Use this matchup</button>
            <button class="text-link" id="adaptive-lineup-cancel" type="button">Cancel</button>
          </form>` : ''}` : ''}
        ${active() ? `
          <div class="adaptive-scores">
            <label>${escapeHtml(round.teamA.map(name).join(' and '))}<input id="adaptive-score-a" type="number" min="0" inputmode="numeric" value="${score[0]}"></label>
            <label>${escapeHtml(round.teamB.map(name).join(' and '))}<input id="adaptive-score-b" type="number" min="0" inputmode="numeric" value="${score[1]}"></label>
          </div>
          <button class="btn" id="adaptive-finish" type="button">Save score and continue</button>
          <button class="text-link adaptive-secondary" id="adaptive-cancel" type="button">Cancel this match</button>
        ` : `<button class="btn" id="adaptive-start" type="button">Start match</button>`}
      ` : ''}

      <h2 class="adaptive-section">Waiting</h2>
      <div class="card adaptive-list">
        ${waiting.length ? waiting.map(p => `<div class="adaptive-row"><span>${escapeHtml(p.name)}</span><span>${state.sitStreak[p.id] ?? 0} ${state.sitStreak[p.id] === 1 ? 'round' : 'rounds'} waited</span></div>`).join('') : '<p class="adaptive-empty">No one is waiting.</p>'}
      </div>

      <h2 class="adaptive-section">Players</h2>
      <div class="card adaptive-list">
        ${state.players.map(p => {
          const status = state.availability[p.id];
          const locked = active() && playing.has(p.id);
          return `<div class="adaptive-player">
            <div><strong>${escapeHtml(p.name)}</strong><span class="adaptive-player-meta">${status === 'ready' ? `Played ${state.roundsPlayed[p.id]}, waited ${state.missed[p.id]}` : status === 'break' ? 'Taking a break' : 'Left for today'}</span></div>
            <div class="adaptive-player-actions">
              ${status === 'ready' ? `<button data-attendance="break" data-id="${escapeHtml(p.id)}" aria-label="Mark ${escapeHtml(p.name)} on a break" ${locked ? 'disabled' : ''}>Break</button><button data-attendance="left" data-id="${escapeHtml(p.id)}" aria-label="Mark ${escapeHtml(p.name)} as left" ${locked ? 'disabled' : ''}>Leave</button>` : `<button data-attendance="ready" data-id="${escapeHtml(p.id)}" aria-label="${status === 'break' ? 'Return' : 'Rejoin'} ${escapeHtml(p.name)}">${status === 'break' ? 'Return' : 'Rejoin'}</button>`}
            </div>
          </div>`;
        }).join('')}
      </div>
      ${active() ? '<p class="adaptive-hint">Finish or cancel the match before changing a player on court.</p>' : ''}
      <form id="adaptive-add" class="adaptive-add"><input id="adaptive-name" type="text" placeholder="Player name" aria-label="Player name" autocomplete="off" maxlength="40" ${rosterFull ? 'disabled' : ''}><button class="btn small" type="submit" ${rosterFull ? 'disabled' : ''}>Add</button></form>
      ${rosterFull ? '<p class="adaptive-hint">The active roster is full at 12 players.</p>' : ''}
      <p class="adaptive-error" role="status">${escapeHtml(error)}</p>

      ${completed.length ? `<h2 class="adaptive-section">Scores</h2><div class="card adaptive-list">${completed.slice().reverse().map(r => `
        <div class="adaptive-history">
          <span>Round ${r.index + 1}: ${escapeHtml(r.teamA.map(name).join(' and '))} ${r.score[0]}–${r.score[1]} ${escapeHtml(r.teamB.map(name).join(' and '))}</span>
          <button type="button" data-edit-score="${r.index}">Edit</button>
        </div>
        ${editIndex === r.index ? `<div class="adaptive-edit"><input id="adaptive-edit-a" type="number" min="0" inputmode="numeric" value="${editScore[0]}" aria-label="First team score"><input id="adaptive-edit-b" type="number" min="0" inputmode="numeric" value="${editScore[1]}" aria-label="Second team score"><button id="adaptive-edit-save" type="button">Save</button><button id="adaptive-edit-cancel" type="button">Cancel</button></div>` : ''}
      `).join('')}</div>` : ''}

      <div class="adaptive-end">${ending ? `<p>End this session and see the results?${active() ? ' The match in progress will not count.' : ''}</p><button class="btn" id="adaptive-end-confirm" type="button">End session</button><button class="btn ghost" id="adaptive-end-cancel" type="button">Keep playing</button>` : '<button class="text-link" id="adaptive-end" type="button">End session</button>'}</div>
    `;
    bind();
  }

  function bind() {
    const change = root.querySelector('#adaptive-change');
    if (change) change.onclick = () => { editingMatch = !editingMatch; render(); };
    const lineup = root.querySelector('#adaptive-lineup');
    if (lineup) lineup.onsubmit = event => {
      event.preventDefault();
      act(() => {
        const ids = [...lineup.querySelectorAll('select')].map(select => select.value);
        editingMatch = false;
        save(setAdaptiveMatch(state, ids.slice(0, 2), ids.slice(2)));
      });
    };
    const lineupCancel = root.querySelector('#adaptive-lineup-cancel');
    if (lineupCancel) lineupCancel.onclick = () => { editingMatch = false; render(); };
    const start = root.querySelector('#adaptive-start');
    if (start) start.onclick = () => act(() => {
      const first = !state.schedule.some(r => r.status === 'completed' || r.status === 'in_progress');
      save(startAdaptiveMatch(state));
      if (first) track('first_match', { format: 'doubles' });
    });
    const cancel = root.querySelector('#adaptive-cancel');
    if (cancel) cancel.onclick = () => act(() => { score = [0, 0]; save(cancelAdaptiveMatch(state)); });
    const finish = root.querySelector('#adaptive-finish');
    if (finish) finish.onclick = () => act(() => {
      const a = Number(root.querySelector('#adaptive-score-a').value);
      const b = Number(root.querySelector('#adaptive-score-b').value);
      save(completeAdaptiveMatch(state, a, b));
      score = [0, 0];
    });
    const scoreA = root.querySelector('#adaptive-score-a');
    const scoreB = root.querySelector('#adaptive-score-b');
    if (scoreA) scoreA.oninput = () => { score[0] = Number(scoreA.value); };
    if (scoreB) scoreB.oninput = () => { score[1] = Number(scoreB.value); };

    root.querySelectorAll('[data-attendance]').forEach(button => {
      button.onclick = () => act(() => save(setAttendance(state, button.dataset.id, button.dataset.attendance)));
    });
    root.querySelector('#adaptive-add').onsubmit = event => {
      event.preventDefault();
      act(() => {
        const value = root.querySelector('#adaptive-name').value.trim();
        if (!value) throw new Error('Enter a player name');
        save(addAdaptivePlayer(state, { id: crypto.randomUUID(), name: value, seedSkill: 2 }));
      });
    };

    root.querySelectorAll('[data-edit-score]').forEach(button => {
      button.onclick = () => {
        editIndex = Number(button.dataset.editScore);
        editScore = [...state.schedule[editIndex].score];
        render();
      };
    });
    const editSave = root.querySelector('#adaptive-edit-save');
    if (editSave) editSave.onclick = () => act(() => {
      const a = Number(root.querySelector('#adaptive-edit-a').value);
      const b = Number(root.querySelector('#adaptive-edit-b').value);
      const next = editAdaptiveScore(state, editIndex, a, b);
      editIndex = null;
      save(next);
    });
    const editCancel = root.querySelector('#adaptive-edit-cancel');
    if (editCancel) editCancel.onclick = () => { editIndex = null; render(); };

    const end = root.querySelector('#adaptive-end');
    if (end) end.onclick = () => { ending = true; render(); };
    const endCancel = root.querySelector('#adaptive-end-cancel');
    if (endCancel) endCancel.onclick = () => { ending = false; render(); };
    const endConfirm = root.querySelector('#adaptive-end-confirm');
    if (endConfirm) endConfirm.onclick = endSession;
  }

  render();
}
