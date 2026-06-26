import { reoptimizeFrom } from '../scheduler.js';
import { createRng } from '../rng.js';
import { saveSession } from '../persistence.js';
import { FAIRNESS_PRESETS, presetWeights } from '../presets.js';

const PRESET_COPY = {
  balanced: {
    doubles: 'Fair rest, varied pairings, even teams.',
    singles: 'Fair rest, varied opponents, even matches.',
  },
  variety: {
    doubles: 'Play with and against as many different people as possible.',
    singles: 'Play against as many different people as possible.',
  },
  even: {
    doubles: 'Prioritize closely-matched, competitive games.',
    singles: 'Prioritize closely-matched, competitive games.',
  },
};

export function renderSettings(root, go, session) {
  let state = session;
  let selected = state.fairnessPreset ?? 'balanced';
  const fmt = state.format === 'singles' ? 'singles' : 'doubles';

  function render() {
    const options = Object.values(FAIRNESS_PRESETS).map(p => {
      const isOn = selected === p.key;
      return `
        <button type="button" class="preset-option ${isOn ? 'is-active' : ''}"
          role="radio" aria-checked="${isOn}" data-preset="${p.key}">
          <span class="preset-name">${p.label}</span>
          <span class="preset-desc">${PRESET_COPY[p.key][fmt]}</span>
        </button>
      `;
    }).join('');

    root.innerHTML = `
      <div class="screen-header">
        <div class="title">Fairness</div>
        <div class="header-actions">
          <button class="icon-btn theme-toggle-btn" data-theme-toggle aria-label="toggle dark mode" type="button">◐</button>
          <button class="icon-btn" id="back-btn" aria-label="back">×</button>
        </div>
      </div>

      <p style="color:var(--text-secondary); font-size:var(--text-meta); margin: 0 0 16px;">
        Choose what the shuffler should optimise for. Changes re-optimize the remaining rounds.
      </p>

      <div class="preset-list" role="radiogroup" aria-label="Fairness preset">
        ${options}
      </div>

      <button class="btn" id="save-btn" style="margin-top:16px;">Save &amp; re-optimize</button>
    `;
    bind();
  }

  function bind() {
    root.querySelector('#back-btn').onclick = () => go('live', state);

    root.querySelectorAll('.preset-option[data-preset]').forEach(btn => {
      btn.onclick = () => { selected = btn.dataset.preset; render(); };
    });

    root.querySelector('#save-btn').onclick = () => {
      state = {
        ...state,
        fairnessPreset: selected,
        weights: presetWeights(selected),
      };
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
