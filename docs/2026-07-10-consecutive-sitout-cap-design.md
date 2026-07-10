# Design: Hard cap on consecutive sit-outs

## Problem

Players report waiting up to 3 rounds in a row before getting on court within a
single session. The scheduler's cost function (`src/cost.js`) weights rest
(`1000`) far above skill (`1`–`6` depending on preset), so in the steady state
a sitter is pulled back onto court almost immediately once their
`roundsPlayed` falls behind the group minimum. But rest penalty only grows to
`1, 4, 9, ...` as a sit-out streak lengthens, while skill penalty for a
matchup involving a skill outlier stays roughly constant round to round. For
the first couple of rounds after falling behind, a persistent skill mismatch
(or other structural tie-break bias) can outweigh the still-small rest
penalty, delaying a specific player's return to court — consistently, not
randomly, since the bias doesn't change round to round until rest penalty
catches up.

There is currently no hard guarantee against this: fairness is entirely a
soft, weighted preference.

## Goal

Guarantee that no player sits out more than 2 rounds in a row, regardless of
skill, partner, or opponent penalties, while making that guarantee visible in
the UI. This should hold across schedule generation, mid-session
re-optimization (add/remove player, edit a round, adjust settings), for both
`doubles` and `singles` formats.

## Non-goals

- Cross-session fairness (state already resets per session; out of scope).
- Configurable cap value — fixed at 2 for now (YAGNI; can be revisited if
  requested).
- Changing the underlying cost weights (`DEFAULT_WEIGHTS`, presets) — the cap
  is a structural pre-filter, not a re-tuning of the soft optimizer.

## Data model

Add `sitStreak`, a per-player counter with the same lifecycle as the existing
`roundsPlayed` map:

- **Initial state** (`state.js`, session setup): `blankPerPlayer(ids, 0)`,
  alongside `roundsPlayed`.
- **`addPlayer`**: `next.sitStreak[id] = 0`.
- **`removePlayer`**: `delete next.sitStreak[playerId]`.
- **`scheduler.simulate()`**: after computing `onCourt` for a candidate, for
  every player in `state.players`:
  - if they're in `onCourt`, set their streak to `0`;
  - otherwise increment their streak by `1`.
  (Mirrors the existing `roundsPlayed` increment loop right above it.)

`sitStreak` persists through `saveSession`/`loadSession` automatically since
it's part of `state` like every other tracked map.

## Scheduling change

In `scheduler.js`, add:

```js
const MAX_CONSECUTIVE_SIT = 2;
```

In `pickBestCandidate(state, weights, rng)`, before the existing cost-scoring
loop:

1. Compute `mandatory = state.players.filter(p => (state.sitStreak[p] ?? 0) >= MAX_CONSECUTIVE_SIT)`.
2. If `mandatory.length` is small enough to fit on court (`<= 4` for doubles,
   `<= 2` for singles), filter `candidates` to only those whose on-court set
   is a superset of `mandatory`. Run the existing min-cost selection over that
   filtered list, exactly as today.
3. If `mandatory.length` exceeds court capacity (realistically only possible
   in `singles` with a large bench), sort `mandatory` by `sitStreak`
   descending and take as many as fit; filter candidates to include that
   reduced set instead. This degrades the guarantee gracefully (closest
   possible rather than a hard failure) rather than leaving candidates empty.
4. If the mandatory-filtered candidate list is ever empty for some
   unanticipated reason, fall back to the unfiltered candidate list (never
   let the scheduler produce zero options).

Because `generateSchedule` and `reoptimizeFrom` both call
`pickBestCandidate` for every round they (re)decide, this single change
enforces the cap consistently across initial generation, mid-session add/
remove, manual round edits, and settings/preset changes — no duplicated
logic elsewhere.

Locked and manually-edited rounds are intentionally left untouched by
`reoptimizeFrom` today (organizer override), so the cap does not apply
retroactively to those. It applies going forward from the next round the
scheduler is allowed to touch.

## UI change

In `src/ui/live.js`, the "Resting" card (around the existing `restingIds`
list) currently renders resting player names as a comma-joined string. Change
it to show each player's current `sitStreak` when `>= 1`, e.g.:

```
Sam · sat out 1
```

No new component; this is a formatting change to the existing render of
`restingIds` using `state.sitStreak`.

## Testing

- `tests/scheduler.test.js`:
  - A case with a persistent skill outlier (large Elo gap) proves they are
    forced onto court once their `sitStreak` reaches `MAX_CONSECUTIVE_SIT`,
    even though every candidate including them scores worse on skill.
  - A `singles`-format case with a bench larger than court capacity proves
    the graceful-degradation path (longest streaks prioritized, no crash/
    empty candidate list).
  - `reoptimizeFrom` respects the cap after a mid-session `addPlayer` call.
- `tests/state.test.js`: `sitStreak` lifecycle through `addPlayer` (starts at
  `0`) and `removePlayer` (entry removed).
- Existing rest/cost/partner/opponent tests are unaffected — the cap is a
  pre-filter on the candidate list, not a change to `computeCost`.

## Risks / tradeoffs

- In rare cases (large `singles` bench), the round that forces in the
  longest-waiting players may be more skill- or partner-imbalanced than the
  unconstrained optimum would have been. This is an accepted tradeoff:
  fairness (bounded wait) takes priority over match balance for that one
  round.
- The mandatory-filter step adds a linear scan over candidates per round;
  negligible given the existing `O(n^4)` `foursomes()` enumeration already
  dominates cost for the stated player range (6–8).
