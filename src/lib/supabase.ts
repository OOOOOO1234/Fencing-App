import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { config, hasSupabase } from './config'

let client: SupabaseClient | null = null

export function getSupabase(): SupabaseClient | null {
  if (!hasSupabase()) return null
  if (!client) {
    client = createClient(config.supabaseUrl, config.supabaseAnonKey)
  }
  return client
}

/** Suggested SQL for the user to run in Supabase when keys are pasted. */
export const SUPABASE_SCHEMA_SQL = `
-- Fencing-App cloud schema (paste in Supabase SQL editor when enabling sync)

create table if not exists bouts (
  id uuid primary key,
  user_id uuid references auth.users not null,
  title text not null,
  side text not null check (side in ('left','right')),
  payload jsonb not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists playlists (
  id uuid primary key,
  user_id uuid references auth.users not null,
  name text not null,
  bout_ids jsonb not null default '[]',
  created_at timestamptz default now()
);

create table if not exists invites (
  id uuid primary key,
  user_id uuid references auth.users not null,
  bout_id uuid not null,
  token text unique not null,
  role text not null default 'coach',
  label text,
  created_at timestamptz default now()
);

alter table bouts enable row level security;
alter table playlists enable row level security;
alter table invites enable row level security;

create policy "own bouts" on bouts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own playlists" on playlists for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own invites" on invites for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "coach read invite bout" on bouts for select using (
  exists (select 1 from invites i where i.bout_id = bouts.id)
);
`
