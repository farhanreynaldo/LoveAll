# Court Shuffle v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a single-court tennis-session pairing app (Court Shuffle v1) — mobile-first, local-first, PWA-installable, organizer-only — implementing the algorithm and UI specs in `docs/superpowers/specs/2026-05-23-court-shuffle-algorithm-design.md` and `docs/superpowers/specs/2026-05-23-court-shuffle-ui-design.md`.

**Architecture:** Vanilla JavaScript single-page web app, no build step. ES modules for code organization. Pure algorithm modules (cost function, scheduler, Elo) are isolated from the DOM and unit-tested with Node's built-in `node:test`. UI modules manipulate the DOM directly and are verified manually in a browser. Session state lives in `localStorage`. A small service worker caches the app shell so the PWA launches offline.

**Tech Stack:** HTML5, CSS3, vanilla JavaScript (ES2022+ modules). Node 20+ for the test runner. No external runtime dependencies.

---

## File Structure

Files this plan creates:

| Path | Responsibility |
|---|---|
| `index.html` | App shell — root `<div id="app">` and PWA tags |
| `styles.css` | All visual styles, including dark-mode variant |
| `manifest.json` | PWA manifest (name, icons, theme color) |
| `sw.js` | Service worker — caches app shell for offline launch |
| `icons/icon-192.png`, `icons/icon-512.png` | PWA icons (placeholder solid color is acceptable for v1) |
| `src/rng.js` | Seeded RNG (deterministic random for tiebreaking) |
| `src/elo.js` | Elo update math |
| `src/cost.js` | Per-candidate cost function and weights |
| `src/scheduler.js` | Candidate enumeration, schedule generation, re-optimization, simulate-state |
| `src/state.js` | Session state model factories and pure updaters |
| `src/persistence.js` | `localStorage` save/load |
| `src/router.js` | Tiny screen-switcher (setup ↔ live ↔ summary) |
| `src/theme.js` | Dark-mode toggle |
| `src/ui/setup.js` | Setup screen render + interactions |
| `src/ui/live.js` | Live session screen render + interactions |
| `src/ui/summary.js` | End summary screen render + interactions |
| `src/app.js` | Bootstrap — load state, register service worker, hand off to router |
| `tests/rng.test.js` | Unit tests for RNG |
| `tests/elo.test.js` | Unit tests for Elo |
| `tests/cost.test.js` | Unit tests for cost function |
| `tests/scheduler.test.js` | Unit tests for scheduler |
| `tests/state.test.js` | Unit tests for state updaters |
| `.gitignore` | Ignore `.superpowers/`, `node_modules/` if any, `.DS_Store` |
| `README.md` | How to run locally, how to deploy |
| `package.json` | Minimal — defines `npm test` to run `node --test tests/` |

---

## Task 1: Project skeleton + .gitignore + README

**Files:**
- Create: `.gitignore`
- Create: `README.md`
- Create: `package.json`

- [ ] **Step 1: Create `.gitignore`**

```
.superpowers/
node_modules/
.DS_Store
*.log
```

- [ ] **Step 2: Create `package.json`**

```json
{
  "name": "court-shuffle",
  "version": "0.1.0",
  "description": "Tennis session shuffler — single-court, organizer-only PWA",
  "type": "module",
  "scripts": {
    "test": "node --test tests/",
    "serve": "python3 -m http.server 8000"
  },
  "engines": {
    "node": ">=20"
  }
}
```

- [ ] **Step 3: Create `README.md`**

```markdown
# Court Shuffle

A tiny PWA for shuffling tennis doubles matches on a single court (6–8 players).
Mobile-first, organizer-only, no backend.

## Run locally

```bash
npm run serve
# then open http://localhost:8000 on your phone (same Wi-Fi) or laptop
```

## Run tests

```bash
npm test
```

## Deploy

Any static host: GitHub Pages, Cloudflare Pages, Vercel, Netlify, or copy the folder to any web server. No build step.

## Specs

- Algorithm: `docs/superpowers/specs/2026-05-23-court-shuffle-algorithm-design.md`
- UI/UX: `docs/superpowers/specs/2026-05-23-court-shuffle-ui-design.md`
```

- [ ] **Step 4: Verify Node version**

Run: `node --version`
Expected: `v20.x.x` or higher. If older, the user should upgrade Node before continuing.

- [ ] **Step 5: Commit**

```bash
git add .gitignore package.json README.md
git commit -m "chore: project skeleton (gitignore, package.json, readme)"
```

---

## Task 2: Seeded RNG module

**Files:**
- Create: `src/rng.js`
- Test: `tests/rng.test.js`

The scheduler picks randomly among equal-cost candidates. We need a seeded RNG so a session is reproducible (per algorithm spec §4.4).

- [ ] **Step 1: Write failing tests**

Create `tests/rng.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../src/rng.js';

test('createRng returns same sequence for same seed', () => {
  const a = createRng(42);
  const b = createRng(42);
  const seqA = [a(), a(), a(), a(), a()];
  const seqB = [b(), b(), b(), b(), b()];
  assert.deepEqual(seqA, seqB);
});

test('createRng returns different sequence for different seed', () => {
  const a = createRng(1);
  const b = createRng(2);
  assert.notEqual(a(), b());
});

test('createRng returns values in [0, 1)', () => {
  const r = createRng(7);
  for (let i = 0; i < 1000; i++) {
    const v = r();
    assert.ok(v >= 0 && v < 1, `value ${v} out of range`);
  }
});

test('pickOne returns one element from array using rng', () => {
  const { pickOne } = await import('../src/rng.js');
  const r = createRng(123);
  const arr = ['a', 'b', 'c', 'd'];
  const picked = pickOne(arr, r);
  assert.ok(arr.includes(picked));
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test`
Expected: FAIL — `Cannot find module '../src/rng.js'`

- [ ] **Step 3: Implement `src/rng.js`**

```js
// Mulberry32 — small, fast, well-distributed seeded RNG.
// Returns a function that yields a float in [0, 1) each call.
export function createRng(seed) {
  let t = seed >>> 0;
  return function () {
    t = (t + 0x6D2B79F5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function pickOne(arr, rng) {
  return arr[Math.floor(rng() * arr.length)];
}
```

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: PASS — 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/rng.js tests/rng.test.js
git commit -m "feat(rng): seeded mulberry32 RNG with pickOne helper"
```

---

## Task 3: Elo update module

**Files:**
- Create: `src/elo.js`
- Test: `tests/elo.test.js`

Implements algorithm spec §6. Pure functions only.

- [ ] **Step 1: Write failing tests**

Create `tests/elo.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seedElo, expectedScore, updateElo } from '../src/elo.js';

test('seedElo maps 1..5 to 1100..1500', () => {
  assert.equal(seedElo(1), 1100);
  assert.equal(seedElo(3), 1300);
  assert.equal(seedElo(5), 1500);
});

test('expectedScore is 0.5 for equal ratings', () => {
  assert.equal(expectedScore(1300, 1300), 0.5);
});

test('expectedScore favors higher rating', () => {
  const e = expectedScore(1400, 1300);
  assert.ok(e > 0.5 && e < 1);
});

test('updateElo nudges winners up and losers down', () => {
  const ratings = { a1: 1300, a2: 1300, b1: 1300, b2: 1300 };
  const next = updateElo(ratings, ['a1','a2'], ['b1','b2'], 6, 2, 32);
  assert.ok(next.a1 > 1300, 'a1 should rise');
  assert.ok(next.a2 > 1300, 'a2 should rise');
  assert.ok(next.b1 < 1300, 'b1 should drop');
  assert.ok(next.b2 < 1300, 'b2 should drop');
  // Both teammates get identical delta
  assert.equal(next.a1, next.a2);
  assert.equal(next.b1, next.b2);
});

test('updateElo is margin-aware: 6-0 moves more than 6-5', () => {
  const r = { a1: 1300, a2: 1300, b1: 1300, b2: 1300 };
  const blowout = updateElo(r, ['a1','a2'], ['b1','b2'], 6, 0, 32);
  const squeaker = updateElo(r, ['a1','a2'], ['b1','b2'], 6, 5, 32);
  assert.ok(blowout.a1 - 1300 > squeaker.a1 - 1300);
});

test('updateElo does not mutate input', () => {
  const r = { a1: 1300, a2: 1300, b1: 1300, b2: 1300 };
  updateElo(r, ['a1','a2'], ['b1','b2'], 6, 2, 32);
  assert.equal(r.a1, 1300);
});

