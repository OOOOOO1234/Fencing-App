# Environment variables

## Server (Netlify Functions) — required for “Analyze bout”

| Variable | Where | Purpose |
| --- | --- | --- |
| `OPENAI_API_KEY` | Netlify env (functions/runtime) | **Required.** Whisper + rare GPT vision via `/.netlify/functions/analyze` |
| `ANALYSIS_API_KEY` | Same | Alternate name for the same OpenAI secret |
| `OPENAI_ANALYSIS_MODEL` | Same | Optional; default `gpt-4o-mini` |
| `OPENAI_WHISPER_MODEL` | Same | Optional; default `whisper-1` |
| `OPENAI_TIMEOUT_MS` | Same | Optional; default `18000` |

**Do not** put the OpenAI secret in `VITE_*`. Vite embeds `VITE_*` into the browser bundle.

Transition: if `OPENAI_API_KEY` is unset, the function also checks `VITE_ANALYSIS_API_KEY` **on the server only**. Prefer `OPENAI_API_KEY`.

## Jev / Laya cost gate (optional — J1/J2)

| Variable | Where | Purpose |
| --- | --- | --- |
| `JEV_API_URL` | Netlify env | Base URL **or** full SystemOne URL. Examples: `https://api.laya.studio`, `https://layahost.com`, or `https://api.laya.studio/v1/systemone`. Function appends `/v1/systemone` if missing. |
| `JEV_API_KEY` | Same | Bearer token for that host (`lsk_live_…` / Jev key). **You must add this** — the app does not invent secrets. |
| `JEV_MODEL` | Same | Optional; default `jev-latest` (Laya maps jev-* → auto checkpoint) |
| `JEV_ESCALATE_THRESHOLD` | Same | Optional; default `0.35`. Skip GPT when P(escalate) &lt; this **and** speech/hands agree |
| `JEV_LABEL_MIN_PROB` | Same | Optional; default `0.45`. J2 choice max-prob floor; below → escalate to GPT |

If `JEV_API_URL` is unset or SystemOne is unreachable → **full GPT** (same as today). Whisper always runs when clips are present.

**Endpoint wired:** `POST {JEV_API_URL}/v1/systemone` (Jev / Laya / layahost SystemOne protocol). Questions: `escalate_to_gpt` (noul), optional `needs_review` (noul), and for J2 `your_action_*` / `opp_action_*` (choice over 17 actions).

## Client (optional)

| Variable | Purpose |
| --- | --- |
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` | Unused by the single-page Moneyball UI |

## How analysis works (short)

1. Browser samples frames + loudness peaks + short WAVs.
2. `POST /.netlify/functions/analyze`.
3. Whisper → optional Jev escalate gate → GPT vision only when needed → rules (hands win).
4. UI merges drafts; Edit overrides.

## Netlify

Site: https://fencing-app.netlify.app  
Dashboard: https://app.netlify.com/projects/fencing-app  
Site id: `d1840683-a127-46a4-b8ac-e65b61e5b325`
