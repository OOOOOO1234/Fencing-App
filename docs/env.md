# Environment variables

## Server (Netlify Functions) — required for “Analyze bout”

| Variable | Where | Purpose |
| --- | --- | --- |
| `OPENAI_API_KEY` | Netlify env (functions/runtime) | **Preferred.** OpenAI secret used only by `/.netlify/functions/analyze` |
| `ANALYSIS_API_KEY` | Same | Alternate name for the same secret |
| `OPENAI_ANALYSIS_MODEL` | Same | Optional; default `gpt-4o` |

**Do not** put the OpenAI secret in `VITE_*`. Vite embeds `VITE_*` into the browser bundle.

Transition: if `OPENAI_API_KEY` is unset, the function also checks `VITE_ANALYSIS_API_KEY` **on the server only** (Netlify injects it into functions). Copy the same value to `OPENAI_API_KEY`, then remove `VITE_ANALYSIS_API_KEY` when you can.

## Client (optional)

| Variable | Purpose |
| --- | --- |
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` | Unused by the single-page Moneyball UI |

## How analysis works

1. Browser samples ~10 JPEG keyframes from the uploaded video (not the full file).
2. `POST /.netlify/functions/analyze` with `{ side, duration, frames, actions }`.
3. Function calls OpenAI vision with those frames and returns `{ phrases: [{ timestamp, action, outcome, … }] }`.
4. UI merges drafts into Moneyball; manual add/remove still works.

Honest limits: sparse frames ≠ full-video pose tracking. Drafts need review.

## Netlify

Site: https://fencing-app.netlify.app  
Dashboard: https://app.netlify.com/projects/fencing-app  