test('updateElo handles 0-0 (skipped/aborted round) gracefully', () => {
  const r = { a1: 1300, a2: 1300, b1: 1300, b2: 1300 };
  const next = updateElo(r, ['a1','a2'], ['b1','b2'], 0, 0, 32);
  // No games played → no info → no change
  assert.deepEqual(next, r);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test`
Expected: FAIL — `Cannot find module '../src/elo.js'`

- [ ] **Step 3: Implement `src/elo.js`**

```js
// Elo for doubles, with margin-aware actual score. Per algorithm spec §6.

export function seedElo(seedSkill) {
  return 1000 + 100 * seedSkill;
}

export function expectedScore(ratingA, ratingB) {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

/**
 * Returns a new ratings map with updates applied. Input is not mutated.
 *
 * @param {Object} ratings  { playerId: elo, ... }
 * @param {Array<string>} teamA  [id1, id2]
 * @param {Array<string>} teamB  [id1, id2]
 * @param {number} gamesA  games won by team A
 * @param {number} gamesB  games won by team B
 * @param {number} k       K-factor (default 32)
 */
export function updateElo(ratings, teamA, teamB, gamesA, gamesB, k = 32) {
  const next = { ...ratings };
  const total = gamesA + gamesB;
  if (total === 0) return next;

  const rA = (ratings[teamA[0]] + ratings[teamA[1]]) / 2;
  const rB = (ratings[teamB[0]] + ratings[teamB[1]]) / 2;

  const eA = expectedScore(rA, rB);
  const eB = 1 - eA;

  const sA = gamesA / total;
  const sB = 1 - sA;

  const deltaA = k * (sA - eA);
  const deltaB = k * (sB - eB);

  next[teamA[0]] += deltaA;
  next[teamA[1]] += deltaA;
  next[teamB[0]] += deltaB;
  next[teamB[1]] += deltaB;

  return next;
}
```

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: PASS — 7 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/elo.js tests/elo.test.js
git commit -m "feat(elo): margin-aware doubles Elo update"
```

---

## Task 4: Cost function module

**Files:**
- Create: `src/cost.js`
- Test: `tests/cost.test.js`

Implements algorithm spec §4. Pure function: takes a candidate match + state, returns a numeric cost.

- [ ] **Step 1: Write failing tests**

Create `tests/cost.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_WEIGHTS, computeCost } from '../src/cost.js';

function blankState(playerIds) {
  const partnerCounts = {};
  const opponentCounts = {};
  const elo = {};
  const roundsPlayed = {};
  for (const id of playerIds) {
    partnerCounts[id] = {};
    opponentCounts[id] = {};
    elo[id] = 1300;
    roundsPlayed[id] = 0;
    for (const j of playerIds) {
      if (j !== id) {
        partnerCounts[id][j] = 0;
        opponentCounts[id][j] = 0;
      }
    }
  }
  return { partnerCounts, opponentCounts, elo, roundsPlayed };
}

test('cost is zero on a fresh state with equal Elo', () => {
  const state = blankState(['a','b','c','d','e','f']);
  const candidate = { teamA: ['a','b'], teamB: ['c','d'] };
  const c = computeCost(candidate, state, DEFAULT_WEIGHTS);
  assert.equal(c, 0);
});

test('rest_penalty dominates when an overplayed player would play again', () => {
  const state = blankState(['a','b','c','d','e','f']);
  state.roundsPlayed.a = 3; // a has played 3 more rounds than the min
  const candidateWithA = { teamA: ['a','b'], teamB: ['c','d'] };
  const candidateWithoutA = { teamA: ['b','c'], teamB: ['d','e'] };
  const cWith = computeCost(candidateWithA, state, DEFAULT_WEIGHTS);
  const cWithout = computeCost(candidateWithoutA, state, DEFAULT_WEIGHTS);
  assert.ok(cWith > cWithout);
  assert.ok(cWith > 1000); // rest weight * 3² = 9000+
});

test('partner_penalty grows quadratically with repetition', () => {
  const state = blankState(['a','b','c','d','e','f']);
  state.partnerCounts.a.b = 2;
  state.partnerCounts.b.a = 2;
  const candidate = { teamA: ['a','b'], teamB: ['c','d'] };
  const c = computeCost(candidate, state, DEFAULT_WEIGHTS);
  // partner penalty contribution = 10 * (2² + 0²) = 40
  assert.equal(c, 40);
});

test('opponent_penalty also grows quadratically', () => {
  const state = blankState(['a','b','c','d','e','f']);
  state.opponentCounts.a.c = 2;
  state.opponentCounts.c.a = 2;
  const candidate = { teamA: ['a','b'], teamB: ['c','d'] };
  const c = computeCost(candidate, state, DEFAULT_WEIGHTS);
  // opponent contribution: 8 * (2² + 0² + 0² + 0²) = 32
  assert.equal(c, 32);
});

test('skill_penalty fires on unbalanced teams', () => {
  const state = blankState(['a','b','c','d','e','f']);
  state.elo.a = 1500;
  state.elo.b = 1500;
  state.elo.c = 1100;
  state.elo.d = 1100;
  const candidate = { teamA: ['a','b'], teamB: ['c','d'] };
  const c = computeCost(candidate, state, DEFAULT_WEIGHTS);
  // skill penalty = 1 * ((3000 - 2200) / 100)² = 64
  assert.equal(c, 64);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test`
Expected: FAIL — `Cannot find module '../src/cost.js'`

- [ ] **Step 3: Implement `src/cost.js`**

```js
// Cost function for a candidate match. Per algorithm spec §4.

export const DEFAULT_WEIGHTS = Object.freeze({
  rest: 1000,
  partner: 10,
  opponent: 8,
  skill: 1,
});

function restPenalty(candidate, state) {
  const onCourt = [...candidate.teamA, ...candidate.teamB];
  const minRounds = Math.min(...Object.values(state.roundsPlayed));
  let sum = 0;
  for (const p of onCourt) {
    const diff = state.roundsPlayed[p] - minRounds;
    sum += diff * diff;
  }
  return sum;
}

function partnerPenalty(candidate, state) {
  const [a1, a2] = candidate.teamA;
  const [b1, b2] = candidate.teamB;
  const pa = state.partnerCounts[a1][a2] ?? 0;
  const pb = state.partnerCounts[b1][b2] ?? 0;
  return pa * pa + pb * pb;
}

function opponentPenalty(candidate, state) {
  const [a1, a2] = candidate.teamA;
  const [b1, b2] = candidate.teamB;
  const pairs = [[a1,b1],[a1,b2],[a2,b1],[a2,b2]];
  let sum = 0;
  for (const [x, y] of pairs) {
    const c = state.opponentCounts[x][y] ?? 0;
    sum += c * c;
  }
  return sum;
}

function skillPenalty(candidate, state) {
  const sumA = state.elo[candidate.teamA[0]] + state.elo[candidate.teamA[1]];
  const sumB = state.elo[candidate.teamB[0]] + state.elo[candidate.teamB[1]];
  const diff = (sumA - sumB) / 100;
  return diff * diff;
}

export function computeCost(candidate, state, weights = DEFAULT_WEIGHTS) {
  return (
    weights.rest * restPenalty(candidate, state) +
    weights.partner * partnerPenalty(candidate, state) +
    weights.opponent * opponentPenalty(candidate, state) +
    weights.skill * skillPenalty(candidate, state)
  );
}
```

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: PASS — 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/cost.js tests/cost.test.js
git commit -m "feat(cost): per-candidate cost function with default weights"
```

---

## Task 5: Scheduler module — enumeration, generation, simulation

**Files:**
- Create: `src/scheduler.js`
- Test: `tests/scheduler.test.js`

Implements algorithm spec §4.4 (enumeration) and §5.1 (generation) plus a `simulate` helper that advances state.

- [ ] **Step 1: Write failing tests**

Create `tests/scheduler.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  enumerateCandidates,
  pickBestCandidate,
  simulate,
  generateSchedule,
} from '../src/scheduler.js';
import { createRng } from '../src/rng.js';
import { DEFAULT_WEIGHTS } from '../src/cost.js';

function blankState(ids) {
  const partnerCounts = {};
  const opponentCounts = {};
  const elo = {};
  const roundsPlayed = {};
  for (const id of ids) {
    partnerCounts[id] = {};
    opponentCounts[id] = {};
    elo[id] = 1300;
    roundsPlayed[id] = 0;
    for (const j of ids) if (j !== id) { partnerCounts[id][j] = 0; opponentCounts[id][j] = 0; }
  }
  return { players: ids, partnerCounts, opponentCounts, elo, roundsPlayed };
}

test('enumerateCandidates yields C(n,4)*3 candidates', () => {
  const eight = enumerateCandidates(['a','b','c','d','e','f','g','h']);
  assert.equal(eight.length, 70 * 3); // C(8,4)=70

  const six = enumerateCandidates(['a','b','c','d','e','f']);
  assert.equal(six.length, 15 * 3); // C(6,4)=15
});

test('each candidate has teamA and teamB of 2 distinct players covering 4 unique ids', () => {
  const cs = enumerateCandidates(['a','b','c','d','e','f']);
  for (const c of cs) {
    assert.equal(c.teamA.length, 2);
    assert.equal(c.teamB.length, 2);
    const all = new Set([...c.teamA, ...c.teamB]);
    assert.equal(all.size, 4);
  }
});

test('pickBestCandidate returns lowest-cost candidate', () => {
  const state = blankState(['a','b','c','d','e','f']);
  state.roundsPlayed.a = 5;       // a has played a lot
  const rng = createRng(1);
  const best = pickBestCandidate(state, DEFAULT_WEIGHTS, rng);
  assert.ok(!best.teamA.includes('a') && !best.teamB.includes('a'),
    'a should be excluded from best candidate due to rest penalty');
});

test('pickBestCandidate uses rng for ties; same seed → same pick', () => {
  const state = blankState(['a','b','c','d','e','f']);
  const r1 = createRng(42);
  const r2 = createRng(42);
  const a = pickBestCandidate(state, DEFAULT_WEIGHTS, r1);
  const b = pickBestCandidate(state, DEFAULT_WEIGHTS, r2);
  assert.deepEqual(a, b);
});

test('simulate advances roundsPlayed and partner/opponent counts', () => {
  const state = blankState(['a','b','c','d','e','f']);
  const candidate = { teamA: ['a','b'], teamB: ['c','d'] };
  const next = simulate(state, candidate);
  assert.equal(next.roundsPlayed.a, 1);
  assert.equal(next.roundsPlayed.e, 0);
  assert.equal(next.partnerCounts.a.b, 1);
  assert.equal(next.partnerCounts.b.a, 1);
  assert.equal(next.opponentCounts.a.c, 1);
  assert.equal(next.opponentCounts.c.a, 1);
});

test('simulate does not mutate input', () => {
  const state = blankState(['a','b','c','d','e','f']);
  const candidate = { teamA: ['a','b'], teamB: ['c','d'] };
  simulate(state, candidate);
  assert.equal(state.roundsPlayed.a, 0);
});

test('generateSchedule produces exactly N rounds', () => {
  const state = blankState(['a','b','c','d','e','f']);
  const rng = createRng(7);
  const sched = generateSchedule(state, 10, DEFAULT_WEIGHTS, rng);
  assert.equal(sched.length, 10);
});

test('generateSchedule distributes rest fairly for 6 players over 9 rounds', () => {
  // 9 rounds * 4 on-court / 6 players = 6 rounds each on average
  const state = blankState(['a','b','c','d','e','f']);
  const rng = createRng(99);
  const sched = generateSchedule(state, 9, DEFAULT_WEIGHTS, rng);
  let s = state;
  for (const r of sched) s = simulate(s, r);
  const counts = Object.values(s.roundsPlayed);
  const max = Math.max(...counts);
  const min = Math.min(...counts);
  assert.ok(max - min <= 1, `rounds-played range too wide: ${min}..${max}`);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test`
Expected: FAIL — `Cannot find module '../src/scheduler.js'`

- [ ] **Step 3: Implement `src/scheduler.js`**

```js
import { computeCost, DEFAULT_WEIGHTS } from './cost.js';

// Returns all foursomes (size-4 subsets) of `players`.
function foursomes(players) {
  const result = [];
  const n = players.length;
  for (let i = 0; i < n - 3; i++) {
    for (let j = i + 1; j < n - 2; j++) {
      for (let k = j + 1; k < n - 1; k++) {
        for (let l = k + 1; l < n; l++) {
          result.push([players[i], players[j], players[k], players[l]]);
        }
      }
    }
  }
  return result;
}

// Given 4 players, the 3 possible (teamA, teamB) pairings (sets, not ordered tuples).
function pairings(four) {
  const [a, b, c, d] = four;
  return [
    { teamA: [a, b], teamB: [c, d] },
    { teamA: [a, c], teamB: [b, d] },
    { teamA: [a, d], teamB: [b, c] },
  ];
}

export function enumerateCandidates(players) {
  const out = [];
  for (const four of foursomes(players)) {
    for (const p of pairings(four)) out.push(p);
  }
  return out;
}

/**
 * Returns the lowest-cost candidate. Ties broken using `rng()` (uniform pick
 * among min-cost candidates).
 */
export function pickBestCandidate(state, weights, rng) {
  const candidates = enumerateCandidates(state.players);
  let minCost = Infinity;
  let best = [];
  for (const c of candidates) {
    const cost = computeCost(c, state, weights);
    if (cost < minCost) {
      minCost = cost;
      best = [c];
    } else if (cost === minCost) {
      best.push(c);
    }
  }
  return best[Math.floor(rng() * best.length)];
}

/**
 * Returns a NEW state with counts advanced by playing `candidate`. Does not
 * touch Elo (that only changes on score entry).
 */
export function simulate(state, candidate) {
  const partnerCounts = structuredClone(state.partnerCounts);
  const opponentCounts = structuredClone(state.opponentCounts);
  const roundsPlayed = { ...state.roundsPlayed };

  const onCourt = [...candidate.teamA, ...candidate.teamB];
  for (const p of onCourt) roundsPlayed[p] = (roundsPlayed[p] ?? 0) + 1;

  const inc = (map, x, y) => { map[x][y] = (map[x][y] ?? 0) + 1; };
  inc(partnerCounts, candidate.teamA[0], candidate.teamA[1]);
  inc(partnerCounts, candidate.teamA[1], candidate.teamA[0]);
  inc(partnerCounts, candidate.teamB[0], candidate.teamB[1]);
  inc(partnerCounts, candidate.teamB[1], candidate.teamB[0]);

  for (const a of candidate.teamA) {
    for (const b of candidate.teamB) {
      inc(opponentCounts, a, b);
      inc(opponentCounts, b, a);
    }
  }

  return { ...state, partnerCounts, opponentCounts, roundsPlayed };
}

/**
 * Generates `targetRounds` tentative rounds by repeatedly picking the
 * best candidate and simulating forward.
 */
export function generateSchedule(state, targetRounds, weights = DEFAULT_WEIGHTS, rng) {
  const rounds = [];
  let s = state;
  for (let i = 0; i < targetRounds; i++) {
    const cand = pickBestCandidate(s, weights, rng);
    rounds.push(cand);
    s = simulate(s, cand);
  }
  return rounds;
}
```

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: PASS — 8 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/scheduler.js tests/scheduler.test.js
git commit -m "feat(scheduler): enumerate, score, simulate, generate schedule"
```

---

## Task 6: State model + persistence

**Files:**
- Create: `src/state.js`
- Create: `src/persistence.js`
- Test: `tests/state.test.js`

Defines the session state shape and pure updaters used when a round is completed, when a score is corrected, when a player is added/removed. Implements algorithm spec §3 and §5.

- [ ] **Step 1: Write failing tests**

Create `tests/state.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createSession,
  applyScore,
  recomputeFromCompleted,
  addPlayer,
  removePlayer,
} from '../src/state.js';

const PLAYERS = [
  { id: 'a', name: 'Aldo', seedSkill: 3 },
  { id: 'b', name: 'Maya', seedSkill: 3 },
  { id: 'c', name: 'Jin', seedSkill: 3 },
  { id: 'd', name: 'Sam', seedSkill: 3 },
  { id: 'e', name: 'Lee', seedSkill: 3 },
  { id: 'f', name: 'Priya', seedSkill: 3 },
];

test('createSession initializes players, schedule, weights, rng seed', () => {
  const s = createSession({ players: PLAYERS, targetRounds: 8, seed: 42 });
  assert.equal(s.players.length, 6);
  assert.equal(s.schedule.length, 8);
  for (const r of s.schedule) assert.equal(r.status, 'tentative');
  assert.equal(s.weights.rest, 1000);
  assert.equal(s.seed, 42);
  for (const p of PLAYERS) {
    assert.equal(s.elo[p.id], 1300);
    assert.equal(s.roundsPlayed[p.id], 0);
  }
});

test('applyScore marks round completed and updates wins/losses/games/Elo/counts', () => {
  const s0 = createSession({ players: PLAYERS, targetRounds: 5, seed: 1 });
  // Score the first scheduled round 6-3
  const s1 = applyScore(s0, 0, 6, 3);
  const r = s1.schedule[0];
  assert.equal(r.status, 'completed');
  assert.deepEqual(r.score, [6, 3]);
  // winners' wins incremented
  for (const id of r.teamA) {
    assert.equal(s1.wins[id], 1);
    assert.equal(s1.gamesFor[id], 6);
    assert.equal(s1.gamesAgainst[id], 3);
  }
  for (const id of r.teamB) {
    assert.equal(s1.losses[id], 1);
    assert.equal(s1.gamesFor[id], 3);
    assert.equal(s1.gamesAgainst[id], 6);
  }
  // roundsPlayed bumped for on-court players
  for (const id of [...r.teamA, ...r.teamB]) {
    assert.equal(s1.roundsPlayed[id], 1);
  }
  // Elo changed for winners
  assert.ok(s1.elo[r.teamA[0]] > 1300);
});

test('recomputeFromCompleted rebuilds derived state from scratch', () => {
  let s = createSession({ players: PLAYERS, targetRounds: 4, seed: 1 });
  s = applyScore(s, 0, 6, 4);
  s = applyScore(s, 1, 3, 6);
  const fresh = recomputeFromCompleted(s);
  assert.deepEqual(fresh.wins, s.wins);
  assert.deepEqual(fresh.elo, s.elo);
  assert.deepEqual(fresh.roundsPlayed, s.roundsPlayed);
});

test('addPlayer extends roster and zeroes their counts', () => {
  const s = createSession({ players: PLAYERS, targetRounds: 4, seed: 1 });
  const next = addPlayer(s, { id: 'g', name: 'Kai', seedSkill: 4 });
  assert.equal(next.players.length, 7);
  assert.equal(next.elo.g, 1400);
  assert.equal(next.roundsPlayed.g, 0);
  // Other players' counts gain g key set to 0
  assert.equal(next.partnerCounts.a.g, 0);
});

test('removePlayer drops them from state and all counts', () => {
  const s = createSession({ players: PLAYERS, targetRounds: 4, seed: 1 });
  const next = removePlayer(s, 'f');
  assert.equal(next.players.length, 5);
  assert.equal(next.elo.f, undefined);
  assert.equal(next.partnerCounts.a.f, undefined);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test`
Expected: FAIL — `Cannot find module '../src/state.js'`

- [ ] **Step 3: Implement `src/state.js`**

```js
import { seedElo, updateElo } from './elo.js';
import { simulate, generateSchedule } from './scheduler.js';
import { DEFAULT_WEIGHTS } from './cost.js';
import { createRng } from './rng.js';

function blankCounts(playerIds) {
  const out = {};
  for (const a of playerIds) {
    out[a] = {};
    for (const b of playerIds) if (a !== b) out[a][b] = 0;
  }
  return out;
}

function blankPerPlayer(playerIds, value) {
  const out = {};
  for (const id of playerIds) out[id] = value;
  return out;
}

/**
 * Create a fresh session.
 * @param {{ players: Array<{id,name,seedSkill}>, targetRounds: number,
 *          seed?: number, weights?: object, k?: number }} opts
 */
export function createSession({ players, targetRounds, seed = Date.now() >>> 0, weights = DEFAULT_WEIGHTS, k = 32 }) {
  const ids = players.map(p => p.id);
  const state = {
    players,
    targetRounds,
    seed,
    weights,
    k,
    elo: Object.fromEntries(players.map(p => [p.id, seedElo(p.seedSkill)])),
    roundsPlayed: blankPerPlayer(ids, 0),
    partnerCounts: blankCounts(ids),
    opponentCounts: blankCounts(ids),
    wins: blankPerPlayer(ids, 0),
    losses: blankPerPlayer(ids, 0),
    gamesFor: blankPerPlayer(ids, 0),
    gamesAgainst: blankPerPlayer(ids, 0),
    startedAt: Date.now(),
    schedule: [],
    darkMode: false,
  };
  const rng = createRng(seed);
  const tentative = generateSchedule(state, targetRounds, weights, rng);
  state.schedule = tentative.map(c => ({
    teamA: c.teamA, teamB: c.teamB,
    status: 'tentative', score: null, manuallyEdited: false,
  }));
  return state;
}

/**
 * Record a score for round at index `roundIndex`. Marks it completed and
 * updates all derived state.
 */
export function applyScore(state, roundIndex, gamesA, gamesB) {
  const next = structuredClone(state);
  const r = next.schedule[roundIndex];
  r.status = 'completed';
  r.score = [gamesA, gamesB];
  const winners = gamesA > gamesB ? r.teamA : (gamesB > gamesA ? r.teamB : null);
  const losers  = gamesA > gamesB ? r.teamB : (gamesB > gamesA ? r.teamA : null);

  // roundsPlayed and counts (via simulate)
  const sim = simulate({
    players: next.players,
    roundsPlayed: next.roundsPlayed,
    partnerCounts: next.partnerCounts,
    opponentCounts: next.opponentCounts,
    elo: next.elo,
  }, { teamA: r.teamA, teamB: r.teamB });
  next.roundsPlayed = sim.roundsPlayed;
  next.partnerCounts = sim.partnerCounts;
  next.opponentCounts = sim.opponentCounts;

  // wins/losses (only if not a tie)
  if (winners && losers) {
    for (const id of winners) next.wins[id] += 1;
    for (const id of losers)  next.losses[id] += 1;
  }
  // games for/against
  for (const id of r.teamA) { next.gamesFor[id] += gamesA; next.gamesAgainst[id] += gamesB; }
  for (const id of r.teamB) { next.gamesFor[id] += gamesB; next.gamesAgainst[id] += gamesA; }

  // Elo
  next.elo = updateElo(next.elo, r.teamA, r.teamB, gamesA, gamesB, next.k);

  return next;
}

/**
 * Rebuild all derived state (wins, Elo, counts) from scratch using the
 * sequence of completed rounds. Used when a past score is edited.
 */
export function recomputeFromCompleted(state) {
  const fresh = createSessionBase(state);
  let s = fresh;
  for (let i = 0; i < state.schedule.length; i++) {
    const r = state.schedule[i];
    s.schedule[i] = { ...r };
    if (r.status === 'completed' && r.score) {
      s = applyScore(s, i, r.score[0], r.score[1]);
    } else if (r.status === 'locked') {
      s.schedule[i].status = 'locked';
    }
  }
  return s;
}

function createSessionBase(state) {
  return createSession({
    players: state.players,
    targetRounds: state.targetRounds,
    seed: state.seed,
    weights: state.weights,
    k: state.k,
  });
}

export function addPlayer(state, player) {
  const next = structuredClone(state);
  next.players.push(player);
  const id = player.id;
  next.elo[id] = seedElo(player.seedSkill);
  next.roundsPlayed[id] = 0;
  next.wins[id] = 0;
  next.losses[id] = 0;
  next.gamesFor[id] = 0;
  next.gamesAgainst[id] = 0;
  next.partnerCounts[id] = {};
  next.opponentCounts[id] = {};
  for (const other of next.players) {
    if (other.id === id) continue;
    next.partnerCounts[id][other.id] = 0;
    next.opponentCounts[id][other.id] = 0;
    next.partnerCounts[other.id][id] = 0;
    next.opponentCounts[other.id][id] = 0;
  }
  return next;
}

export function removePlayer(state, playerId) {
  const next = structuredClone(state);
  next.players = next.players.filter(p => p.id !== playerId);
  delete next.elo[playerId];
  delete next.roundsPlayed[playerId];
  delete next.wins[playerId];
  delete next.losses[playerId];
  delete next.gamesFor[playerId];
  delete next.gamesAgainst[playerId];
  delete next.partnerCounts[playerId];
  delete next.opponentCounts[playerId];
  for (const other of next.players) {
    delete next.partnerCounts[other.id][playerId];
    delete next.opponentCounts[other.id][playerId];
  }
  return next;
}
```

- [ ] **Step 4: Implement `src/persistence.js`**

```js
const KEY = 'court-shuffle:session';
const DARK_KEY = 'court-shuffle:dark';

export function saveSession(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Failed to save session', e);
  }
}

export function loadSession() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to load session', e);
    return null;
  }
}

export function clearSession() {
  localStorage.removeItem(KEY);
}

export function saveDarkMode(on) {
  localStorage.setItem(DARK_KEY, on ? '1' : '0');
}

export function loadDarkMode() {
  return localStorage.getItem(DARK_KEY) === '1';
}
```

- [ ] **Step 5: Run tests**

Run: `npm test`
Expected: PASS — all 5 state tests pass, plus the earlier 24 still pass.

- [ ] **Step 6: Commit**

```bash
git add src/state.js src/persistence.js tests/state.test.js
git commit -m "feat(state): session model, applyScore, recompute, add/remove player, persistence"
```

---

## Task 7: Re-optimizer

**Files:**
- Modify: `src/scheduler.js` — add `reoptimizeFrom`
- Modify: `tests/scheduler.test.js` — add re-optimizer tests

Implements algorithm spec §5.3. Re-runs the greedy generator on a range of unlocked rounds, only replacing a round if the new cost is >5% lower.

- [ ] **Step 1: Add failing tests**

Append to `tests/scheduler.test.js`:

```js
import { reoptimizeFrom } from '../src/scheduler.js';

test('reoptimizeFrom does not touch rounds before fromIndex', () => {
  const state = blankState(['a','b','c','d','e','f']);
  const rng1 = createRng(1);
  const original = generateSchedule(state, 6, DEFAULT_WEIGHTS, rng1);
  const wrapped = original.map(c => ({ teamA: c.teamA, teamB: c.teamB, status: 'tentative', score: null, manuallyEdited: false }));
  const reoptimized = reoptimizeFrom({ ...state, schedule: wrapped }, 3, DEFAULT_WEIGHTS, createRng(2));
  for (let i = 0; i < 3; i++) {
    assert.deepEqual(reoptimized[i].teamA, wrapped[i].teamA);
    assert.deepEqual(reoptimized[i].teamB, wrapped[i].teamB);
  }
});

test('reoptimizeFrom skips manually edited rounds', () => {
  const state = blankState(['a','b','c','d','e','f']);
  const sched = generateSchedule(state, 5, DEFAULT_WEIGHTS, createRng(1))
    .map(c => ({ teamA: c.teamA, teamB: c.teamB, status: 'tentative', score: null, manuallyEdited: false }));
  sched[2].manuallyEdited = true;
  const before = { teamA: [...sched[2].teamA], teamB: [...sched[2].teamB] };
  const after = reoptimizeFrom({ ...state, schedule: sched }, 0, DEFAULT_WEIGHTS, createRng(2));
  assert.deepEqual(after[2].teamA, before.teamA);
  assert.deepEqual(after[2].teamB, before.teamB);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test`
Expected: FAIL — `reoptimizeFrom is not a function`.

- [ ] **Step 3: Add `reoptimizeFrom` to `src/scheduler.js`**

```js
// Append to src/scheduler.js

const REPLACE_THRESHOLD = 0.05; // require >5% cost improvement to swap

/**
 * Re-optimize the unlocked, non-manually-edited tail of the schedule starting
 * at fromIndex. Returns a NEW schedule array.
 */
export function reoptimizeFrom(state, fromIndex, weights, rng) {
  const result = state.schedule.map(r => ({ ...r, teamA: [...r.teamA], teamB: [...r.teamB] }));
  // Build a "simulated state" up through fromIndex - 1 using whatever
  // is already in the schedule (locked or completed counts toward fairness).
  let s = {
    players: state.players,
    roundsPlayed: { ...state.roundsPlayed },
    partnerCounts: structuredClone(state.partnerCounts),
    opponentCounts: structuredClone(state.opponentCounts),
    elo: { ...state.elo },
  };
  // Note: roundsPlayed/partner/opponentCounts already reflect completed
  // rounds (because applyScore updated them). We need to also simulate
  // locked-but-not-completed rounds and any tentative rounds before fromIndex.
  for (let i = 0; i < fromIndex; i++) {
    const r = result[i];
    if (r.status === 'tentative' || r.status === 'locked') {
      s = simulate(s, r);
    }
    // completed rounds are already baked into state, skip them
  }

  for (let i = fromIndex; i < result.length; i++) {
    const existing = result[i];
    if (existing.status === 'completed' || existing.status === 'locked' || existing.manuallyEdited) {
      // can't change these; just simulate forward
      s = simulate(s, existing);
      continue;
    }
    const existingCost = computeCost(existing, s, weights);
    const candidate = pickBestCandidate(s, weights, rng);
    const candidateCost = computeCost(candidate, s, weights);
    if (existingCost === 0 || candidateCost < existingCost * (1 - REPLACE_THRESHOLD)) {
      result[i] = { ...existing, teamA: candidate.teamA, teamB: candidate.teamB };
    }
    s = simulate(s, result[i]);
  }
  return result;
}
```

You must also import `computeCost` at the top of `src/scheduler.js` if not already imported. Check: the existing top-of-file import is `import { computeCost, DEFAULT_WEIGHTS } from './cost.js';` — `computeCost` is already imported.

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: PASS — 2 new tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/scheduler.js tests/scheduler.test.js
git commit -m "feat(scheduler): reoptimize unlocked tail with 5% improvement threshold"
```

---

## Task 8: HTML shell, CSS theme, PWA manifest

**Files:**
- Create: `index.html`
- Create: `styles.css`
- Create: `manifest.json`
- Create: `sw.js`
- Create: `icons/icon-192.png` (solid color placeholder)
- Create: `icons/icon-512.png` (solid color placeholder)

This is a UI task — verification is manual (open in browser).

- [ ] **Step 1: Create `index.html`**

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <meta name="theme-color" content="#fafaf7" />
  <link rel="manifest" href="manifest.json" />
  <link rel="apple-touch-icon" href="icons/icon-192.png" />
  <link rel="stylesheet" href="styles.css" />
  <title>Court Shuffle</title>
</head>
<body>
  <div id="app"></div>
  <script type="module" src="src/app.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create `styles.css`**

```css
:root {
  --bg: #fafaf7;
  --surface: #ffffff;
  --border: #e8e6df;
  --border-soft: #f0eee7;
  --text: #1a1a1a;
  --text-secondary: #8a8a85;
  --accent: #1a1a1a;
  --accent-text: #ffffff;
  --shadow: 0 4px 16px rgba(0,0,0,0.06);
}

body.dark {
  --bg: #0a0e1a;
  --surface: #131a2e;
  --border: #2a3550;
  --border-soft: #1a2540;
  --text: #ffffff;
  --text-secondary: #8a93a8;
  --accent: #d4ff00;
  --accent-text: #000000;
  --shadow: 0 4px 16px rgba(0,0,0,0.3);
}

* { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }

html, body {
  margin: 0;
  padding: 0;
  background: var(--bg);
  color: var(--text);
  font-family: -apple-system, system-ui, sans-serif;
  font-size: 15px;
  line-height: 1.4;
  min-height: 100vh;
}

#app {
  max-width: 480px;
  margin: 0 auto;
  padding: 16px;
  padding-bottom: env(safe-area-inset-bottom, 16px);
}

.screen-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 18px;
}

.screen-header .title { font-weight: 700; font-size: 18px; }

.label {
  font-size: 11px;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 1px;
  margin: 16px 0 8px;
}

.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 12px;
  margin-bottom: 8px;
}

.row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 4px;
  border-bottom: 1px solid var(--border-soft);
}
.row:last-child { border-bottom: none; }

