import type { Bout, Invite, Phrase, Playlist } from '../types'

const DB_NAME = 'fencing-app'
const DB_VERSION = 2
const BOUTS_STORE = 'bouts'
const VIDEOS_STORE = 'videos'
const PLAYLISTS_STORE = 'playlists'
const INVITES_STORE = 'invites'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(BOUTS_STORE)) {
        db.createObjectStore(BOUTS_STORE, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(VIDEOS_STORE)) {
        db.createObjectStore(VIDEOS_STORE)
      }
      if (!db.objectStoreNames.contains(PLAYLISTS_STORE)) {
        db.createObjectStore(PLAYLISTS_STORE, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(INVITES_STORE)) {
        db.createObjectStore(INVITES_STORE, { keyPath: 'id' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed'))
  })
}

function reqToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'))
  })
}

export async function listBouts(): Promise<Bout[]> {
  const db = await openDb()
  const tx = db.transaction(BOUTS_STORE, 'readonly')
  const store = tx.objectStore(BOUTS_STORE)
  const bouts = await reqToPromise(store.getAll() as IDBRequest<Bout[]>)
  return bouts.sort((a, b) => (b.updatedAt ?? b.createdAt).localeCompare(a.updatedAt ?? a.createdAt))
}

export async function getBout(id: string): Promise<Bout | undefined> {
  const db = await openDb()
  const tx = db.transaction(BOUTS_STORE, 'readonly')
  return reqToPromise(tx.objectStore(BOUTS_STORE).get(id) as IDBRequest<Bout | undefined>)
}

export async function saveBout(bout: Bout): Promise<void> {
  const db = await openDb()
  const tx = db.transaction(BOUTS_STORE, 'readwrite')
  const next = { ...bout, updatedAt: new Date().toISOString() }
  await reqToPromise(tx.objectStore(BOUTS_STORE).put(next))
}

export async function deleteBout(id: string): Promise<void> {
  const db = await openDb()
  const tx = db.transaction([BOUTS_STORE, VIDEOS_STORE, INVITES_STORE], 'readwrite')
  await reqToPromise(tx.objectStore(BOUTS_STORE).delete(id))
  await reqToPromise(tx.objectStore(VIDEOS_STORE).delete(id))
  const invites = await reqToPromise(tx.objectStore(INVITES_STORE).getAll() as IDBRequest<Invite[]>)
  await Promise.all(
    invites.filter((inv) => inv.boutId === id).map((inv) => reqToPromise(tx.objectStore(INVITES_STORE).delete(inv.id))),
  )
}

export async function saveVideo(boutId: string, blob: Blob): Promise<void> {
  const db = await openDb()
  const tx = db.transaction(VIDEOS_STORE, 'readwrite')
  await reqToPromise(tx.objectStore(VIDEOS_STORE).put(blob, boutId))
}

export async function getVideo(boutId: string): Promise<Blob | undefined> {
  const db = await openDb()
  const tx = db.transaction(VIDEOS_STORE, 'readonly')
  return reqToPromise(tx.objectStore(VIDEOS_STORE).get(boutId) as IDBRequest<Blob | undefined>)
}

