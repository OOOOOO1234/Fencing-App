# Fencing-App

Sabre bout analytics: upload **one video**, pick **left or right**, tag phrases (or run AI when keys exist), and get Moneyball **attempt / success / fail** rates by action — plus situation splits, glossary, playlists, coach share links, and optional cloud sync.

**Live:** https://fencing-app.netlify.app

## Run locally

```bash
npm install
npm run dev
```

```bash
npm test
npm run build
```

Copy `.env.example` → `.env` when you are ready to paste API keys. See [docs/env.md](docs/env.md).

## Features

- Manual phrase tagging (always available) + sabre glossary
- Edit bout title / side after create
- Export CSV + copy summary; coach read-only share links
- Score-state splits (ahead / tied / behind) when scores are tagged
- Competition playlists (combined stats)
- Account panel for Supabase auth + push/pull sync (needs keys)
- Pluggable AI analysis (`VITE_ANALYSIS_API_*`) — honest “needs key” UX when unset

## Deferred until you paste keys

- Real cloud accounts / cross-device sync (Supabase)
- Live AI draft tags from your analysis endpoint

Pose model weights are not shipped in-repo; use an external analysis API.