.btn {
  background: var(--accent);
  color: var(--accent-text);
  border: none;
  border-radius: 8px;
  padding: 14px;
  font-size: 14px;
  font-weight: 600;
  width: 100%;
  cursor: pointer;
  font-family: inherit;
}
.btn:disabled { opacity: 0.4; }

.btn.ghost {
  background: var(--surface);
  color: var(--text);
  border: 1px solid var(--border);
}

.btn.small {
  width: auto;
  padding: 6px 12px;
  font-size: 13px;
}

.icon-btn {
  background: transparent;
  border: none;
  color: var(--text);
  font-size: 20px;
  padding: 8px;
  cursor: pointer;
}

input[type="text"], input[type="number"] {
  background: var(--surface);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 10px;
  font-size: 14px;
  font-family: inherit;
  width: 100%;
}

.skill-dots {
  display: flex;
  gap: 4px;
}
.skill-dots .dot {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--border);
  cursor: pointer;
}
.skill-dots .dot.filled { background: var(--text); }

.stepper {
  display: flex;
  align-items: center;
  gap: 14px;
}
.stepper button {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  font-size: 16px;
  cursor: pointer;
}
.stepper .val {
  font-size: 18px;
  font-weight: 600;
  min-width: 24px;
  text-align: center;
  font-variant-numeric: tabular-nums;
}

