# Hard Cap on Consecutive Sit-Outs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Guarantee no player sits out more than 2 rounds in a row, and make the current streak visible in the UI.

**Architecture:** Add a `sitStreak` counter tracked alongside `roundsPlayed` throughout `state.js`/`scheduler.js`. Add a pre-filter in `scheduler.js`'s candidate selection that forces inclusion of any player who has hit the cap, before the existing cost-based optimization runs. Apply the same cap-aware override to `reoptimizeFrom`'s replace-threshold logic so a cap-violating already-scheduled round always gets replaced. Surface the streak in `live.js`'s existing "Resting" card.

**Tech Stack:** Vanilla JS (ES modules), `node:test` + `node:assert/strict` for unit tests, no build step.

## Global Constraints

- Max consecutive sit-outs: fixed at `2` (not configurable) — spec section "Non-goals".
- No changes to `DEFAULT_WEIGHTS` or preset weight values — spec section "Non-goals".
- Cap applies going forward only; `locked`/`manuallyEdited` rounds remain untouched by `reoptimizeFrom` as today — spec section "Scheduling change".
- Court capacity: `doubles` = 4 players on court, `singles` = 2 — derived from `enumerateCandidates` in `src/scheduler.js`.

---

### Task 1: Track `sitStreak` in session state lifecycle

**Files:**
- Modify: `src/state.js:15-19` (`blankPerPlayer` already exists, reuse it), `src/state.js:24-47` (`createSession`), `src/state.js:126-146` (`addPlayer`), `src/state.js:148-184` (`removePlayer`)
- Test: `tests/state.test.js`

**Interfaces:**
- Produces: `state.sitStreak` — an object mapping player id → number of consecutive rounds not on court, with the same lifecycle as `state.roundsPlayed` (initialized to `0` at session creation and on `addPlayer`, deleted on `removePlayer`).

- [ ] **Step 1: Write the failing tests**

Add to `tests/state.test.js`, right after the existing `createSession initializes players...` test (after line 33):

```js
test('createSession initializes sitStreak to 0 for every player', () => {
  const s = createSession({ players: PLAYERS, targetRounds: 8, seed: 42 });
  for (const p of PLAYERS) {
    assert.equal(s.sitStreak[p.id], 0);
  }
});
```

Add right after the existing `addPlayer extends roster and zeroes their counts` test (after line 74):

```js
test('addPlayer initializes sitStreak to 0 for the new player', () => {
  const s = createSession({ players: PLAYERS, targetRounds: 4, seed: 1 });
  const next = addPlayer(s, { id: 'g', name: 'Kai', seedSkill: 2 });
  assert.equal(next.sitStreak.g, 0);
});
```

Add right after the existing `removePlayer drops them from state and all counts` test (after line 82):

```js
test('removePlayer drops the player from sitStreak', () => {
  const s = createSession({ players: PLAYERS, targetRounds: 4, seed: 1 });
  const next = removePlayer(s, 'f');
  assert.equal(next.sitStreak.f, undefined);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `s.sitStreak` / `next.sitStreak` is `undefined`, so `assert.equal(undefined, 0)` fails for the three new tests.

- [ ] **Step 3: Implement**

In `src/state.js`, inside `createSession` (around line 33, right after `roundsPlayed: blankPerPlayer(ids, 0),`):

```js
    roundsPlayed: blankPerPlayer(ids, 0),
    sitStreak: blankPerPlayer(ids, 0),
```

In `addPlayer` (around line 131, right after `next.roundsPlayed[id] = 0;`):

```js
  next.roundsPlayed[id] = 0;
  next.sitStreak[id] = 0;
```

In `removePlayer` (around line 158, right after `delete next.roundsPlayed[playerId];`):

```js
  delete next.roundsPlayed[playerId];
  delete next.sitStreak[playerId];
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — all tests including the 3 new ones.

- [ ] **Step 5: Commit**

```bash
git add src/state.js tests/state.test.js
git commit -m "track sitStreak alongside roundsPlayed in session state"
```

---

### Task 2: Update `sitStreak` inside `scheduler.simulate()` and wire it through `applyScore`

**Files:**
- Modify: `src/scheduler.js:60-94` (`simulate`), `src/state.js:60-93` (`applyScore`)
- Test: `tests/scheduler.test.js`, `tests/state.test.js`

