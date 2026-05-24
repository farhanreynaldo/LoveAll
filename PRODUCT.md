# Product

## Register

LoveAll

## Users

Tennis club organizers and coaches running a casual doubles session on a single court with 4–12 players. The primary context is **courtside**, mid-session: one thumb on a phone, bright ambient light, glances between points, occasionally sweaty hands. Sessions are social — friends or club members who already know each other — so the user is hosting as much as administering.

The job-to-be-done: rotate players fairly across matches, keep score quickly, and end the session with a clear picture of who played whom and who's ahead. The user trusts the scheduler to do the math; the UI exists so they can confirm, adjust, and record without leaving the conversation around them.

## Product Purpose

Court Shuffle removes the spreadsheet, scrap paper, and mental load from organizing a small tennis doubles session. It generates fair rotations, scores matches inline, and surfaces per-player stats — all from one phone, no accounts, no backend.

Success looks like an organizer pulling out their phone between points, tapping two or three times, and putting it back in their pocket. The tool should feel less like an app and more like a notebook that does the math for you.

## Brand Personality

**Warm, considered, human.**

The voice is that of a thoughtful friend who happens to be good at logistics — never corporate, never sporty, never gamified. Numbers are treated with the typographic discipline of a clock (Apple Sports / Apple Fitness as the visual reference), but the surrounding copy and tone acknowledge that this is a social game, not telemetry. Emotional goal: the organizer feels calm and in control, and the people they're playing with don't notice them using a phone.

## Anti-references

This product should NOT look like:

- **A generic sports app.** No court-green, no ball-yellow accents, no stadium imagery, no jersey-number typography, no scoreboard chrome. Borrow Apple Sports' informational discipline, not its category signifiers.
- **An enterprise SaaS dashboard.** No gradient hero metrics, no identical card grids, no corporate blue/purple palette, no "Welcome back, [Name]" greetings.
- **A playful or gamified consumer app.** No mascots, no achievement badges, no confetti, no bright reward animations, no oversized friendly illustrations. This is not Duolingo for tennis.
- **A heavily branded marketing surface.** No big logos, no bold display typography, no splashy color, no scroll-driven hero sections. The product is the tool; the brand is in the restraint.

## Design Principles

1. **Courtside-first.** Every surface is designed to be operated with one thumb in bright outdoor light between points. Tap targets are generous, contrast is honest, motion is brief or absent, and nothing important hides behind a hover.
2. **Glanceable, not studied.** Scores, the current match, and the next rotation should be readable in under a second. Big tabular numerals, generous whitespace, and a typographic hierarchy strong enough that the eye lands in the right place without searching.
3. **Trust the schedule, show the work.** The scheduler is the product. The UI's job is to make its decisions legible — who plays next, why, what's locked, what was edited — so the organizer can confirm or override with confidence, not interrogate the algorithm.
4. **Warmth in tone, restraint in surface.** Personality lives in the copy, the empty states, and the small human touches — never in decoration. The visual system stays quiet so the social moment around it can stay loud.
5. **Notebook, not app.** Favor flat, persistent surfaces over modals and overlays. Edits happen inline. State is durable. The user should feel like they're writing in a notebook that happens to do the math, not navigating a piece of software.

## Accessibility & Inclusion

Target **WCAG AA** for contrast and tap-target size as a practical floor, given the realistic courtside context (sunlight, distance, motion):

- Body text and numerals meet AA contrast against both light and dark surfaces; scores and the active-match readout aim for AAA where feasible. **Verified:** the live score reads `--text` on `--surface` in both themes (light: `#1a1a1a` on `#ffffff` ≈ 17:1; dark: `#ffffff` on `#131a2e` ≈ 17.5:1), comfortably above WCAG AAA's 4.5:1 large-text threshold. The 32px / weight-300 score qualifies as large text under WCAG, so the contrast headroom also protects readability against the thin weight at distance.
- Minimum tap target 44×44 CSS pixels; primary actions (advance match, record score) are larger.
- Color is never the sole carrier of state — locked, edited, skipped, and completed rounds are also distinguished by weight, position, or a glyph.
- Respect `prefers-reduced-motion`: transitions degrade to instant state changes.
- Dark theme is a peer of the light theme, not an afterthought — chosen explicitly for evening / indoor-court use.
