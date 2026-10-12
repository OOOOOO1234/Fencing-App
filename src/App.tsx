import { useCallback, useEffect, useState } from 'react'
import { BoutWorkspace } from './components/BoutWorkspace'
import { UploadView } from './components/UploadView'
import {
  createDemoBout,
  deleteBout,
  getBout,
  getVideo,
  listBouts,
  newId,
  saveBout,
  saveVideo,
} from './lib/storage'
import { computeStats, formatPct } from './lib/stats'
import type { Bout, FencerSide, Phrase } from './types'

type View =
  | { name: 'home' }
  | { name: 'upload' }
  | { name: 'bout'; boutId: string; videoUrl: string | null }

export default function App() {
  const [bouts, setBouts] = useState<Bout[]>([])
  const [view, setView] = useState<View>({ name: 'home' })
  const [activeBout, setActiveBout] = useState<Bout | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    const list = await listBouts()
    setBouts(list)
  }, [])

  useEffect(() => {
    void (async () => {
      try {
        await refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load bouts')
      } finally {
        setLoading(false)
      }
    })()
  }, [refresh])

  useEffect(() => {
    return () => {
      if (view.name === 'bout' && view.videoUrl) {
        URL.revokeObjectURL(view.videoUrl)
      }
    }
  }, [view])

  async function openBout(boutId: string) {
    setError(null)
    const bout = await getBout(boutId)
    if (!bout) {
      setError('Bout not found')
      return
    }
    let videoUrl: string | null = null
    if (bout.hasVideo) {
      const blob = await getVideo(boutId)
      if (blob) videoUrl = URL.createObjectURL(blob)
    }
    setActiveBout(bout)
    setView({ name: 'bout', boutId, videoUrl })
  }

  async function handleCreate(input: {
    title: string
    side: FencerSide
    file: File | null
  }) {
    const id = newId()
    const bout: Bout = {
      id,
      title: input.title,
      side: input.side,
      createdAt: new Date().toISOString(),
      hasVideo: Boolean(input.file),
      phrases: [],
    }
    if (input.file) {
      await saveVideo(id, input.file)
    }
    await saveBout(bout)
    await refresh()
    await openBout(id)
  }

  async function handleDemo() {
    const bout = createDemoBout()
    await saveBout(bout)
    await refresh()
    await openBout(bout.id)
  }

  async function handleSavePhrases(phrases: Phrase[]) {
    if (!activeBout) return
    const next = { ...activeBout, phrases }
    await saveBout(next)
    setActiveBout(next)
    await refresh()
  }

  async function handleDelete() {
    if (!activeBout) return
    const id = activeBout.id
    if (view.name === 'bout' && view.videoUrl) {
      URL.revokeObjectURL(view.videoUrl)
    }
    await deleteBout(id)
    setActiveBout(null)
    setView({ name: 'home' })
    await refresh()
  }

  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="brand-block">
          <p className="brand">Fencing-App</p>
          <p className="tagline">Sabre Moneyball — attempts, successes, costs</p>
        </div>
        {view.name !== 'upload' ? (
          <button type="button" className="btn primary" onClick={() => setView({ name: 'upload' })}>
            Upload bout
          </button>
        ) : null}
      </header>

      <main>
        {error ? (
          <p className="error" role="alert">
            {error}
          </p>
        ) : null}

        {view.name === 'upload' ? (
          <UploadView
            onCreate={handleCreate}
            onDemo={handleDemo}
            onCancel={() => setView({ name: 'home' })}
          />
        ) : null}

        {view.name === 'bout' && activeBout ? (
          <BoutWorkspace
            bout={activeBout}
            videoUrl={view.videoUrl}
            onSavePhrases={handleSavePhrases}
            onBack={() => {
              if (view.videoUrl) URL.revokeObjectURL(view.videoUrl)
              setActiveBout(null)
              setView({ name: 'home' })
            }}
            onDelete={handleDelete}
          />
        ) : null}

        {view.name === 'home' ? (
          <section className="home" aria-labelledby="bouts-heading">
            <div className="hero">
              <h1 id="bouts-heading">Your bouts</h1>
              <p>
                Upload one sabre bout video, pick left or right, tag phrases on the timeline, and
                read attempt / success / fail rates by action.
              </p>
            </div>

            {loading ? <p className="muted">Loading…</p> : null}

            {!loading && bouts.length === 0 ? (
              <div className="empty-state">
                <p>No bouts yet. Upload one video, or load the demo to see how stats look.</p>
                <div className="form-actions">
                  <button
                    type="button"
                    className="btn primary"
                    onClick={() => setView({ name: 'upload' })}
                  >
                    Upload bout
                  </button>
                  <button type="button" className="btn secondary" onClick={() => void handleDemo()}>
                    Load demo bout
                  </button>
                </div>
              </div>
            ) : null}

            {bouts.length > 0 ? (
              <ul className="bout-list">
                {bouts.map((bout) => {
                  const stats = computeStats(bout.phrases)
                  return (
                    <li key={bout.id}>
                      <button
                        type="button"
                        className="bout-card"
                        onClick={() => void openBout(bout.id)}
                      >
                        <div>
                          <span className="bout-title">{bout.title}</span>
                          <span className="muted">
                            {bout.side} · {bout.phrases.length} phrases · success{' '}
                            {formatPct(stats.totals.successRate)}
                            {bout.isDemo ? ' · demo' : ''}
                          </span>
                        </div>
                        <span className="chevron" aria-hidden>
                          →
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            ) : null}
          </section>
        ) : null}
      </main>

      <footer className="site-footer">
        <p>
          Phase 1 local MVP — phrase tags live in this browser (IndexedDB). Pose model and action
          classifier are deferred; this app does not claim AI vision is working.
        </p>
      </footer>
    </div>
  )
}
