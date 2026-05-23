# Court Shuffle — Algorithm & Scheduling Design

**Date:** 2026-05-23
**Status:** Draft — pending user review
**Scope:** Algorithm and scheduling logic for a tennis-session pairing app. UI/UX is sketched only where it constrains the algorithm; a separate spec will cover the full UI.

---

## 1. Purpose

A web app that schedules doubles matches for a single-court tennis session (6–8 players, 2–3 hours), keeps score, and adapts pairings as the session progresses. Designed for casual recreational play where the organizer wants matches to be **fair** along multiple dimensions: equal play time, varied partners and opponents, and roughly balanced skill once scores start flowing in.

## 2. Fairness Priorities (ranked)

Decided during brainstorming. The cost function and weights reflect this ordering:

1. **A — Equal play time.** Treated as a near-hard constraint via a large weight.
2. **B — Partner variety.** Strong soft constraint.
3. **C — Opponent variety.** Strong soft constraint, slightly weaker than partner variety.
4. **D — Skill-balanced matches.** Tiebreaker only.
5. **E — Score-based balancing.** Emerges automatically from Elo updates feeding back into D. No separate term.

## 3. Inputs & State

### 3.1 Session setup (entered once)

- **Players:** 6–8 entries, each with a name and a **seed skill rating 1–5** (default 3).
- **Target round count:** default 10; adjustable mid-session.
- **Optional:** weight overrides (see §4.3) and Elo K-factor.

### 3.2 Per-player state

| Field | Type | Updated when | Used for |
|---|---|---|---|
| `rounds_played` | int | After each completed round | Rest fairness (A) |
| `partner_counts[other_id]` | map<id,int> | After each completed round | Partner variety (B) |
| `opponent_counts[other_id]` | map<id,int> | After each completed round | Opponent variety (C) |
| `elo` | float | After each score is entered | Skill balancing (D) |
| `wins`, `losses` | int | After each score is entered | Scoreboard |
| `games_for`, `games_against` | int | After each score is entered | Scoreboard / tiebreaker |

**Elo seeding:** `elo = 1000 + 100 · seed_skill` → range 1100–1500 for seeds 1–5.

### 3.3 Per-round state

| Field | Type | Notes |
|---|---|---|
| `round_number` | int | 1-indexed |
| `players_on_court` | list<id> of length 4 | |
| `team_A`, `team_B` | list<id> of length 2 each | Together cover all 4 on-court players |
| `status` | enum {tentative, locked, completed} | See §5 lifecycle |
| `score` | tuple(int, int) or null | Games won by A and B respectively |

A round transitions: `tentative → locked → completed`.

## 4. The Cost Function

For each candidate `(foursome × pairing-into-teams)`:

```
cost = w_rest     · rest_penalty
     + w_partner  · partner_penalty
     + w_opponent · opponent_penalty
     + w_skill    · skill_penalty
```

### 4.1 Penalty terms

| Term | Definition |
|---|---|
| `rest_penalty` | For each of the 4 on-court players p: `(p.rounds_played − min_rounds_played_across_all_players)²`. Sum. |
| `partner_penalty` | `partner_counts[p1][p2]² + partner_counts[p3][p4]²` for the two pairs. |
| `opponent_penalty` | Sum of `opponent_counts[a][b]²` over the 4 cross-team pairings. |
| `skill_penalty` | `((team_A_elo_sum − team_B_elo_sum) / 100)²`. Normalized so it stays small relative to other terms. |

**Why squared everywhere:** repeating a partner a *third* time should hurt much more than a *second* time. Same for rest imbalance and skill gap. Quadratic penalties produce that behavior naturally without a separate "max count" hard limit.

### 4.2 Default weights

```
w_rest     = 1000   // effectively hard constraint
w_partner  = 10
w_opponent = 8
w_skill    = 1      // tiebreaker
```

### 4.3 Weight overrides

A "Fairness settings" panel exposes the four weights as numeric inputs. Defaults match §4.2. Changing weights re-runs the re-optimizer on unlocked rounds immediately.

### 4.4 Enumeration & tie-breaking

For 8 players: C(8,4) × 3 pairings = 210 candidates. For 6: C(6,4) × 3 = 45. For 7: C(7,4) × 3 = 105. All trivially enumerable in sub-millisecond.

When multiple candidates share the minimum cost, pick **uniformly at random using a session-seeded RNG**. The seed is recorded in session state so a session can be replayed deterministically (useful for debugging and for honest "the system did this fairly" answers if a player complains).

## 5. Schedule Generation & Lifecycle