**Interfaces:**
- Consumes: `state.sitStreak` (produced by Task 1).
- Produces: `simulate(state, candidate)` now also returns an updated `sitStreak` field: `0` for every player in `[...candidate.teamA, ...candidate.teamB]`, incremented by `1` for every other player already tracked in `state.sitStreak`. Downstream code (Task 3, Task 4) relies on `simulate(...).sitStreak` being present and accurate.

- [ ] **Step 1: Write the failing tests**

In `tests/scheduler.test.js`, update the `blankState` helper (lines 13-26) to also produce `sitStreak`:

```js
function blankState(ids) {
  const partnerCounts = {};
  const opponentCounts = {};
  const elo = {};
  const roundsPlayed = {};
  const sitStreak = {};
  for (const id of ids) {
    partnerCounts[id] = {};
    opponentCounts[id] = {};
    elo[id] = 1300;
    roundsPlayed[id] = 0;
    sitStreak[id] = 0;
    for (const j of ids) if (j !== id) { partnerCounts[id][j] = 0; opponentCounts[id][j] = 0; }
  }
  return { players: ids, partnerCounts, opponentCounts, elo, roundsPlayed, sitStreak };
}
```

Add a new test right after `simulate advances roundsPlayed and partner/opponent counts` (after line 73):

```js
test('simulate resets sitStreak for on-court players and increments it for resting players', () => {
  const state = blankState(['a','b','c','d','e','f']);
  state.sitStreak.e = 1;
  state.sitStreak.f = 2;
  const candidate = { teamA: ['a','b'], teamB: ['c','d'] };
  const next = simulate(state, candidate);
  assert.equal(next.sitStreak.a, 0);
  assert.equal(next.sitStreak.b, 0);
  assert.equal(next.sitStreak.c, 0);
  assert.equal(next.sitStreak.d, 0);
  assert.equal(next.sitStreak.e, 2);
  assert.equal(next.sitStreak.f, 3);
});
```

In `tests/state.test.js`, add a new test right after `applyScore marks round completed and updates wins/losses/games/Elo/counts` (after line 55):

```js
test('applyScore updates sitStreak: 0 for players in the round, +1 for everyone else', () => {
  const s0 = createSession({ players: PLAYERS, targetRounds: 5, seed: 1 });
  const s1 = applyScore(s0, 0, 6, 3);
  const r = s1.schedule[0];
  for (const id of [...r.teamA, ...r.teamB]) {
    assert.equal(s1.sitStreak[id], 0);
  }
  const restingIds = PLAYERS.map(p => p.id).filter(id => !r.teamA.includes(id) && !r.teamB.includes(id));
  for (const id of restingIds) {
    assert.equal(s1.sitStreak[id], 1);
  }
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `next.sitStreak` is `undefined` in the scheduler test (simulate doesn't produce it yet); `s1.sitStreak` is `undefined` in the state test (applyScore's `simulate` call doesn't pass/receive `sitStreak` yet).

- [ ] **Step 3: Implement**

In `src/scheduler.js`, update `simulate` (lines 60-94):

```js
export function simulate(state, candidate) {
  const partnerCounts = structuredClone(state.partnerCounts);
  const opponentCounts = structuredClone(state.opponentCounts);
  const roundsPlayed = { ...state.roundsPlayed };
  const sitStreak = { ...state.sitStreak };

  const onCourt = [...candidate.teamA, ...candidate.teamB];
  // A completed round can reference a player who was later removed mid-session;
  // their stat/count maps are gone. Skip those ids so replaying history to
  // rebuild counts doesn't dereference a missing entry (they no longer count).
  for (const p of onCourt) {
    if (p in roundsPlayed) roundsPlayed[p] += 1;
  }
  for (const p of Object.keys(sitStreak)) {
    sitStreak[p] = onCourt.includes(p) ? 0 : sitStreak[p] + 1;
  }

  const inc = (map, x, y) => {
    if (!map[x]) return;
    map[x][y] = (map[x][y] ?? 0) + 1;
  };
  for (const team of [candidate.teamA, candidate.teamB]) {
    for (let i = 0; i < team.length; i++) {
      for (let j = i + 1; j < team.length; j++) {
        inc(partnerCounts, team[i], team[j]);
        inc(partnerCounts, team[j], team[i]);
      }
    }
  }

  for (const a of candidate.teamA) {
    for (const b of candidate.teamB) {
      inc(opponentCounts, a, b);
      inc(opponentCounts, b, a);
    }
  }

  return { ...state, partnerCounts, opponentCounts, roundsPlayed, sitStreak };
}
```

In `src/state.js`, update the `simulate` call inside `applyScore` (lines 68-77) to pass and receive `sitStreak`:

```js
  const sim = simulate({
    players: next.players.map(p => p.id),
    roundsPlayed: next.roundsPlayed,
    sitStreak: next.sitStreak,
    partnerCounts: next.partnerCounts,
    opponentCounts: next.opponentCounts,
    elo: next.elo,
  }, { teamA: r.teamA, teamB: r.teamB });
  next.roundsPlayed = sim.roundsPlayed;
  next.sitStreak = sim.sitStreak;
  next.partnerCounts = sim.partnerCounts;
  next.opponentCounts = sim.opponentCounts;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — all tests including the 2 new ones.

