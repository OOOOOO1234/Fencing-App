import { useCallback, useEffect, useMemo, useState } from 'react'
import { AccountPanel } from './components/AccountPanel'
import { BoutWorkspace } from './components/BoutWorkspace'
import { GlossaryView } from './components/GlossaryView'
import { PlaylistsView } from './components/PlaylistsView'
import { UploadView } from './components/UploadView'
import { hasAnalysisProvider, hasSupabase } from './lib/config'
import { decodeSharePayload } from './lib/share'
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
  | { name: 'glossary' }
  | { name: 'playlists' }
  | { name: 'account' }
  | { name: 'share'; bout: Bout }

export default function App() {
  const [bouts, setBouts] = useState<Bout[]>([])
  const [view, setView] = useState<View>({ name: 'home' })
  const [activeBout, setActiveBout] = useState<Bout | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [firstRunDismissed, setFirstRunDismissed] = useState(
    () => localStorage.getItem('fencing-first-run') === '1',
  )

  const shareBout = useMemo(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('share') && window.location.hash.length > 1) {
      return decodeSharePayload(window.location.hash.slice(1))
    }
    return null
  }, [])

  const refresh = useCallback(async () => {
    const list = await listBouts()
    setBouts(list)
  }, [])

  useEffect(() => {
    if (shareBout) {
      setView({ name: 'share', bout: shareBout })
      setLoading(false)
      return
    }
    void (async () => {
      try {
        await refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load bouts')
      } finally {
        setLoading(false)
      }
    })()
  }, [refresh, shareBout])

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
      setError('Bout not found — it may have been deleted in this browser.')
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

  async function handleSaveMeta(patch: { title: string; side: FencerSide }) {
    if (!activeBout) return
    const next = { ...activeBout, ...patch }
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

  function goHome() {
    if (view.name === 'bout' && view.videoUrl) {
      URL.revokeObjectURL(view.videoUrl)
    }
    setActiveBout(null)
    setView({ name: 'home' })
    if (window.location.search.includes('share')) {
      window.history.replaceState({}, '', window.location.pathname)
    }
  }

  return (
    <div className="app-shell">
      <header className="site-header">
        <button type="button" className="brand-block brand-button" onClick={goHome}>
          <p className="brand">Fencing-App</p>
          <p className="tagline">Sabre Moneyball — attempts, successes, costs</p>
        </button>
        <nav className="site-nav" aria-label="Primary">
          <button type="button" className="btn ghost" onClick={() => setView({ name: 'glossary' })}>
            Glossary
          </button>
          <button type="button" className="btn ghost" onClick={() => setView({ name: 'playlists' })}>
            Playlists
          </button>
          <button type="button" className="btn ghost" onClick={() => setView({ name: 'account' })}>
            Account
          </button>
          {view.name !== 'upload' && view.name !== 'share' ? (
            <button type="button" className="btn primary" onClick={() => setView({ name: 'upload' })}>
              Upload bout
            </button>
          ) : null}
        </nav>
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
            onCancel={goHome}
          />
        ) : null}

        {view.name === 'glossary' ? <GlossaryView onBack={goHome} /> : null}

        {view.name === 'playlists' ? (
          <PlaylistsView onOpenBout={(id) => void openBout(id)} onBack={goHome} />
        ) : null}

        {view.name === 'account' ? (
          <AccountPanel
            onSynced={async () => {
              await refresh()
            }}
          />
        ) : null}

        {view.name === 'share' ? (
          <BoutWorkspace
            bout={view.bout}
            videoUrl={null}
            readOnly
            onSavePhrases={async () => undefined}
            onSaveMeta={async () => undefined}
            onBack={goHome}
          />
        ) : null}

        {view.name === 'bout' && activeBout ? (
          <BoutWorkspace
            bout={activeBout}
            videoUrl={view.videoUrl}
            onSavePhrases={handleSavePhrases}
            onSaveMeta={handleSaveMeta}
            onBack={goHome}
            onDelete={handleDelete}
          />
        ) : null}

        {view.name === 'home' ? (
          <section className="home" aria-labelledby="bouts-heading">
            <div className="hero">
              <h1 id="bouts-heading">
                {bouts.length === 0 ? 'Count what works on the strip' : 'Your bouts'}
              </h1>
              <p>
                One sabre bout at a time. Pick left or right, tag each phrase, and see attempt /
                success / fail rates — Moneyball numbers, not vibes.
              </p>
              <ol className="loop-strip" aria-label="Core loop">
                <li>1 · Upload</li>
                <li>2 · Left or right</li>
                <li>3 · Tag phrases</li>
                <li>4 · Read the rates</li>
              </ol>
            </div>

            {!firstRunDismissed ? (
              <div className="banner info first-run" role="status">
                <p>
                  <strong>First run:</strong> load the demo to see stats immediately, or upload one
                  video and tag phrases yourself. Open the glossary anytime for sabre action
                  definitions. AI and cloud sync activate only after you paste API keys (Account /
                  env docs).
                </p>
                <button
                  type="button"
                  className="btn tiny secondary"
                  onClick={() => {
                    localStorage.setItem('fencing-first-run', '1')
                    setFirstRunDismissed(true)
                  }}
                >
                  Got it
                </button>
              </div>
            ) : null}

            <p className="status-chips" aria-label="Feature status">
              <span className="chip on">Local tags</span>
              <span className={`chip ${hasSupabase() ? 'on' : 'off'}`}>
                Cloud {hasSupabase() ? 'ready' : 'needs keys'}
              </span>
              <span className={`chip ${hasAnalysisProvider() ? 'on' : 'off'}`}>
                AI {hasAnalysisProvider() ? 'ready' : 'needs keys'}
              </span>
            </p>

            {loading ? <p className="muted">Loading…</p> : null}

            {!loading && bouts.length === 0 ? (
              <div className="empty-state">
                <p>
                  No bouts in this browser yet. Upload one video, or open the labeled demo to
                  explore the stats table and glossary.
                </p>
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
                  <button
                    type="button"
                    className="btn ghost"
                    onClick={() => setView({ name: 'glossary' })}
                  >
                    Read glossary
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
          Local IndexedDB by default. Supabase + analysis API activate via env keys — see{' '}
          <code>.env.example</code>. Manual tagging always remains available; AI never pretends to
          work without keys.
        </p>
      </footer>
    </div>
  )
}
