# Fencing-App

Single page: upload one sabre bout video, pick left or right, see Moneyball attempt / success / fail rates by action.

**Live:** https://fencing-app.netlify.app

```bash
npm install
npm run dev
```

```bash
npm test
npm run build
```

Until an analysis API key is wired, mark phrases inline on the same page (playhead → action → result). Stats update from those marks. Optional env keys are documented in `.env.example` / `docs/env.md` but are not required for the page to work.