- [ ] **Step 5: Commit**

```bash
git add src/scheduler.js src/state.js tests/scheduler.test.js tests/state.test.js
git commit -m "propagate sitStreak through simulate() and applyScore"
```

---

### Task 3: Enforce the hard cap in `pickBestCandidate`

**Files:**
- Modify: `src/scheduler.js` (add helpers near top, update `pickBestCandidate` at lines 44-58)
- Test: `tests/scheduler.test.js`

**Interfaces:**
- Consumes: `state.sitStreak` (Task 1/2), `state.format`, `state.players`.
- Produces: `MAX_CONSECUTIVE_SIT` (exported constant, value `2`) and `mandatoryPlayers(state)` (module-private helper — used again in Task 4, defined once here). `pickBestCandidate` now never returns a candidate that excludes a player who has already sat out `MAX_CONSECUTIVE_SIT` rounds in a row, unless doing so is impossible given court capacity (in which case it prioritizes the longest-waiting players).

- [ ] **Step 1: Write the failing tests**

Add to `tests/scheduler.test.js`, right after `pickBestCandidate uses rng for ties...` (after line 61):

```js
test('pickBestCandidate forces in a player who has hit the consecutive sit-out cap, even against a strong skill penalty', () => {
  const state = blankState(['a','b','c','d','e','f']);
  // 'a' is a massive skill outlier: every candidate including them scores a
  // large skill penalty relative to the tiny rest-penalty cost of excluding
  // them for one more round.
  state.elo.a = 3000;
  state.sitStreak.a = 2; // already sat out 2 rounds in a row
  const rng = createRng(1);
  const best = pickBestCandidate(state, DEFAULT_WEIGHTS, rng);
  assert.ok(best.teamA.includes('a') || best.teamB.includes('a'),
    'a must be forced onto court once their sit streak hits the cap');
});

test('pickBestCandidate degrades gracefully when more players hit the cap than court capacity (singles)', () => {
  const state = blankState(['a','b','c','d','e','f']);
  state.format = 'singles';
  state.sitStreak.a = 3;
  state.sitStreak.b = 2;
  state.sitStreak.c = 2;
  const rng = createRng(1);
  const best = pickBestCandidate(state, DEFAULT_WEIGHTS, rng);
  const onCourt = [...best.teamA, ...best.teamB];
  assert.equal(onCourt.length, 2);
  assert.ok(onCourt.includes('a'), 'longest-waiting player (streak 3) must be prioritized');
});

test('pickBestCandidate is unaffected by the cap when no one has hit it', () => {
  const state = blankState(['a','b','c','d','e','f']);
  state.roundsPlayed.a = 5;
  const rng = createRng(1);
  const best = pickBestCandidate(state, DEFAULT_WEIGHTS, rng);
  assert.ok(!best.teamA.includes('a') && !best.teamB.includes('a'));
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL on the first two new tests — with no cap enforcement, `pickBestCandidate` picks purely by cost and excludes the skill-outlier / doesn't prioritize longest-waiting players.

- [ ] **Step 3: Implement**

In `src/scheduler.js`, add near the top of the file, after the `import` line:

```js
export const MAX_CONSECUTIVE_SIT = 2;