.match-team {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 0;
}
.match-team .names { font-size: 15px; }
.match-team .score {
  font-size: 32px;
  font-weight: 300;
  font-variant-numeric: tabular-nums;
}
.score-controls {
  display: flex;
  gap: 6px;
  margin-top: 4px;
}
.score-controls button {
  flex: 1;
  padding: 8px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  border-radius: 6px;
  font-size: 16px;
  cursor: pointer;
  font-family: inherit;
}

.next-block {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid var(--border);
}

.schedule-list .schedule-item {
  padding: 8px 4px;
  border-bottom: 1px solid var(--border-soft);
  font-size: 13px;
  display: flex;
  justify-content: space-between;
  color: var(--text);
}
.schedule-item.completed { opacity: 0.45; }
.schedule-item.locked { font-weight: 600; }
.schedule-item.edited::after { content: ' ✎'; color: var(--text-secondary); }

.menu-sheet {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.4);
  display: flex;
  align-items: flex-end;
  justify-content: center;
}
.menu-sheet .menu {
  background: var(--bg);
  width: 100%;
  max-width: 480px;
  border-radius: 12px 12px 0 0;
  padding: 12px;
}
.menu-sheet .menu button {
  display: block;
  width: 100%;
  text-align: left;
  background: transparent;
  border: none;
  color: var(--text);
  padding: 14px;
  font-size: 15px;
  cursor: pointer;
  border-bottom: 1px solid var(--border-soft);
  font-family: inherit;
}
.menu-sheet .menu button:last-child { border-bottom: none; }

