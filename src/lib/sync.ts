import type { Bout, Invite, Playlist } from '../types'
import { hasSupabase, missingEnvMessage } from './config'
import { getSupabase } from './supabase'
import { listBouts, listInvites, listPlaylists, saveBout, saveInvite, savePlaylist } from './storage'

export type SyncStatus =
  | { state: 'local_only'; message: string }
  | { state: 'signed_out'; message: string }
  | { state: 'ready'; email: string | null }
  | { state: 'error'; message: string }

export async function getSyncStatus(): Promise<SyncStatus> {
  if (!hasSupabase()) {
    return { state: 'local_only', message: missingEnvMessage('supabase') }
  }
  const sb = getSupabase()
  if (!sb) return { state: 'local_only', message: missingEnvMessage('supabase') }
  const { data, error } = await sb.auth.getSession()
  if (error) return { state: 'error', message: error.message }
  if (!data.session) return { state: 'signed_out', message: 'Sign in to sync bouts across devices.' }
  return { state: 'ready', email: data.session.user.email ?? null }
}

export async function signInWithEmail(email: string, password: string) {
  const sb = getSupabase()
  if (!sb) throw new Error(missingEnvMessage('supabase'))
  const { error } = await sb.auth.signInWithPassword({ email, password })
  if (error) throw error
}

export async function signUpWithEmail(email: string, password: string) {
  const sb = getSupabase()
  if (!sb) throw new Error(missingEnvMessage('supabase'))
  const { error } = await sb.auth.signUp({ email, password })
  if (error) throw error
}

export async function signOut() {
  const sb = getSupabase()
  if (!sb) return
  await sb.auth.signOut()
}

export async function pushLocalToCloud(): Promise<{ pushed: number; message: string }> {
  const sb = getSupabase()
  if (!sb) return { pushed: 0, message: missingEnvMessage('supabase') }
  const { data: sessionData } = await sb.auth.getSession()
  const user = sessionData.session?.user
  if (!user) return { pushed: 0, message: 'Sign in first.' }

  const bouts = await listBouts()
  let pushed = 0
  for (const bout of bouts) {
    const { error } = await sb.from('bouts').upsert({
      id: bout.id,
      user_id: user.id,
      title: bout.title,
      side: bout.side,
      payload: bout,
      updated_at: new Date().toISOString(),
    })
    if (!error) pushed += 1
  }

  const playlists = await listPlaylists()
  for (const playlist of playlists) {
    await sb.from('playlists').upsert({
      id: playlist.id,
      user_id: user.id,
      name: playlist.name,
      bout_ids: playlist.boutIds,
    })
  }

  const invites = await listInvites()
  for (const invite of invites) {
    await sb.from('invites').upsert({
      id: invite.id,
      user_id: user.id,
      bout_id: invite.boutId,
      token: invite.token,
      role: invite.role,
      label: invite.label ?? null,
    })
  }

  return { pushed, message: `Synced ${pushed} bout${pushed === 1 ? '' : 's'} to cloud.` }
}

export async function pullCloudToLocal(): Promise<{ pulled: number; message: string }> {
  const sb = getSupabase()
  if (!sb) return { pulled: 0, message: missingEnvMessage('supabase') }
  const { data: sessionData } = await sb.auth.getSession()
  if (!sessionData.session) return { pulled: 0, message: 'Sign in first.' }

  const { data: boutRows, error } = await sb.from('bouts').select('payload')
  if (error) return { pulled: 0, message: error.message }

  let pulled = 0
  for (const row of boutRows ?? []) {
    const bout = row.payload as Bout
    if (bout?.id) {
      await saveBout(bout)
      pulled += 1
    }
  }

  const { data: playlistRows } = await sb.from('playlists').select('*')
  for (const row of playlistRows ?? []) {
    const playlist: Playlist = {
      id: row.id as string,
      name: row.name as string,
      createdAt: (row.created_at as string) ?? new Date().toISOString(),
      boutIds: (row.bout_ids as string[]) ?? [],
    }
    await savePlaylist(playlist)
  }

  const { data: inviteRows } = await sb.from('invites').select('*')
  for (const row of inviteRows ?? []) {
    const invite: Invite = {
      id: row.id as string,
      boutId: row.bout_id as string,
      token: row.token as string,
      createdAt: (row.created_at as string) ?? new Date().toISOString(),
      role: 'coach',
      label: (row.label as string | null) ?? undefined,
    }
    await saveInvite(invite)
  }

  return { pulled, message: `Pulled ${pulled} bout${pulled === 1 ? '' : 's'} from cloud.` }
}
