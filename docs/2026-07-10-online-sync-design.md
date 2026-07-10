# Live sharing + durable history (design)

## Problem

LoveAll is a local-first, offline-first PWA: the organizer's phone holds the
entire session state in `localStorage` and nothing leaves the device. In
practice this makes two things hard:

1. **Showing others the score.** Spectators and other players have no way to
   see live standings during play, and after the session the only sharing
   mechanism is a static recap image (`src/recap-card.js` via
   `shareRanking()` in `src/ui/summary.js`).
2. **Keeping a log.** Session data lives in one phone's `localStorage`. There
   is no history across sessions/days, and a lost or reset phone loses
   everything.

The organizer explicitly does not want spectators to sign up, log in, or
install anything. The organizer is fine with an invisible, anonymous
identity (no visible login form) and is open to depending on a small managed
backend, with Cloudflare specifically in mind.

## Non-goals

- No accounts, passwords, or visible login UI for anyone (organizer or
  spectator).
- No change to the existing local scoring flow's offline behavior — scoring
  must keep working with no network at all, exactly as today.
- No multi-organizer / concurrent-writer conflict resolution. This remains a
  single-organizer tool; if the same anonymous token is ever used to push
  from two devices at once, last-write-wins is an accepted limitation, not a
  bug to solve.

## Architecture

The existing static PWA (`index.html`, `src/*.js`) is unchanged for the core
play loop: state is still created, scored, and persisted locally exactly as
it is today, and works fully offline.

Two new pieces sit alongside it:

1. **Cloudflare Worker + `SessionRoom` Durable Object.** Each live session
   gets one Durable Object instance, addressed by a short room code (e.g.
   `/rooms/:code`). The DO holds the current snapshot in memory, persists it
   to its own storage, and holds live WebSocket connections from spectators.
2. **`src/sync.js` (new client module).** Opt-in and best-effort. If the
   organizer never taps "Go live," or the network is unavailable, the app
   behaves exactly as it does today. Sync failures never block or error the
   local scoring UI.

The organizer's identity is a random token minted client-side on first use
and stored in `localStorage` — no form, no password. It is sent as a header
on requests to the Worker so it can tell "this device may push updates to
this room" and "these history entries belong to the same organizer."

## Components & data flow

- **Going live.** Organizer taps "Share live" (setup screen or mid-session).
  Client `POST`s to the Worker, which creates a `SessionRoom` DO and returns
  a short room code (e.g. `7QXK`) plus a room token. The client stores both
  and renders a shareable link (`loveall.app/watch/7QXK`) and QR code —
  this is what gets handed to spectators.
- **Staying live.** Every existing local mutation (`applyScore`, roster
  edit, schedule change) also fires an async, debounced push of the full
  state snapshot over the room's WebSocket connection, tagged with the room
  token. Whole-snapshot pushes (not diffs) are deliberate: the state object
  is small and there is exactly one writer, so there is no need for
  merge/conflict logic.
- **Watching live.** A new read-only page/route (`watch.html` or a router
  mode) opens a read-only WebSocket to `/rooms/:code`, receives the current
  snapshot on connect, then live patches after. It reuses the existing
  standings rendering from `src/ui/summary.js` in a read-only mode — no new
  rendering logic, just the score-editing controls omitted.
- **Ending / logging.** On session end, the client sends a final
  `completed` snapshot. The DO writes a summary (date, players, standings)
  into a per-organizer history log in Cloudflare D1, keyed by the anonymous
  token, and the live room itself expires after ~48h. The room is
  ephemeral; the history entry is permanent.
- **Browsing history.** A new History view does `GET /history` with the
  organizer token and lists past sessions; tapping one re-renders the
  standings/recap card from the stored summary.

## Error handling

- **Network drops mid-session:** sync push retries with backoff in the
  background; local scoring UI never blocks or errors. A small indicator
  (e.g. a dot near the share button) shows "live" vs "not syncing," purely
  informational.
- **Spectator opens a dead/expired room code:** DO returns a friendly "this
  session has ended or the link expired" page, not an error.
- **Room code collision:** vanishingly unlikely at 4–6 chars; Worker retries
  generation on collision.
- **Same organizer token used from two devices at once:** out of scope by
  design (see Non-goals) — last-write-wins.
- **D1/DO write failure on session end:** the existing local "Share the
  ranking" image export still works as a fallback. A failed cloud write
  loses the cross-device log entry, not the organizer's own local data.

## Testing

- Existing unit tests (`state.js`, `scheduler.js`, etc.) are unaffected —
  the local play loop doesn't change.
- `src/sync.js` gets unit tests with a mocked WebSocket: queuing/retry when
  offline, debounced snapshot sends, reconnect behavior.
- The Worker + `SessionRoom` Durable Object gets tests via Miniflare
  (Cloudflare's local test runtime, works with the existing Vitest-style
  test setup) — room creation, broadcast-to-viewers, history write on
  completion, expired-room handling.
- Manual smoke test before shipping: two browser windows (organizer +
  spectator) confirm live score updates appear, and confirm a session
  shows up in History after ending.