.summary-hero {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 18px;
  text-align: center;
  margin-bottom: 12px;
}
.summary-hero .big {
  font-size: 38px;
  font-weight: 300;
  margin: 6px 0;
  font-variant-numeric: tabular-nums;
}
.summary-hero .meta {
  font-size: 12px;
  color: var(--text-secondary);
}
.leader-row {
  display: flex;
  align-items: center;
  padding: 10px 12px;
  border-bottom: 1px solid var(--border-soft);
  font-size: 14px;
}
.leader-row:last-child { border-bottom: none; }
.leader-row .rank { color: var(--text-secondary); width: 18px; font-variant-numeric: tabular-nums; }
.leader-row .name { flex: 1; margin-left: 8px; }
.leader-row .stat { font-variant-numeric: tabular-nums; }
```

- [ ] **Step 3: Create `manifest.json`**

```json
{
  "name": "Court Shuffle",
  "short_name": "Court Shuffle",
  "start_url": ".",
  "display": "standalone",
  "background_color": "#fafaf7",
  "theme_color": "#fafaf7",
  "icons": [
    { "src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

- [ ] **Step 4: Create `sw.js`**

```js
const VERSION = 'v1';
const CACHE = `court-shuffle-${VERSION}`;
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './manifest.json',
  './src/app.js',
  './src/router.js',
  './src/theme.js',
  './src/persistence.js',
  './src/state.js',
  './src/scheduler.js',
  './src/cost.js',
  './src/elo.js',
  './src/rng.js',
  './src/ui/setup.js',
  './src/ui/live.js',
  './src/ui/summary.js',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE).map(k => caches.delete(k))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(hit => hit || fetch(e.request))
  );
});
```

- [ ] **Step 5: Generate placeholder icons**

You can use any 192x192 and 512x512 PNG. A flat-color placeholder is fine for v1. Two options:

**Option A — ImageMagick (if installed):**
```bash
mkdir -p icons
magick -size 192x192 xc:'#1a1a1a' icons/icon-192.png
magick -size 512x512 xc:'#1a1a1a' icons/icon-512.png
```

**Option B — Python:**
```bash
mkdir -p icons
python3 -c "from PIL import Image; Image.new('RGB',(192,192),'#1a1a1a').save('icons/icon-192.png'); Image.new('RGB',(512,512),'#1a1a1a').save('icons/icon-512.png')"
```

**Option C — manual:** create any two PNG files at those sizes (download from any solid-color image source) and place them at the listed paths.

- [ ] **Step 6: Verify in browser**

Run: `npm run serve`
Open http://localhost:8000 in a browser.

Expected: a blank near-white page (no errors). Open browser devtools → Application tab → Manifest. Expected: manifest loaded, name "Court Shuffle", icons listed.

The page is blank because no UI module renders into `#app` yet — that comes in Tasks 9–11.

- [ ] **Step 7: Commit**

```bash
git add index.html styles.css manifest.json sw.js icons/
git commit -m "feat(shell): HTML/CSS/PWA shell with dark-mode theme tokens"
```

---

## Task 9: Router + bootstrap + theme

**Files:**
- Create: `src/router.js`
- Create: `src/theme.js`
- Create: `src/app.js`

The router shows one screen at a time by clearing `#app` and calling a render function. Bootstrap loads state from `localStorage` and decides whether to start at Setup, Live, or Summary.

- [ ] **Step 1: Create `src/theme.js`**

```js
import { saveDarkMode, loadDarkMode } from './persistence.js';

export function applyTheme(on) {
  document.body.classList.toggle('dark', on);
  document.querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', on ? '#0a0e1a' : '#fafaf7');
}

export function initTheme() {
  const on = loadDarkMode();
  applyTheme(on);
  return on;
}

export function toggleDarkMode() {
  const on = !document.body.classList.contains('dark');
  applyTheme(on);
  saveDarkMode(on);
  return on;
}
```

- [ ] **Step 2: Create `src/router.js`**

```js
import { renderSetup } from './ui/setup.js';
import { renderLive } from './ui/live.js';
import { renderSummary } from './ui/summary.js';

const root = () => document.getElementById('app');

export function go(screen, ...args) {
  root().innerHTML = '';
  switch (screen) {
    case 'setup':   return renderSetup(root(), go);
    case 'live':    return renderLive(root(), go, ...args);
    case 'summary': return renderSummary(root(), go, ...args);
    default: throw new Error(`Unknown screen: ${screen}`);
  }
}
```

- [ ] **Step 3: Create `src/app.js`**

```js
import { go } from './router.js';
import { initTheme } from './theme.js';
import { loadSession } from './persistence.js';

initTheme();

// Register service worker (PWA offline cache)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(err => {
      console.warn('Service worker registration failed', err);
    });
  });
}

// Decide initial screen
const session = loadSession();
if (!session) {
  go('setup');
} else {
  // If all rounds completed, go to summary; else live
  const allDone = session.schedule.every(r => r.status === 'completed');
  if (allDone) go('summary', session);
  else go('live', session);
}
```

- [ ] **Step 4: Stub the UI modules so the app loads**

Create `src/ui/setup.js`:

```js
export function renderSetup(root, go) {
  root.innerHTML = '<div class="screen-header"><div class="title">Setup (placeholder)</div></div>';
}
```

Create `src/ui/live.js`:

```js
export function renderLive(root, go, session) {
  root.innerHTML = `<div class="screen-header"><div class="title">Live (placeholder)</div></div>`;
}
```

Create `src/ui/summary.js`:

```js
export function renderSummary(root, go, session) {
  root.innerHTML = `<div class="screen-header"><div class="title">Summary (placeholder)</div></div>`;
}
```

These will be fleshed out in Tasks 10–12.

- [ ] **Step 5: Verify in browser**

Run: `npm run serve`
Open http://localhost:8000.
Expected: page shows "Setup (placeholder)" (since no session in localStorage).

In devtools console, run:
```js
localStorage.setItem('court-shuffle:session', '{"schedule":[],"players":[]}');
location.reload();
```
Expected: page shows "Summary (placeholder)" (empty schedule → all rounds completed vacuously).

Clean up:
```js
localStorage.clear();
location.reload();
```

- [ ] **Step 6: Commit**

```bash
git add src/router.js src/theme.js src/app.js src/ui/
git commit -m "feat(router): screen switcher, theme init, app bootstrap"
```

---

## Task 10: Setup screen

**Files:**
- Modify: `src/ui/setup.js`

Implements UI spec §5.1.

- [ ] **Step 1: Replace `src/ui/setup.js` with full implementation**

```js
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
      btn.onclick = e => {
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
```

- [ ] **Step 2: Verify in browser**

Run: `npm run serve`
Open http://localhost:8000.

Manual checks:
1. Type "Aldo" → press +. Player appears with 3 dots filled.
2. Tap the 4th dot → player now has 4 dots filled.
3. Add 5 more players (Maya, Jin, Sam, Lee, Priya). Start button is disabled until 6th player added.
4. After 6 players, Start button enables.
5. Tap + on rounds stepper → 10 → 11. Tap − to 9.
6. Try adding 9 players → 9th add is blocked.
7. Tap × on a player row → player removed.
8. Tap Start → screen switches to "Live (placeholder)" with the player list saved to localStorage.

Check devtools → Application → Local Storage → `court-shuffle:session` exists with a populated `schedule` array.

- [ ] **Step 3: Commit**

```bash
git add src/ui/setup.js
git commit -m "feat(ui): setup screen — add players, skill dots, rounds stepper"
```

---

## Task 11: Live session screen

**Files:**
- Modify: `src/ui/live.js`

Implements UI spec §5.2. The most complex UI — current match card, score entry, "save & next round" with re-optimization, next/resting block, collapsible schedule.

- [ ] **Step 1: Replace `src/ui/live.js` with full implementation**

```js
import { applyScore, removePlayer, addPlayer } from '../state.js';
import { reoptimizeFrom } from '../scheduler.js';
import { createRng } from '../rng.js';
import { saveSession, clearSession } from '../persistence.js';
import { toggleDarkMode } from '../theme.js';

export function renderLive(root, go, session) {
  let state = session;
  let scoreDraft = [0, 0]; // local score for current round before saving
  let scheduleExpanded = false;
  let menuOpen = false;

  function currentRoundIndex() {
    return state.schedule.findIndex(r => r.status !== 'completed');
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
      // all rounds done → summary
      go('summary', state);
      return;
    }
    const round = state.schedule[idx];
    const isLocked = round.status === 'locked';
    // Initialize scoreDraft from saved score if any
    if (round.score && (scoreDraft[0] === 0 && scoreDraft[1] === 0)) {
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
          ${state.schedule.map((r, i) => `
            <div class="schedule-item ${r.status} ${r.manuallyEdited ? 'edited' : ''}" data-round-idx="${i}">
              <span>R${i+1} · ${escapeHtml(r.teamA.map(playerName).join(', '))} vs ${escapeHtml(r.teamB.map(playerName).join(', '))}</span>
              <span>${r.score ? `${r.score[0]}–${r.score[1]}` : ''}</span>
            </div>
          `).join('')}
        </div>
      ` : ''}

      ${menuOpen ? menuHtml() : ''}
    `;
    bind();
  }

  function menuHtml() {
    return `
      <div class="menu-sheet" id="menu-sheet">
        <div class="menu">
          <button id="m-dark">Toggle dark mode</button>
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
      // Re-optimize rounds N+2 onward (do not touch round N+1)
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
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  render();
}
```

- [ ] **Step 2: Verify in browser**

Run: `npm run serve`. Reload http://localhost:8000.

If you have a leftover session from Task 10, the live screen should load directly. Otherwise: complete the setup flow first.

Manual checks:
1. Round 1 of 10 shown. Current match has two teams with names. Both scores at 0.
2. Tap +Team A four times → score shows 4.
3. Tap +Team B three times → score shows 3.
4. "Save & next round" was disabled until first score increment. Now enabled.
5. Tap "Save & next round" → screen updates to Round 2 with a new matchup. Scores reset to 0.
6. Tap ⋯ → menu sheet appears. Tap "Toggle dark mode" → app switches to dark theme. Reload — still dark.
7. Tap ⋯ → "Toggle dark mode" again to return to light.
8. Tap "▸ Full schedule" → list of all 10 rounds appears. Round 1 is faded (completed). Round 2 is shown as current (not faded).
9. Tap ⋯ → "End session early" → confirm → switches to Summary placeholder.
10. Clear localStorage and verify a fresh Setup → Live flow still works end-to-end.

- [ ] **Step 3: Commit**

```bash
git add src/ui/live.js
git commit -m "feat(ui): live session screen — match card, score entry, save+reoptimize, menu"
```

---

## Task 12: End summary screen

**Files:**
- Modify: `src/ui/summary.js`

Implements UI spec §5.3.

- [ ] **Step 1: Replace `src/ui/summary.js` with full implementation**

```js
import { clearSession, saveSession } from '../persistence.js';

export function renderSummary(root, go, session) {
  const state = session;
  const totalGames = state.schedule
    .filter(r => r.score)
    .reduce((acc, r) => acc + r.score[0] + r.score[1], 0);
  const elapsedMin = Math.round((Date.now() - state.startedAt) / 60000);
  const completedRounds = state.schedule.filter(r => r.status === 'completed').length;

  // Leaderboard sorted by wins desc, then (gamesFor - gamesAgainst) desc
  const leaderboard = [...state.players].sort((a, b) => {
    const wb = state.wins[b.id] - state.wins[a.id];
    if (wb !== 0) return wb;
    return (state.gamesFor[b.id] - state.gamesAgainst[b.id]) - (state.gamesFor[a.id] - state.gamesAgainst[a.id]);
  });

  const roundsRange = (() => {
    const vals = Object.values(state.roundsPlayed);
    return [Math.min(...vals), Math.max(...vals)];
  })();

  const avgUniquePartners = (() => {
    const counts = state.players.map(p => {
      const partnered = Object.entries(state.partnerCounts[p.id] || {}).filter(([, n]) => n > 0).length;
      return partnered;
    });
    const sum = counts.reduce((a, b) => a + b, 0);
    return (sum / counts.length).toFixed(1);
  })();

  root.innerHTML = `
    <div class="screen-header">
      <div class="title">Session complete</div>
      <button class="icon-btn" id="close-btn" aria-label="close">×</button>
    </div>

    <div class="summary-hero">
      <div class="meta">${completedRounds} rounds · ${formatDuration(elapsedMin)}</div>
      <div class="big">${totalGames} games</div>
      <div class="meta">played across ${state.players.length} players</div>
    </div>

    <div class="label">Leaderboard · wins</div>
    <div class="card" style="padding: 4px 0;">
      ${leaderboard.map((p, i) => `
        <div class="leader-row">
          <span class="rank">${i + 1}</span>
          <span class="name">${escapeHtml(p.name)}</span>
          <span class="stat">${state.wins[p.id]} W · ${state.losses[p.id]} L</span>
        </div>
      `).join('')}
    </div>

    <div class="label">Fairness check</div>
    <div class="card" style="padding: 4px 0;">
      <div class="leader-row">
        <span class="name">Rounds played</span>
        <span class="stat">${roundsRange[0]}–${roundsRange[1]} per player ${roundsRange[1] - roundsRange[0] <= 1 ? '✓' : ''}</span>
      </div>
      <div class="leader-row">
        <span class="name">Unique partners</span>
        <span class="stat">avg ${avgUniquePartners} / ${state.players.length - 1}</span>
      </div>
    </div>

    <button class="btn" id="new-btn" style="margin-top:18px;">New session</button>
    <button class="btn ghost" id="done-btn" style="margin-top:8px;">Done</button>
  `;

  root.querySelector('#close-btn').onclick = () => go('setup');
  root.querySelector('#new-btn').onclick = () => {
    if (confirm('Start a new session with the same players?')) {
      // Reuse roster via reuseRoster prop on next setup screen.
      // Simple approach: save a "lastRoster" key and let setup pre-fill it.
      // For v1, just clear and let user re-add. Future improvement.
      clearSession();
      go('setup');
    } else {
      clearSession();
      go('setup');
    }
  };
  root.querySelector('#done-btn').onclick = () => {
    if (confirm('Clear this session and return to a blank setup?')) {
      clearSession();
      go('setup');
    }
  };

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function formatDuration(min) {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }
}
```

- [ ] **Step 2: Verify in browser**

To test summary without playing 10 full rounds, use devtools console while on the Live screen:

```js
// In devtools console while live screen is showing:
const s = JSON.parse(localStorage.getItem('court-shuffle:session'));
s.schedule.forEach(r => { r.status = 'completed'; r.score = [6, 3]; });
localStorage.setItem('court-shuffle:session', JSON.stringify(s));
location.reload();
```

The app should auto-route to summary (because all rounds completed).

Manual checks on summary:
1. Headline shows "10 rounds · Xh Ym" and a big games total.
2. Leaderboard ranks 6 players by wins (descending).
3. Fairness check shows rounds-played range (likely 6–7 or 7–7 for 10 rounds × 4 / 6) and unique-partner average.
4. Tap "New session" → confirm → returns to Setup.
5. Tap "Done" → confirm → returns to Setup.

- [ ] **Step 3: Commit**

```bash
git add src/ui/summary.js
git commit -m "feat(ui): end summary — leaderboard, fairness receipt, new/done actions"
```

---

## Task 13: Mid-session add/remove player

**Files:**
- Modify: `src/ui/live.js` — add menu items "Add player" and "Remove player"

Implements UI spec §6.4. Lets the organizer adjust roster between rounds.

- [ ] **Step 1: Add menu options and prompts in live.js**

In `src/ui/live.js`, locate the `menuHtml()` function and replace it with:

```js
function menuHtml() {
  return `
    <div class="menu-sheet" id="menu-sheet">
      <div class="menu">
        <button id="m-dark">Toggle dark mode</button>
        <button id="m-add">Add player</button>
        <button id="m-remove">Remove player</button>
        <button id="m-end">End session early</button>
        <button id="m-cancel" style="color:var(--text-secondary)">Close</button>
      </div>
    </div>
  `;
}
```

Then in `bind()`, inside the `if (menuOpen) { ... }` block, after the existing `m-end` handler, add:

```js
root.querySelector('#m-add').onclick = () => {
  const name = prompt('New player name?');
  if (!name || !name.trim()) { menuOpen = false; render(); return; }
  if (state.players.length >= 8) { alert('Max 8 players.'); menuOpen = false; render(); return; }
  const skillStr = prompt('Seed skill 1–5?', '3');
  const skill = Math.max(1, Math.min(5, parseInt(skillStr, 10) || 3));
  const id = `p${Date.now()}`;
  state = addPlayer(state, { id, name: name.trim(), seedSkill: skill });
  // Re-optimize all unlocked rounds (per spec §5.2)
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
```

- [ ] **Step 2: Verify in browser**

Run `npm run serve`. Run a session with 6 players to round 2 or 3, then:
1. Tap ⋯ → "Add player" → enter a name and skill 4 → schedule updates with 7th player included in future rounds.
2. Tap ⋯ → "Remove player" → enter an id from the prompt list → confirm → player removed, schedule updated.
3. Try to add a 9th player → blocked with alert.
4. Try to remove down to 5 players → blocked with alert.

- [ ] **Step 3: Commit**

```bash
git add src/ui/live.js
git commit -m "feat(ui): mid-session add/remove player with re-optimization"
```

---

## Task 14: Past-round score editing

**Files:**
- Modify: `src/ui/live.js` — make completed schedule items editable

Implements UI spec §6.4 (edit a past score → recompute derived state).

- [ ] **Step 1: Add click handlers on completed schedule items**

In `src/ui/live.js`, in `bind()`, after the `#sched-toggle` handler, add:

```js
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
      // Update the schedule entry and recompute everything from completed log
      state.schedule[i].score = [a, b];
      // Recompute by rebuilding from scratch
      import('../state.js').then(({ recomputeFromCompleted }) => {
        state = recomputeFromCompleted(state);
        // Re-optimize the rest
        const idx = currentRoundIndex();
        const fromIdx = idx >= 0 ? idx + 1 : state.schedule.length;
        const rng = createRng((state.seed + i + 3000) >>> 0);
        const reopt = reoptimizeFrom(state, fromIdx, state.weights, rng);
        state = { ...state, schedule: reopt };
        persist();
        render();
      });
    };
  });
}
```

Also add the import at the top of `src/ui/live.js` so the dynamic import is unnecessary — replace the dynamic import with a static one. Update the imports at the top:

```js
import { applyScore, removePlayer, addPlayer, recomputeFromCompleted } from '../state.js';
```

And rewrite the handler to use the static import:

```js
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
}
```

- [ ] **Step 2: Verify in browser**

Play through 2 rounds entering scores. Open Full schedule → tap on the (faded) Round 1 entry. A prompt appears. Enter a different score. The schedule list updates and the Up Next / current round may shift if the new score significantly changed Elo.

- [ ] **Step 3: Commit**

```bash
git add src/ui/live.js
git commit -m "feat(ui): tap completed rounds to edit scores; recompute downstream"
```

---

## Task 15: Manual override (swap players in tentative round)

**Files:**
- Modify: `src/ui/live.js` — long-press on tentative round opens swap UI

Implements UI spec §5.2 (manual override). Long-press is hard on desktop — we'll provide a simple "tap to edit" affordance on tentative future rounds when the schedule is expanded.

- [ ] **Step 1: Add edit interaction for tentative rounds**

In `src/ui/live.js`, inside `bind()`, after the completed-items handler, add:

```js
if (scheduleExpanded) {
  root.querySelectorAll('.schedule-item.tentative').forEach(el => {
    el.onclick = () => {
      const i = +el.dataset.roundIdx;
      const r = state.schedule[i];
      const allIds = state.players.map(p => p.id);
      const onCourt = [...r.teamA, ...r.teamB];
      const resting = allIds.filter(id => !onCourt.includes(id));
      const display = (id) => `${state.players.find(p => p.id === id)?.name} (${id})`;
      const prompt1 = prompt(
        `Round ${i + 1} edit. Current:\nTeam A: ${r.teamA.map(display).join(', ')}\nTeam B: ${r.teamB.map(display).join(', ')}\nResting: ${resting.map(display).join(', ')}\n\n` +
        `Enter new lineup as: A-id1,A-id2 / B-id1,B-id2`,
        `${r.teamA.join(',')} / ${r.teamB.join(',')}`
      );
      if (!prompt1) return;
      const m = prompt1.match(/^\s*([^,/]+)\s*,\s*([^,/]+)\s*\/\s*([^,/]+)\s*,\s*([^,/]+)\s*$/);
      if (!m) { alert('Format: id,id / id,id'); return; }
      const newA = [m[1].trim(), m[2].trim()];
      const newB = [m[3].trim(), m[4].trim()];
      const all = [...newA, ...newB];
      if (new Set(all).size !== 4) { alert('Need 4 distinct players.'); return; }
      if (!all.every(id => allIds.includes(id))) { alert('Unknown player id.'); return; }
      state.schedule[i].teamA = newA;
      state.schedule[i].teamB = newB;
      state.schedule[i].manuallyEdited = true;
      persist();
      render();
    };
  });
}
```

- [ ] **Step 2: Verify in browser**

Run a session. Expand Full schedule. Tap a future (tentative) round entry. A prompt shows the current lineup. Enter a new one with valid player ids. The schedule shows the edited round with a "✎" marker. Subsequent re-optimizations do not overwrite it.

- [ ] **Step 3: Commit**

```bash
git add src/ui/live.js
git commit -m "feat(ui): manual override for tentative rounds with edited flag"
```

---

## Task 16: Final integration & smoke test

**Files:** none (verification only)

- [ ] **Step 1: Full test suite**

Run: `npm test`
Expected: all tests pass — RNG, Elo, cost, scheduler (incl. reoptimize), state.

- [ ] **Step 2: Full manual smoke test**

Run: `npm run serve`. In a private/incognito tab (clean localStorage):

1. **Setup:** add 6 players with varying skill (1, 2, 3, 3, 4, 5). Set target rounds to 8. Start.
2. **Live:** play through all 8 rounds, entering varying scores. Watch that:
   - Up next changes each round.
   - Resting list rotates fairly (each player should appear in resting roughly the same number of times — `(8 × 2) / 6 ≈ 2–3` times).
   - Re-optimization is silent (no visible jumps in round N+1 between scoring round N and starting round N+1).
3. **Edit a past score** halfway through; verify the leaderboard and Elo reflect the change.
4. **Add a player mid-session**; verify they appear in future rounds.
5. **Toggle dark mode** under the menu; reload page; confirm dark mode persisted.
6. **End session** (either after round 8 or via "End early"). Verify the summary shows reasonable wins distribution and a fairness range like "1–2 per player" for rounds played gap.
7. **Install PWA:** on Chrome desktop, click the install icon in the address bar. Confirm "Court Shuffle" installs and launches in its own window.
8. **Offline test:** in devtools → Network tab → check "Offline" → reload the app. Confirm it loads from the service worker cache.

- [ ] **Step 3: Commit final state if anything tweaked**

```bash
git status   # should be clean if no edits
# If any tweaks were needed, commit them here.
```

---

## Self-Review Notes

This plan covers both specs end-to-end:

- Algorithm spec §3 (state) → Task 6
- Algorithm spec §4 (cost) → Task 4
- Algorithm spec §5.1 (schedule generation) → Task 5
- Algorithm spec §5.2 (round lifecycle, add/remove player, edit past score) → Tasks 11, 13, 14
- Algorithm spec §5.3 (re-optimizer) → Task 7
- Algorithm spec §5.4 (lock-ahead buffer) → Task 11 (re-optimize from idx+2)
- Algorithm spec §5.5 (manual override) → Task 15
- Algorithm spec §6 (Elo) → Task 3

- UI spec §4 (visual style + dark mode) → Tasks 8, 9
- UI spec §5.1 (Setup) → Task 10
- UI spec §5.2 (Live) → Task 11
- UI spec §5.3 (End summary) → Task 12
- UI spec §6 (interaction details, mid-session edits) → Tasks 13, 14, 15
- UI spec §7 (PWA, single static deployable) → Task 8 (manifest + sw) + Task 9 (sw registration)

The "reuse last roster" UX hinted at in UI spec §5.3 is intentionally deferred — the current "New session" button clears state and routes back to Setup, which is acceptable for v1.
