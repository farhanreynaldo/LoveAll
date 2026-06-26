import { DEFAULT_WEIGHTS } from './cost.js';

// Named fairness intents the organizer picks instead of raw cost weights.
// Each maps to the weight vector the scheduler already consumes.
// `balanced` is sourced from DEFAULT_WEIGHTS so it stays the single source of truth.
export const FAIRNESS_PRESETS = Object.freeze({
  balanced: {
    key: 'balanced',
    label: 'Balanced',
    weights: { ...DEFAULT_WEIGHTS },
  },
  variety: {
    key: 'variety',
    label: 'Maximize variety',
    weights: { rest: DEFAULT_WEIGHTS.rest, partner: 20, opponent: 16, skill: 1 },
  },
  even: {
    key: 'even',
    label: 'Keep teams even',
    weights: { rest: DEFAULT_WEIGHTS.rest, partner: 10, opponent: 8, skill: 6 },
  },
});

export function presetWeights(key) {
  return { ...(FAIRNESS_PRESETS[key] ?? FAIRNESS_PRESETS.balanced).weights };
}
