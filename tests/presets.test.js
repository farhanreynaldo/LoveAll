import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FAIRNESS_PRESETS, presetWeights } from '../src/presets.js';
import { DEFAULT_WEIGHTS } from '../src/cost.js';

test('balanced preset equals DEFAULT_WEIGHTS', () => {
  assert.deepEqual(presetWeights('balanced'), { ...DEFAULT_WEIGHTS });
});

test('variety boosts partner and opponent above balanced', () => {
  const w = presetWeights('variety');
  assert.ok(w.partner > DEFAULT_WEIGHTS.partner);
  assert.ok(w.opponent > DEFAULT_WEIGHTS.opponent);
  assert.equal(w.rest, DEFAULT_WEIGHTS.rest);
});

test('even boosts skill above balanced', () => {
  const w = presetWeights('even');
  assert.ok(w.skill > DEFAULT_WEIGHTS.skill);
});

test('presetWeights falls back to balanced for unknown or missing key', () => {
  assert.deepEqual(presetWeights('nope'), presetWeights('balanced'));
  assert.deepEqual(presetWeights(undefined), presetWeights('balanced'));
});

test('every preset exposes key, label, and weights', () => {
  for (const key of ['balanced', 'variety', 'even']) {
    const p = FAIRNESS_PRESETS[key];
    assert.equal(p.key, key);
    assert.equal(typeof p.label, 'string');
    assert.ok(p.weights && typeof p.weights.rest === 'number');
  }
});
