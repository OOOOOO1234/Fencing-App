# TouchStat

Single page: upload one sabre bout video, pick left or right, see Moneyball attempt / success / fail rates by action.

**Live:** https://touchstat.netlify.app

**Demo bout (sample video + tags):** append `?demo=1` — e.g. https://touchstat.netlify.app/?demo=1

```bash
npm install
npm run dev
```

```bash
npm test
npm run build
```

**Analyze bout** samples frames and drafts phrases via `/.netlify/functions/analyze` (OpenAI key stays on the server as `OPENAI_API_KEY`). Manual marks still work. See `docs/env.md`.
