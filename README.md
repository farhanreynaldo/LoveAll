# LoveAll

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

## Deploying the live-sync worker

Live spectator sharing and cross-session history are optional and run through a small Cloudflare Worker in `worker/`. The main app works fully offline without it. `worker/` requires Node >=22 (`.nvmrc` is set — run `nvm use` inside `worker/` before any `npm`/`npx` command there; this does not affect the rest of the project, which still targets the engines listed in the root `package.json`).

1. `cd worker && npx wrangler login`
2. `npx wrangler d1 create loveall_history` — copy the returned `database_id` into `worker/wrangler.toml`
3. `npx wrangler d1 execute loveall_history --remote --file=./schema.sql`
4. `npx wrangler deploy` — note the deployed worker URL
5. Replace `WORKER_URL` in `src/config.js` with that URL
6. Redeploy the static site as usual (no build step)

Then smoke-test end to end: open the app on one phone, start a session, tap "Share live," and open the copied link on a second phone or laptop with no install. Scoring a round on the first device should update standings on the second within ~1 second. Ending the session should make it appear under Settings → Session history on the organizer's device.

