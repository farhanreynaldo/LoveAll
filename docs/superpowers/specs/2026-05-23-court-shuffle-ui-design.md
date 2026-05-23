# Court Shuffle — UI / UX Design

**Date:** 2026-05-23
**Status:** Draft — pending user review
**Companion spec:** `2026-05-23-court-shuffle-algorithm-design.md`
**Scope:** Visual and interaction design for v1. Tech stack and storage implementation are out of scope (deferred to the implementation plan).

---

## 1. Design Principles

Decided during brainstorming. Every UI decision in this spec should serve one or more of these:

1. **Mobile-first.** Designed for a phone held one-handed at courtside. Touch targets are large; primary actions are reachable with a thumb.
2. **Local-first.** Single-device app. All state lives on the organizer's phone (browser storage). No accounts, no network calls required after first load, no sync.
3. **Fast.** App should launch instantly and respond instantly. No loading spinners during normal use. Schedule computation is sub-millisecond per §4.4 of the algorithm spec.
4. **Lightweight.** Single static web app. No backend. Minimal dependencies. Whole bundle small enough to load comfortably on cellular.

## 2. Users & Usage Context

- **Single user role: the organizer.** Players are not app users in v1. They glance at the organizer's phone when they want to check the schedule.
- **Usage context:** courtside, outdoors or in a covered court. Possibly bright sun, possibly under floodlights. Possibly one-handed. Probably picked up and put down repeatedly between rounds.
- **Session shape:** ~10 rounds over 2–3 hours. Active interaction concentrated in 30-second bursts between rounds (enter score → glance at next match → put phone down).

## 3. Scope (v1)

**In scope** — three screens:

1. **Setup** — create a new session: add players, set seed skill per player, set target round count.
2. **Live session** — the main screen used during play: current round, score entry, next round preview, full schedule scroll.
3. **End summary** — final scoreboard, fairness receipt, option to start a new session.

**Out of scope (v1)** — explicitly deferred:

- Fairness-settings panel (cost-function weights, Elo K-factor). Defaults from algorithm spec are hardcoded for now.
- Per-player detail screen with history.
- Past-sessions list / cross-session persistence.
- Export / share end-of-session result.
- Onboarding / help screens.
- Player-facing view (organizer-only model — see §2).

Any of these can be added later without rearchitecting v1.

## 4. Visual Style

**Direction: Minimal / Calm (light by default).**

- **Background:** off-white (`#fafaf7`)
- **Surface (cards):** white (`#fff`) with thin `#e8e6df` border, 12 px radius
- **Primary text:** near-black (`#1a1a1a`)
- **Secondary text:** warm grey (`#8a8a85`)
- **Primary action:** solid near-black button with white text
- **Secondary action:** white button with thin border
- **Typography:** system stack (`-apple-system, system-ui, sans-serif`). Numbers use `font-variant-numeric: tabular-nums` so scores align cleanly.
- **Spacing:** generous whitespace; never crowded.

**Dark mode toggle (required for v1).** A manual toggle (not auto / not system-following) accessible from the live-session screen's overflow menu. The dark variant uses a dark navy background with high-contrast white text — the goal is glare survival outdoors. Toggle state persists across launches.

**Touch targets:** all interactive elements at minimum 44 × 44 px. Primary buttons span full width of their card or container.

## 5. Screen-by-Screen

### 5.1 Setup screen

**Header:** "New session" title, top-left. Close (×) button, top-right.

**Players list (card):**
- Each row: player name (left) + 5-dot skill rating (right). Tapping a row opens an edit interaction (rename + adjust dots).
- Skill dots: 5 dots, filled left-to-right. Tapping a dot sets the rating to that value. Default 3 for new players.
- Row count label: "Players · N" above the card.

**Add-player input (below list):**
- Text input + plus button. Submitting adds the player with default skill (3) and clears the input. Focus returns to the input for fast multi-add.

**Target rounds control (card):**
- Label "Rounds in session" + stepper (− / number / +). Default 10. Min 4, max 20.

**Primary action:** "Start session" button at the bottom. Disabled until at least 6 players have been added. (Algorithm spec requires 6–8; we soft-enforce by disabling until 6, hard-cap at 8 with a toast if user tries to add a 9th.)

### 5.2 Live session screen

The screen the organizer stares at all session. Designed to answer three questions at a glance:

1. **What's the current score?**
2. **Whose turn is it next?**
3. **Did I do the rotation right?**

**Header:**
- Left: "Round N of T" label (where T is target rounds).
- Right: overflow menu (•••) opening: dark-mode toggle, "Edit players" (re-opens setup-style sheet for add/remove mid-session), "End session early" (jumps to End summary).

**Current-match card (largest visual element):**
- Two team rows, each showing: team names ("Aldo · Maya"), live score (large, tabular-num).
- Below each team: a small −/+ pair to adjust that team's score.
- Each tap on `+` increments by 1 game; `−` decrements; no further confirmation. Updates are saved to local state immediately. (Re-optimizer does not run on game-by-game increments — only when "Save & next round" is tapped.)

