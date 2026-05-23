import { reoptimizeFrom } from '../scheduler.js';
import { createRng } from '../rng.js';
import { saveSession } from '../persistence.js';

export function renderSettings(root, go, session) {
  let state = session;
  // Local draft mirrors current state values
  const draft = {
    rest:     state.weights.rest,
    partner:  state.weights.partner,
    opponent: state.weights.opponent,
    skill:    state.weights.skill,
    k:        state.k,
  };

  function render() {
    root.innerHTML = `
      <div class="screen-header">
        <div class="title">Fairness settings</div>
        <button class="icon-btn" id="back-btn" aria-label="back">×</button>
      </div>

      <p style="color:var(--text-secondary); font-size:13px; margin: 0 0 16px;">
        These weights control how the scheduler picks each round.
        Larger weights mean stronger penalties for unfairness on that dimension.
        Changes re-optimize the remaining schedule immediately.
      </p>

      <div class="label">Cost-function weights</div>
      <div class="card">
        ${weightRow('rest', 'Rest equality', 'Penalty for playing again before others. Effectively a hard constraint at the default value.')}
        ${weightRow('partner', 'Partner variety', 'Penalty for repeating partners.')}
        ${weightRow('opponent', 'Opponent variety', 'Penalty for repeating opponents.')}
        ${weightRow('skill', 'Skill balance', 'Penalty for lopsided team Elo. Tiebreaker only at the default value.')}
      </div>

      <div class="label">Elo K-factor</div>
      <div class="card">
        ${weightRow('k', 'K (rating sensitivity)', 'Higher K = ratings move faster after each match. 32 is standard.')}
      </div>

      <button class="btn ghost small" id="reset-btn" style="margin-top:12px;">Reset to defaults</button>
      <button class="btn" id="save-btn" style="margin-top:8px;">Save &amp; re-optimize</button>
    `;
    bind();
  }

  function weightRow(key, label, hint) {
    return `
      <div class="setting-row">
        <div class="setting-meta">
          <div class="setting-name">${label}</div>
          <div class="setting-hint">${hint}</div>
        </div>
        <input type="number" class="setting-input" data-key="${key}" value="${draft[key]}" min="0" step="${key === 'k' ? '1' : 'any'}" />
      </div>
    `;
  }

  function bind() {
    root.querySelector('#back-btn').onclick = () => go('live', state);

    root.querySelectorAll('.setting-input').forEach(inp => {
      inp.oninput = e => {
        const key = e.target.dataset.key;
        const v = parseFloat(e.target.value);
        if (!Number.isNaN(v) && v >= 0) draft[key] = v;
      };
    });

    root.querySelector('#reset-btn').onclick = () => {
      draft.rest = 1000;
      draft.partner = 10;
      draft.opponent = 8;
      draft.skill = 1;
      draft.k = 32;
      render();
    };

    root.querySelector('#save-btn').onclick = () => {
      state = {
        ...state,
        weights: { rest: draft.rest, partner: draft.partner, opponent: draft.opponent, skill: draft.skill },
        k: draft.k,
      };
      // Re-optimize unlocked rounds from the first non-(completed|skipped|locked) round
      const firstUnlocked = state.schedule.findIndex(r => r.status === 'tentative');
      if (firstUnlocked >= 0) {
        const rng = createRng((state.seed + 9000) >>> 0);
        const reopt = reoptimizeFrom(state, firstUnlocked, state.weights, rng);
        state = { ...state, schedule: reopt };
      }
      saveSession(state);
      go('live', state);
    };
  }

  render();
}
