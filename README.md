# Fencing-App

Local sabre bout analytics: upload **one video**, pick **left or right**, tag phrases on the timeline, and get Moneyball-style **attempt / success / fail** rates by action.

Pose / action AI is **not** included in this MVP. Stats come from your phrase tags (or a clearly labeled demo bout).

## Run locally

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

```bash
npm test      # unit tests for stats
npm run build # production build → dist/
```

Data stays in this browser (IndexedDB). No accounts or API keys for Phase 1 (see `.env.example`).

## Netlify

`netlify.toml` builds with `npm run build` and publishes `dist/`, with SPA redirects to `index.html`.

Preferred site name: **fencing-app** → `https://fencing-app.netlify.app`

## Core loop

1. **Upload** one bout video (or load the demo).
2. Choose whether you are the **left** or **right** fencer.
3. Seek the video, **tag each phrase** (action + awarded outcome).
4. Read the **stats table** and exchange log (click a row to seek).

## Deferred

- Automatic pose tracking / action classifier
- Accounts, coach invites, competition playlists, cloud storage

See product decisions in the planning PR branch `docs/plan.md` if present (`cursor/fencing-analytics-plan-84c1`).
