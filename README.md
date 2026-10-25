# TouchStat

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

**Analyze bout** samples frames and drafts phrases via `/.netlify/functions/analyze` (OpenAI key stays on the server as `OPENAI_API_KEY`). Manual marks still work. See `docs/env.md`.
