# Audit: UI/UX complaint risks in the courtside flow

## Method

A screen-by-screen grilling session against `PRODUCT.md` and `DESIGN.md`,
scoped to the organizer-facing screens in priority order: `live.js` (the
courtside core loop) first, then `setup.js`, `summary.js`,
`settings.js`/`history.js`/`player.js`. The spectator `watch-app.js` was
deliberately left out of scope — different persona, lower priority. Every
finding below was verified against the actual code, not just inferred from
the design docs; file/line references are included so each one can be
re-checked directly.

Findings are grouped by whether they belong in `DESIGN.md` (a visual/
component design system) or are behavioral/architectural bugs that have no
home there. Within each group, most-severe first.

## Design-system-relevant

These four informed the `DESIGN.md` rewrite.

### 1. Native `alert()` used in three places
`live.js`: the "could not start live sharing" failure, the "link copied"
confirmation, and the "Score cannot be 0–0" validation all use `alert()`.
DESIGN.md already states "Don't use full-screen modals. Bottom sheets are
the only allowed modal pattern" — `alert()` is a harder violation of that
rule than any custom modal would be: it blocks the whole page, carries
none of the paper/navy visual system, and is the least "notebook, not app"
possible interruption. The validation alert is the highest-severity of the
three since it can fire in ordinary use (empty score save), not just on a
rare network failure.

### 2. Score corrections don't set `manuallyEdited`
`live.js`, `score-edit-save` handler (`editingScoreIdx` flow) patches
`status`/`score` but never sets `manuallyEdited: true`, unlike the sibling
player-swap editor (`editor-save` handler), which does. DESIGN.md already
specifies that edited rows get a `✎` glyph — the rule exists, the score
editor just doesn't apply it. Result: correcting a mis-entered score leaves
no visible trace it was changed, contradicting PRODUCT.md principle 3
("show the work... what's edited").

### 3. Raw Elo rating exposed on the player screen
`player.js:53` renders `Rating {elo} ({eloSign}{eloDeltaAbs})` — a bare
Elo-style number with a signed delta, no scale, no explanation. PRODUCT.md's
Brand Personality section is explicit: "never sporty, never gamified... this
is a social game, not telemetry." A raw ranking-algorithm number is close to
the textbook definition of telemetry. Elo can stay as the scheduler's
internal fairness signal; showing it raw to a casual player is the issue.

### 4. "End session" / "Skip round" sit directly under the primary action
`live.js`, the `inline-action-row` under the "Save & next round" button
places "Skip this round" and "End session" as small text links one
thumb-width from the primary action, present on every single round for the
whole session. Courtside conditions (sweaty hands, bright light, glances
between points) make a mis-tap plausible. The one mitigation that exists —
a page reload restores the live view because ending a session doesn't
mutate persisted state — is not discoverable to a non-technical user, who
is more likely to assume data loss and abandon the app than to try
reloading.

## Behavioral / architectural — no home in DESIGN.md

### 5. Settings → History → back silently destroys the in-progress session
**Severity: highest.** Reachable path: `live` → menu → "Fairness settings"
(`go('settings', state)`) → "Session history" (`settings.js:84`,
`go('history')`) → history screen's back button
(`history.js:12`, unconditionally `go('setup')`) → blank roster form. The
in-progress session is still sitting untouched in
`localStorage['loveall:session']` at this point. If the organizer then
builds a new roster and taps "Start session," `saveSession()`
(`persistence.js:23`) does a flat `localStorage.setItem` on the same key —
the entire in-progress session (schedule, scores, sync state) is gone, with
no confirmation, no warning, no undo. Unlike a mis-tapped "End session," a
reload does not recover this: the old data is truly overwritten.
`summary.js`'s own "New session" flow (`showConfirm`, `summary.js:120`)
proves the team already knows this class of action needs a confirmation
step — this path bypasses it entirely.