function courtCapacity(format) {
  return format === 'singles' ? 2 : 4;
}

function mandatoryPlayers(state) {
  const sitStreak = state.sitStreak ?? {};
  const capacity = courtCapacity(state.format);
  let mandatory = state.players.filter(p => (sitStreak[p] ?? 0) >= MAX_CONSECUTIVE_SIT);
  if (mandatory.length > capacity) {
    mandatory = [...mandatory]
      .sort((a, b) => (sitStreak[b] ?? 0) - (sitStreak[a] ?? 0))
      .slice(0, capacity);
  }
  return mandatory;
}

function filterByMandatory(candidates, mandatory) {
  if (mandatory.length === 0) return candidates;
  return candidates.filter(c => {
    const onCourt = new Set([...c.teamA, ...c.teamB]);
    return mandatory.every(p => onCourt.has(p));
  });
}
```

Update `pickBestCandidate` (lines 44-58):

```js
export function pickBestCandidate(state, weights, rng) {
  const candidates = enumerateCandidates(state.players, state.format);
  const mandatory = mandatoryPlayers(state);
  const filtered = filterByMandatory(candidates, mandatory);
  const pool = filtered.length > 0 ? filtered : candidates;
  let minCost = Infinity;
  let best = [];
  for (const c of pool) {
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — all tests including the 3 new ones.

- [ ] **Step 5: Commit**

```bash
git add src/scheduler.js tests/scheduler.test.js
git commit -m "enforce hard cap on consecutive sit-outs in pickBestCandidate"
```

---

### Task 4: Make `reoptimizeFrom` override the replace-threshold when a scheduled round violates the cap

**Files:**
- Modify: `src/scheduler.js:118-154` (`reoptimizeFrom`)
- Test: `tests/scheduler.test.js`

**Interfaces:**
- Consumes: `mandatoryPlayers(state)` (module-private helper from Task 3), `state.sitStreak`.
- Produces: `reoptimizeFrom` now always replaces an unlocked/non-manually-edited round that excludes a currently-mandatory player, regardless of `REPLACE_THRESHOLD`. (Without this, the existing "only replace if >5% cheaper" rule can block cap enforcement — forcing in an overdue player often makes the round's raw cost *higher*, not lower, since it can hurt skill/partner balance.)

- [ ] **Step 1: Write the failing test**

Add to `tests/scheduler.test.js`, right after `reoptimizeFrom skips manually edited rounds` (after line 122):

```js
test('reoptimizeFrom replaces a cap-violating round even though the swap is not cheaper', () => {
  const ids = ['a','b','c','d','e','f'];
  const state = blankState(ids);
  // A round already exists that excludes 'a', and 'a' has already sat out
  // the max consecutive rounds allowed — reoptimizeFrom must swap them in
  // even though 'a' being a skill outlier makes every candidate involving
  // them cost more than the existing (unfair) round.
  state.elo.a = 3000;
  state.sitStreak.a = 2;
  const existingRound = { teamA: ['b','c'], teamB: ['d','e'], status: 'tentative', score: null, manuallyEdited: false };
  const stateWithSchedule = { ...state, schedule: [existingRound] };
  const result = reoptimizeFrom(stateWithSchedule, 0, DEFAULT_WEIGHTS, createRng(1));
  const onCourt = [...result[0].teamA, ...result[0].teamB];
  assert.ok(onCourt.includes('a'), 'a must be swapped in despite the existing round being cheaper');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — without the override, the existing round (cheaper, since it avoids the skill outlier) is kept as-is.

- [ ] **Step 3: Implement**

In `src/scheduler.js`, update the `s` initialization inside `reoptimizeFrom` (around line 121-130) to carry `sitStreak`:

```js
  let s = {
    players: Array.isArray(state.players) && typeof state.players[0] === 'object'
      ? state.players.map(p => p.id)
      : state.players,
    format: state.format,
    roundsPlayed: { ...state.roundsPlayed },
    sitStreak: { ...state.sitStreak },
    partnerCounts: structuredClone(state.partnerCounts),
    opponentCounts: structuredClone(state.opponentCounts),
    elo: { ...state.elo },
  };
```

Update the replacement loop (around lines 139-152):

```js
  for (let i = fromIndex; i < result.length; i++) {
    const existing = result[i];
    if (existing.status === 'completed' || existing.status === 'locked' || existing.manuallyEdited) {
      s = simulate(s, existing);
      continue;
    }
    const mandatory = mandatoryPlayers(s);
    const existingOnCourt = new Set([...existing.teamA, ...existing.teamB]);
    const violatesCap = mandatory.some(p => !existingOnCourt.has(p));
    const existingCost = computeCost(existing, s, weights);
    const candidate = pickBestCandidate(s, weights, rng);
    const candidateCost = computeCost(candidate, s, weights);
    if (violatesCap || existingCost === 0 || candidateCost < existingCost * (1 - REPLACE_THRESHOLD)) {
      result[i] = { ...existing, teamA: candidate.teamA, teamB: candidate.teamB };
    }
    s = simulate(s, result[i]);
  }
  return result;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — all tests including the new one.

- [ ] **Step 5: Commit**

```bash
git add src/scheduler.js tests/scheduler.test.js
git commit -m "override reoptimizeFrom's replace threshold when a round violates the sit-out cap"
```

---

### Task 5: Show the current sit streak in the "Resting" card

**Files:**
- Modify: `src/ui/live.js:67-106`
- Test: `tests/live-resting.test.js` (new file, for the pure formatting helper only — `live.js` has no other automated tests today; the rest of this task is verified manually)

**Interfaces:**
- Consumes: `state.sitStreak` (Task 1/2), `restingIds` (already computed at `live.js:67-69`), `playerName` (already defined at `live.js:29-30`).
- Produces: `restingLabel(name, streak)` — exported pure function from `src/ui/live.js`, returns `"Sam"` when `streak` is `0`, or `"Sam · sat out 2"` when `streak >= 1`.

- [ ] **Step 1: Write the failing test**

Create `tests/live-resting.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { restingLabel } from '../src/ui/live.js';

test('restingLabel omits the streak when it is 0', () => {
  assert.equal(restingLabel('Sam', 0), 'Sam');
});

test('restingLabel shows the streak when it is 1 or more', () => {
  assert.equal(restingLabel('Sam', 1), 'Sam · sat out 1');
  assert.equal(restingLabel('Sam', 2), 'Sam · sat out 2');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `restingLabel` is not exported from `src/ui/live.js` yet.

- [ ] **Step 3: Implement**

In `src/ui/live.js`, add this exported function near the top, right after the `renderLive` function's opening (or as a standalone top-level export before `renderLive`, e.g. right after the `import` block at line 4):

```js
export function restingLabel(name, streak) {
  return streak >= 1 ? `${name} · sat out ${streak}` : name;
}
```

Update the "Resting" card render (lines 99-106) to use it:

```js
      ${restingIds.length > 0 ? `
        <div class="label">Resting</div>
        <div class="card">
          <div class="row" style="border-bottom:none;padding:10px 4px;">
            <span style="font-size:var(--text-control);color:var(--text-secondary);">${escapeHtml(restingIds.map(id => restingLabel(playerName(id), state.sitStreak[id] ?? 0)).join(', '))}</span>
          </div>
        </div>
      ` : ''}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — all tests including the 2 new ones.

- [ ] **Step 5: Manual verification**

Run: `npm run serve`, open `http://localhost:8000`, start a session with 6 players, play through a few rounds without scoring evenly (so someone accumulates a streak), and confirm the "Resting" card shows `Name · sat out N` for anyone with `N >= 1`, and plain `Name` (no suffix) for anyone with a streak of `0`. Also confirm that by round 3, no one who was resting in the two prior rounds is still resting (the cap is visibly working).

- [ ] **Step 6: Commit**

```bash
git add src/ui/live.js tests/live-resting.test.js
git commit -m "show consecutive sit-out streak in the Resting card"
```

---

## Post-plan check

After all 5 tasks are committed, run the full suite once more and confirm nothing regressed:

```bash
npm test
```

Expected: all tests pass, including the pre-existing `generateSchedule distributes rest fairly for 6 players over 9 rounds` test (the cap is a pre-filter that only activates once someone has already hit the sit-out threshold, so it should not change behavior in the already-fair baseline case).