**Primary action:** "Save & next round" button below the match card.
- On tap: marks round as completed → updates Elo and counts → runs re-optimizer on rounds N+2 onward → animates current-match card transitioning to round N+1's matchup.
- Disabled until at least one team has a non-zero score (sanity guard against accidental tap).

**Below the primary action — "Up next" block:**
- Plain text: "Up next · Maya, Jin vs Aldo, Lee"
- "Resting · Sam, Priya"
- This is what players glance at when they want to know whether they're on the next round.

**Schedule scroll (collapsible at bottom):**
- Tap to expand a list of all remaining rounds (rounds N+1 to T) with their tentative matchups. Locked rounds (N) and completed rounds (1 to N−1) are also shown for context, visually de-emphasized.
- Manual override: long-press any future round to enter an edit mode where the organizer can swap players between on-court and resting, or swap teammates. Edited rounds are marked with a small "edited" indicator and won't be overwritten by the re-optimizer.

### 5.3 End summary screen

Auto-shown when the user finishes the final round (or taps "End session early").

**Header:** "Session complete" title. Close (×) button.

**Headline card:**
- Total games played, prominently displayed.
- Subtitle: round count and total elapsed time.

**Leaderboard card:**
- Players ranked by wins, with W–L record. Ties broken by games_for − games_against.

**Fairness check card:**
- "Rounds played" — range across players (e.g., "5–5 per player ✓" or "4–6 per player").
- "Unique partners" — average unique partner count per player.
- These two lines are the "receipt" — they prove the algorithm delivered on the A > B priority.

**Primary action:** "New session" button — returns to Setup screen, optionally pre-filled with the same player roster (with a "Reuse last roster?" prompt).
**Secondary action:** "Done" — clears session state and returns to a clean Setup screen.

## 6. Interaction Details

### 6.1 Score entry
- Tap-to-increment / decrement with `+ / −` buttons. No keyboard input in v1.
- Rationale: tap-buttons are faster outdoors (no keyboard pop-up), and game-by-game counting matches how recreational tennis is actually scored ("we're at 4–3").

### 6.2 Confirmations
- **No modal confirmations** for routine actions (saving a round, incrementing score).
- Confirmation only for destructive actions: "End session early", "Done" on summary (clears state), removing a player mid-session.
- Each destructive confirmation uses a native browser confirm (or a simple inline "Tap again to confirm" pattern) — no custom modal library.

### 6.3 Animations
- Minimal. Card transitions between rounds use a brief fade (~150 ms). No bouncy effects. No celebratory animations on score milestones.
- Justification: the app is functional, not entertainment. Animations should clarify state changes, not perform them.

### 6.4 Errors & edge cases
- **Editing a past round's score:** allowed from the schedule scroll (expand → tap a completed round → score becomes editable). On save, all derived state is recomputed from the completed-round log (per algorithm spec §5.2).
- **Adding a player mid-session:** triggers re-optimization of all unlocked rounds (per algorithm spec §5.2). UI shows a brief "Schedule updated" inline message.
- **Removing a player mid-session:** confirmation required. Same re-optimization behavior.

## 7. Platform & Delivery

- **PWA-installable.** Provide a manifest and a service worker that caches the app shell. After first load, the app launches offline and instantly. The user can "Add to Home Screen" on iOS / Android and get an app-icon launch.
- **Single static deployable.** No build-time secrets, no environment variables, no backend calls. Hostable anywhere that serves static files (or even opened directly from local storage as an HTML file).
- **Browser support:** modern mobile Safari, Chrome, Firefox. No IE / legacy support.
- **State persistence:** browser `localStorage` (or `IndexedDB` if data shape demands it — implementation decision). The currently-in-progress session auto-saves after every state change so a phone restart doesn't lose progress mid-session.

## 8. Out-of-Spec / Open for Implementation Plan

To be resolved during planning, not now:

- Specific framework / build tool / language. Recommendation will follow user's tech-comfort level (low) — likely something single-file or with minimal toolchain.
- Whether `localStorage` or `IndexedDB` is appropriate (depends on serialized session size).
- Hosting target (GitHub Pages, Cloudflare Pages, Vercel — all equivalently free and equivalently fine).
- Service worker / PWA scaffolding approach.
- Whether tests are warranted for v1 and what kind.

## 9. Future Considerations (deferred from v1)

Worth noting so the v1 implementation doesn't paint these into corners:

- **Cross-session persistence:** the player-record model should be structured so a future version can carry Elo and partner history across sessions.
- **Player-facing view:** if added later, it could re-use the same minimal style; only the schedule view (read-only) and resting indicator would be needed.
- **Multi-court support:** would require generalizing the live screen to show N parallel current matches.
- **Settings panel:** weights, K-factor, dark/light/auto mode (currently manual only).