### 6. "Session history" is empty for most real sessions
**Severity: highest.** `history.js` fetches `${WORKER_URL}/history` —
entirely server-side. A session only reaches the server if
`syncClient.complete()` finds an open, connected WebSocket at the exact
moment "End session" is tapped (`sync.js:55-65`,
`if (socket && socket.readyState === 1)`). That socket only exists if the
organizer tapped the 📡 "share live" button and stayed connected through
the end of the session — an optional, secondary feature, not the core loop.
An organizer who never shares live completes a session entirely locally,
and it never appears in "Session history" — not as an error or an
explained empty state, just silently absent. This contradicts PRODUCT.md's
own "no backend" framing: a local-first app hiding its history behind a
server-dependent feature, unlabeled as such.

### 7. Tied standings crown a silent, arbitrary "Winner"
**Severity: high.** `recap-card.js:17` sorts standings by `wins` then
`gameDiff` only, no further tiebreaker. In a small round-robin (4–12
players, a handful of rounds), an exact tie on both is a realistic outcome.
When it happens, `Array.sort`'s stability falls back to roster order, and
`summary.js` crowns `leaderboard[0]` as the sole "Winner" with a large hero
numeral — nothing on screen indicates a tie occurred. In a social group
that just competed for an hour, this reads as a wrong result, not a
cosmetic nitpick, in a product whose value proposition rests on trustworthy
fairness math.

### 8. Early-ended sessions don't stay "ended" across a reload
Ending a session before all rounds complete (via the inline "End session"
link or menu item) never marks persisted state as complete. If the
organizer closes the app after viewing the recap and reopens later,
`app.js:26` re-evaluates `schedule.every(status === 'completed')`; since
rounds are still incomplete, it routes back to the **live scoring screen**,
undoing the end the organizer intentionally chose. Related to but distinct
from finding 4 (mis-tap prevention) — this is about a *legitimate* end not
being durable.

### 9. No duplicate-name handling on the roster
`setup.js` has no uniqueness check when adding players. Two players named
"Mike" (plausible in an 8-12 person club) can both be added; matching is by
internal `id` so nothing breaks functionally, but every display surface
(live match card, schedule list, resting label, standings, recap) shows
`"Mike & Sarah vs Mike & Dave"` with no disambiguation. This is a
"which one am I" complaint risk in a social group, not a rare edge case.
Doesn't necessarily mean blocking duplicates outright (two people can
legitimately share a name); a lighter fix is visual disambiguation (e.g.,
last initial) or a warning at add-time.

### 10. Skip-round schedule growth isn't tracked against the original plan — CLOSED, premise incorrect
Originally flagged as: skipping a round appends a fresh placeholder round
at the end (`live.js:507-521`) with no visible running total against
"the plan." On follow-up (see `state.js:21`), `targetRounds` defaults to
30 and `setup.js` never lets the organizer set it — the schedule is
always pre-generated as a large rolling buffer, and the organizer ends
the session whenever they choose via "End session," not by exhausting a
planned round count. There is no organizer-set target for skip growth to
exceed, so the premise of this finding doesn't hold under the app's
actual scheduling model. No fix implemented; closed as not a real issue.

## Disposition

All findings have since been resolved except finding 10, which was closed
as not a real issue on follow-up investigation:

- **Fixed:** 1 (no more `alert()`, replaced with in-app feedback), 2
  (`manuallyEdited` now set on score corrections), 3 (raw Elo rating
  removed from the player screen), 4 (inline "End session" link removed,
  the `⋯` menu is now the sole mid-session path), 5 (history back button
  no longer routes through a session-destroying setup screen), 6
  (session history now backed by a local-first archive, decoupled from
  live-sharing), 7 (standings ties now show co-winners with competition
  ranking, though the shareable PNG recap card still shows a single
  champion — noted as a known follow-up), 8 (`endedAt` now persisted so
  an early end survives a reload), 9 (duplicate-name warning added at
  add-time).
- **Closed, not a real issue:** 10 — see the finding's writeup above.