export async function listPlaylists(): Promise<Playlist[]> {
  const db = await openDb()
  const tx = db.transaction(PLAYLISTS_STORE, 'readonly')
  const list = await reqToPromise(tx.objectStore(PLAYLISTS_STORE).getAll() as IDBRequest<Playlist[]>)
  return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export async function savePlaylist(playlist: Playlist): Promise<void> {
  const db = await openDb()
  const tx = db.transaction(PLAYLISTS_STORE, 'readwrite')
  await reqToPromise(tx.objectStore(PLAYLISTS_STORE).put(playlist))
}

export async function deletePlaylist(id: string): Promise<void> {
  const db = await openDb()
  const tx = db.transaction(PLAYLISTS_STORE, 'readwrite')
  await reqToPromise(tx.objectStore(PLAYLISTS_STORE).delete(id))
}

export async function listInvites(): Promise<Invite[]> {
  const db = await openDb()
  const tx = db.transaction(INVITES_STORE, 'readonly')
  return reqToPromise(tx.objectStore(INVITES_STORE).getAll() as IDBRequest<Invite[]>)
}

export async function saveInvite(invite: Invite): Promise<void> {
  const db = await openDb()
  const tx = db.transaction(INVITES_STORE, 'readwrite')
  await reqToPromise(tx.objectStore(INVITES_STORE).put(invite))
}

export async function getInviteByToken(token: string): Promise<Invite | undefined> {
  const invites = await listInvites()
  return invites.find((inv) => inv.token === token)
}

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function createDemoBout(): Bout {
  /** Timestamps fit the ~62s Commons sabre sample used by ?demo=1.
   * Opponent actions intentionally repeat Counterattack → Parry-riposte for Study. */
  const phrases: Phrase[] = [
    {
      id: newId(),
      timestamp: 5,
      action: 'Simple attack',
      opponentAction: 'Counterattack',
      outcome: 'point_for',
      scoreYou: 0,
      scoreThem: 0,
      initiative: 'you',
    },
    {
      id: newId(),
      timestamp: 11,
      action: 'Parry-riposte',
      opponentAction: 'Parry-riposte',
      outcome: 'point_against',
      scoreYou: 1,
      scoreThem: 0,
      initiative: 'them',
    },
    {
      id: newId(),
      timestamp: 17,
      action: 'Counterattack',
      opponentAction: 'Simple attack',
      outcome: 'point_against',
      scoreYou: 2,
      scoreThem: 0,
      initiative: 'them',
    },
    {
      id: newId(),
      timestamp: 23,
      action: 'Simple attack',
      opponentAction: 'Counterattack',
      outcome: 'point_against',
      scoreYou: 2,
      scoreThem: 1,
      initiative: 'you',
    },
    {
      id: newId(),
      timestamp: 29,
      action: 'Attack on the preparation',
      opponentAction: 'Parry-riposte',
      outcome: 'point_against',
      scoreYou: 2,
      scoreThem: 2,
      initiative: 'you',
    },
    {
      id: newId(),
      timestamp: 35,
      action: 'Beat attack',
      opponentAction: 'Beat attack',
      outcome: 'no_touch',
      scoreYou: 3,
      scoreThem: 2,
      initiative: 'you',
    },
    {
      id: newId(),
      timestamp: 41,
      action: 'Compound attack',
      opponentAction: 'Counterattack',
      outcome: 'point_for',
      scoreYou: 3,
      scoreThem: 2,
      initiative: 'you',
    },
    {
      id: newId(),
      timestamp: 46,
      action: 'Parry-riposte',
      opponentAction: 'Parry-riposte',
      outcome: 'point_against',
      scoreYou: 4,
      scoreThem: 2,
      initiative: 'them',
    },
    {
      id: newId(),
      timestamp: 51,
      action: 'Remise',
      opponentAction: 'Remise',
      outcome: 'point_for',
      scoreYou: 4,
      scoreThem: 3,
      initiative: 'you',
    },
    {
      id: newId(),
      timestamp: 55,
      action: 'Simple attack',
      opponentAction: 'Simple attack',
      outcome: 'point_for',
      scoreYou: 5,
      scoreThem: 3,
      initiative: 'you',
    },
    {
      id: newId(),
      timestamp: 58,
      action: 'Preparation only',
      opponentAction: 'Preparation only',
      outcome: 'no_touch',
      scoreYou: 6,
      scoreThem: 3,
      initiative: 'you',
    },
    {
      id: newId(),
      timestamp: 60,
      action: 'Counterattack',
      opponentAction: 'Counterattack',
      outcome: 'double',
      scoreYou: 6,
      scoreThem: 3,
      initiative: 'them',
    },
  ]

  return {
    id: newId(),
    title: 'Demo bout (sample tags)',
    side: 'left',
    createdAt: new Date().toISOString(),
    isDemo: true,
    hasVideo: true,
    phrases,
  }
}
