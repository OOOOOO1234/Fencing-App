# Environment variables

All keys are optional. Without them the site runs in **local/demo mode** (IndexedDB + manual tagging).

| Variable | Required for | Where to get it |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Auth, cloud bout sync, cloud invites/playlists | Supabase → Project Settings → API → Project URL |
| `VITE_SUPABASE_ANON_KEY` | Same | Supabase → Project Settings → API → `anon` `public` key |
| `VITE_ANALYSIS_API_URL` | “Analyze with AI” draft tags | Your vision/LLM analysis HTTP endpoint |
| `VITE_ANALYSIS_API_KEY` | Same | Bearer token for that endpoint |

## Netlify

Site: **fencing-app** → https://fencing-app.netlify.app  
Dashboard: https://app.netlify.com/projects/fencing-app  

1. Site configuration → Environment variables → add the `VITE_*` keys above  
2. Trigger a redeploy (or push to the linked Git branch once continuous deploy is connected)

## Supabase schema

When enabling cloud sync, run the SQL exported as `SUPABASE_SCHEMA_SQL` in `src/lib/supabase.ts`.

## AI contract

`POST VITE_ANALYSIS_API_URL` with header `Authorization: Bearer VITE_ANALYSIS_API_KEY` and JSON body including `weapon: "sabre"` and the nine action names. Response must include `phrases[]` with `timestamp`, `action`, `outcome`. Drafts are marked in the UI and remain editable; manual tagging always works.
