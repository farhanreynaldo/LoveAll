# LoveAll

A mobile PWA for running tennis sessions on one court. New doubles sessions choose one matchup at a time as players join, take breaks, return, or leave. The organizer records scores. The core session works offline and needs no account.

Organizers can name a recurring group. Its roster is saved on that device for the next session, and completed local history shows the group name. This is a local pilot feature, not an account or cross-device group sync. A small local funnel log records visits, starts, first matches, completed sessions, and returns; it is not yet connected to Meta or a checkout. Do not use it as purchase reporting.

Existing saved sessions and singles sessions continue in the earlier schedule-based flow. In the new doubles flow, tap **Start match** to hold the four on court. If someone in that match leaves, cancel the match before changing their attendance; canceled matches do not count. Players on the bench can change attendance during play. The next matchup is chosen after each score.

The host can tap **Change matchup** before starting to choose both teams. That choice survives unrelated bench changes; if a selected player becomes unavailable, LoveAll chooses a new available matchup. The wait rule is checked for 4–12 players across multiple seeds and attendance changes. These checks cover the stated rules, not every possible real-world preference about what feels fair. Test the explanations with recurring hosts before using an absolute fairness claim in ads.

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

## Deploying the live-sync worker

Cross-session history is optional and runs through a small Cloudflare Worker in `worker/`. The main app works fully offline without it. `worker/` requires Node >=22 (`.nvmrc` is set — run `nvm use` inside `worker/` before any `npm`/`npx` command there; this does not affect the rest of the project, which still targets the engines listed in the root `package.json`).

1. `cd worker && npx wrangler login`
2. `npx wrangler d1 create loveall_history` — copy the returned `database_id` into `worker/wrangler.toml`
3. `npx wrangler d1 execute loveall_history --remote --file=./schema.sql`
4. `npx wrangler deploy` — note the deployed worker URL
5. Replace `WORKER_URL` in `src/config.js` with that URL
6. Redeploy the static site as usual (no build step)

Then smoke-test end to end: complete a session and confirm it appears under Settings → Session history on the organizer's device. Live sharing is no longer exposed in the app while the result sharing flow is being reconsidered.

