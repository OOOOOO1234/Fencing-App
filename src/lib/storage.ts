import type { Bout, Phrase } from '../types'

const DB_NAME = 'fencing-app'
const DB_VERSION = 1
const BOUTS_STORE = 'bouts'
const VIDEOS_STORE = 'videos'

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
  return bouts.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export async function getBout(id: string): Promise<Bout | undefined> {
  const db = await openDb()
  const tx = db.transaction(BOUTS_STORE, 'readonly')
  return reqToPromise(tx.objectStore(BOUTS_STORE).get(id) as IDBRequest<Bout | undefined>)
}

export async function saveBout(bout: Bout): Promise<void> {
  const db = await openDb()
  const tx = db.transaction(BOUTS_STORE, 'readwrite')
  await reqToPromise(tx.objectStore(BOUTS_STORE).put(bout))
}

export async function deleteBout(id: string): Promise<void> {
  const db = await openDb()
  const tx = db.transaction([BOUTS_STORE, VIDEOS_STORE], 'readwrite')
  await Promise.all([
    reqToPromise(tx.objectStore(BOUTS_STORE).delete(id)),
    reqToPromise(tx.objectStore(VIDEOS_STORE).delete(id)),
  ])
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

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function createDemoBout(): Bout {
  const phrases: Phrase[] = [
    { id: newId(), timestamp: 12, action: 'Simple attack', outcome: 'point_for' },
    { id: newId(), timestamp: 28, action: 'Parry-riposte', outcome: 'point_for' },
    { id: newId(), timestamp: 41, action: 'Counterattack', outcome: 'point_against' },
    { id: newId(), timestamp: 55, action: 'Simple attack', outcome: 'point_against' },
    { id: newId(), timestamp: 70, action: 'Attack on the preparation', outcome: 'point_for' },
    { id: newId(), timestamp: 88, action: 'Beat attack', outcome: 'no_touch' },
    { id: newId(), timestamp: 102, action: 'Compound attack', outcome: 'point_for' },
    { id: newId(), timestamp: 118, action: 'Parry-riposte', outcome: 'point_against' },
    { id: newId(), timestamp: 135, action: 'Remise', outcome: 'point_for' },
    { id: newId(), timestamp: 150, action: 'Simple attack', outcome: 'point_for' },
    { id: newId(), timestamp: 168, action: 'Preparation only', outcome: 'no_touch' },
    { id: newId(), timestamp: 185, action: 'Counterattack', outcome: 'double' },
  ]

  return {
    id: newId(),
    title: 'Demo bout (sample tags)',
    side: 'left',
    createdAt: new Date().toISOString(),
    isDemo: true,
    hasVideo: false,
    phrases,
  }
}