### 5.1 Initial schedule (session start)

```
state ← fresh state for all players
for r in 1..target_rounds:
    candidate ← argmin over all valid (foursome, pairing) of cost(candidate, state)
    schedule[r] ← Round(candidate, status=tentative)
    state ← simulate(state, candidate)   # bump counts; Elo unchanged
```

`simulate` advances `rounds_played` for the 4 on-court players, increments `partner_counts` and `opponent_counts` accordingly. Elo is not touched (no scores yet).

The full tentative schedule is displayed to the user.

### 5.2 Round lifecycle

| Event | Effect |
|---|---|
| User taps **Start round N** | `schedule[N].status = locked`. Cannot be re-optimized. |
| User enters **score** for round N | `schedule[N].status = completed`. Update player state: `rounds_played`, `partner_counts`, `opponent_counts`, `wins/losses`, `games_for/against`, and **Elo** (per §6). |
| Immediately after score entry | **Re-optimizer** runs on rounds **N+2 through target_rounds**. Round N+1 is intentionally *not* re-optimized — see §5.4. |
| User edits a past score | Recompute all derived state from the completed-round log, then re-optimize rounds (current+2) onward. |
| Player added or removed mid-session | Re-optimize **all unlocked rounds** (N+1 onward) — drop-in/drop-out is disruptive enough to justify shifting the next round. |
| User adjusts `target_rounds` | Truncate or extend the tentative tail; re-optimize new rounds only. |

### 5.3 Re-optimizer

Same greedy loop as §5.1, starting from current state, generating fresh candidates for the rounds to be re-optimized. Replace an existing tentative round **only if** the new candidate's cost is at least 5% lower than the existing one's recomputed cost. This avoids cosmetic churn (visible reshuffling that doesn't meaningfully improve fairness).

### 5.4 The lock-ahead buffer

Round N is locked at start-time. Round N+1 stays as previously shown even after re-optimization runs. Rationale: players are already mentally on-deck for N+1 by the time round N's score is entered; reshuffling the imminent round feels arbitrary and erodes trust. Rounds N+2 onward are far enough ahead that changes feel like *adaptation*, not *churn*.

### 5.5 Manual override

The organizer can manually edit any **tentative or locked** round before the score is entered: swap a player on court with a player resting, or swap teammates. Manual edits set a `manually_edited` flag on the round so the re-optimizer won't overwrite the player's intent until the round completes.

## 6. Elo Update Rule

Standard Elo, adapted for doubles, with margin-aware actual score.

For a completed match: team A = (a₁, a₂) with games `g_A`, team B = (b₁, b₂) with games `g_B`:

```
R_A = (elo[a₁] + elo[a₂]) / 2
R_B = (elo[b₁] + elo[b₂]) / 2

E_A = 1 / (1 + 10^((R_B − R_A) / 400))
E_B = 1 − E_A

S_A = g_A / (g_A + g_B)         # margin-aware, not just win/loss
S_B = 1 − S_A

K   = 32                         # default; configurable

elo[a₁] += K · (S_A − E_A)
elo[a₂] += K · (S_A − E_A)
elo[b₁] += K · (S_B − E_B)
elo[b₂] += K · (S_B − E_B)
```

**Notes:**
- Margin-aware S means a 6–0 thrashing nudges Elo more than a 6–5 squeaker — important when we only get ~10 matches per session.
- Both teammates receive the same delta. A single score line doesn't let us distinguish individual contribution.

## 7. Out of Scope (for this spec)

These are noted so a future spec can pick them up, but they do not affect the algorithm design:

- **Cross-session persistence.** v1 treats each session as fresh. The data model is structured so a future version can persist per-player Elo and partner/opponent history across sessions for a recurring group.
- **Full UI/UX spec.** This document covers only UI elements that constrain the algorithm (Start-round button, score entry, manual override, fairness settings, target-rounds adjustment). Layouts, mobile-first design, sharing, etc. belong in a separate spec.
- **Multi-court support.** Single-court only. Multi-court would require generalizing the cost function to schedule N parallel matches per round.
- **Authentication, accounts, hosting.** Decisions deferred.

## 8. Open Questions for Implementation Plan

To resolve when writing the implementation plan, not now:

- Storage layer: in-memory only (refresh = lost session) vs. `localStorage` vs. server-backed.
- Tech stack: framework choice, language. (User has expressed limited tech expertise — recommend something with minimal setup.)
- Whether to ship the manual override and weight-overrides panel in v1 or defer.
- Whether session can be exported (e.g., end-of-session summary as a shareable text/image).
