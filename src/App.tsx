import { useEffect, useRef, useState, type FormEvent } from 'react'
import { HistoryPage } from './HistoryPage'
import { draftsToPhrases } from './lib/analysis/types'
import { getAnalysisProvider } from './lib/analysis/provider'
import { captureKeyframes } from './lib/frames'
import { computeStats, formatPct, formatTime, parseClock } from './lib/stats'
import { newId, saveBout } from './lib/storage'
import type { ActionName, Bout, FencerSide, Outcome, Phrase } from './types'
import { ACTIONS, OUTCOME_LABELS, OUTCOMES } from './types'

type Page = 'analyze' | 'history'

export default function App() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [page, setPage] = useState<Page>('analyze')
  const [boutId, setBoutId] = useState<string | null>(null)
  const [createdAt, setCreatedAt] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [side, setSide] = useState<FencerSide>('left')
  /** Optional filmed date (YYYY-MM-DD). Empty = use upload day in History. */
  const [recordedAt, setRecordedAt] = useState('')
  const [phrases, setPhrases] = useState<Phrase[]>([])
  const [action, setAction] = useState<ActionName>('Simple attack')
  const [outcome, setOutcome] = useState<Outcome>('point_for')
  const [timeLabel, setTimeLabel] = useState('0:00')
  const [analyzing, setAnalyzing] = useState(false)
  const [status, setStatus] = useState<string | null>(null)

  useEffect(() => {
    return () => {
      if (videoUrl) URL.revokeObjectURL(videoUrl)
    }
  }, [videoUrl])

  async function persist(nextPhrases: Phrase[], id: string, title: string, filmDate: string, created: string) {
    const bout: Bout = {
      id,
      title,
      side,
      createdAt: created,
      recordedAt: filmDate || undefined,
      hasVideo: true,
      phrases: nextPhrases,
    }
    await saveBout(bout)
  }

  function startBout(nextFile: File) {
    if (videoUrl) URL.revokeObjectURL(videoUrl)
    const id = newId()
    setBoutId(id)
    setCreatedAt(new Date().toISOString())
    setFile(nextFile)
    setVideoUrl(URL.createObjectURL(nextFile))
    setPhrases([])
    setTimeLabel('0:00')
    setStatus(null)
  }

  function reset() {
    if (videoUrl) URL.revokeObjectURL(videoUrl)
    setBoutId(null)
    setCreatedAt(null)
    setFile(null)
    setVideoUrl(null)
    setPhrases([])
    setTimeLabel('0:00')
    setStatus(null)
  }

  function syncTime() {
    const t = videoRef.current?.currentTime
    if (t != null && Number.isFinite(t)) setTimeLabel(formatTime(t))
  }

  async function applyPhrases(next: Phrase[]) {
    setPhrases(next)
    if (boutId && file && createdAt) {
      await persist(
        next,
        boutId,
        file.name.replace(/\.[^.]+$/, '') || file.name,
        recordedAt,
        createdAt,
      )
    }
  }

  function addPhrase(event: FormEvent) {
    event.preventDefault()
    if (!videoUrl || !boutId) return
    const timestamp = videoRef.current?.currentTime ?? parseClock(timeLabel)
    const phrase: Phrase = {
      id: newId(),
      timestamp,
      action,
      outcome,
    }
    const next = [...phrases, phrase].sort((a, b) => a.timestamp - b.timestamp)
    void applyPhrases(next)
  }

  function removePhrase(id: string) {
    const next = phrases.filter((p) => p.id !== id)
    void applyPhrases(next)
  }

  function seekTo(seconds: number) {
    const video = videoRef.current
    if (!video) return
    video.currentTime = seconds
    void video.play()
    setTimeLabel(formatTime(seconds))
  }

  async function runAnalysis() {
    const video = videoRef.current
    if (!video || !boutId) return
    setAnalyzing(true)
    setStatus('Sampling frames…')
    try {
      if (video.readyState < 1) {
        await new Promise<void>((resolve, reject) => {
          const ok = () => {
            cleanup()
            resolve()
          }
          const fail = () => {
            cleanup()
            reject(new Error('Video failed to load'))
          }
          const cleanup = () => {
            video.removeEventListener('loadedmetadata', ok)
            video.removeEventListener('error', fail)
          }
          video.addEventListener('loadedmetadata', ok, { once: true })
          video.addEventListener('error', fail, { once: true })
        })
      }

      const { frames, duration } = await captureKeyframes(video, { count: 10, maxWidth: 512 })
      setStatus('Analyzing frames…')
      const result = await getAnalysisProvider().analyze({
        side,
        title: file?.name,
        duration,
        frames,
      })
      if (result.status === 'ok' && result.drafts.length > 0) {
        const drafts = draftsToPhrases(result.drafts, newId)
        const next = [...phrases, ...drafts].sort((a, b) => a.timestamp - b.timestamp)
        await applyPhrases(next)
      }
      setStatus(result.message)
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Analysis failed')
    } finally {
      setAnalyzing(false)
    }
  }

  const stats = computeStats(phrases)
  const usedActions = stats.byAction.filter((row) => row.attempts > 0)
  const rows = usedActions.length > 0 ? usedActions : stats.byAction
  const active = Boolean(videoUrl)

  return (
    <div className="page">
      <div className="atmosphere" aria-hidden />

      <header className="masthead">
        <div className="masthead-row">
          <h1 className="brand">Fencing-App</h1>
          <nav className="nav" aria-label="Pages">
            <button
              type="button"
              className={page === 'analyze' ? 'nav-on' : undefined}
              onClick={() => setPage('analyze')}
            >
              Analyze
            </button>
            <button
              type="button"
              className={page === 'history' ? 'nav-on' : undefined}
              onClick={() => setPage('history')}
            >
              History
            </button>
          </nav>
        </div>
        {page === 'analyze' ? (
          <p className="lede">
            Upload one sabre bout. Get Moneyball rates — how often each action is tried, and whether
            it works.
          </p>
        ) : (
          <p className="lede">Trends across your saved bouts — usage and success over time.</p>
        )}
      </header>

      {page === 'history' ? (
        <HistoryPage onAnalyze={() => setPage('analyze')} />
      ) : !active ? (
        <section className="upload" aria-labelledby="upload-label">
          <h2 id="upload-label" className="sr-only">
            Upload
          </h2>

          <fieldset className="side">
            <legend>You are</legend>
            <label className={side === 'left' ? 'on' : undefined}>
              <input
                type="radio"
                name="side"
                checked={side === 'left'}
                onChange={() => setSide('left')}
              />
              Left
            </label>
            <label className={side === 'right' ? 'on' : undefined}>
              <input
                type="radio"
                name="side"
                checked={side === 'right'}
                onChange={() => setSide('right')}
              />
              Right
            </label>
          </fieldset>

          <label className="date-field">
            <span>
              When was this filmed? <em>(optional)</em>
            </span>
            <input
              type="date"
              value={recordedAt}
              onChange={(e) => setRecordedAt(e.target.value)}
            />
          </label>

          <label className="file">
            <span>Choose bout video</span>
            <input
              type="file"
              accept="video/*"
              onChange={(e) => {
                const next = e.target.files?.[0]
                if (next) startBout(next)
              }}
            />
          </label>
        </section>
      ) : (
        <section className="bout" aria-label="Bout analysis">
          <div className="bout-top">
            <p className="meta">
              <strong>{file?.name}</strong>
              <span> · {side} fencer</span>
              {recordedAt ? <span> · filmed {recordedAt}</span> : null}
            </p>
            <button type="button" className="text-btn" onClick={reset}>
              New video
            </button>
          </div>

          <video
            ref={videoRef}
            className="player"
            src={videoUrl ?? undefined}
            controls
            playsInline
            onTimeUpdate={syncTime}
          />

          <div className="analyze-row">
            <button
              type="button"
              className="analyze"
              disabled={analyzing}
              onClick={() => void runAnalysis()}
            >
              {analyzing ? 'Analyzing…' : 'Analyze bout'}
            </button>
            <p className="tag-hint">
              Samples frames and drafts phrases for Moneyball. Edit or add marks by hand anytime.
            </p>
          </div>
          {status ? (
            <p className="status-line" role="status">
              {status}
            </p>
          ) : null}

          <form className="tag" onSubmit={addPhrase}>
            <p className="tag-hint">Or mark a phrase at the playhead.</p>
            <div className="tag-grid">
              <label>
                Time
                <input
                  type="text"
                  value={timeLabel}
                  onChange={(e) => setTimeLabel(e.target.value)}
                  onBlur={syncTime}
                />
              </label>
              <label>
                Action
                <select
                  value={action}
                  onChange={(e) => setAction(e.target.value as ActionName)}
                >
                  {ACTIONS.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Result
                <select
                  value={outcome}
                  onChange={(e) => setOutcome(e.target.value as Outcome)}
                >
                  {OUTCOMES.map((key) => (
                    <option key={key} value={key}>
                      {OUTCOME_LABELS[key]}
                    </option>
                  ))}
                </select>
              </label>
              <button type="submit" className="add">
                Add
              </button>
            </div>
          </form>

          <section className="stats" aria-labelledby="stats-title">
            <div className="stats-head">
              <h2 id="stats-title">Moneyball</h2>
              <p>
                {stats.totals.attempts} tries · {formatPct(stats.totals.successRate)} success ·{' '}
                {formatPct(stats.totals.costRate)} cost · net{' '}
                <span className={stats.totals.net >= 0 ? 'pos' : 'neg'}>
                  {stats.totals.net > 0 ? `+${stats.totals.net}` : stats.totals.net}
                </span>
              </p>
            </div>

            <table>
              <thead>
                <tr>
                  <th scope="col">Action</th>
                  <th scope="col">Try</th>
                  <th scope="col">For</th>
                  <th scope="col">Against</th>
                  <th scope="col">Success</th>
                  <th scope="col">Cost</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.action} className={row.attempts === 0 ? 'dim' : undefined}>
                    <th scope="row">{row.action}</th>
                    <td>{row.attempts}</td>
                    <td>{row.pointsFor}</td>
                    <td>{row.pointsAgainst}</td>
                    <td>{formatPct(row.successRate)}</td>
                    <td>{formatPct(row.costRate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {phrases.length > 0 ? (
            <ul className="log" aria-label="Phrases">
              {phrases.map((phrase) => (
                <li key={phrase.id}>
                  <button type="button" className="log-main" onClick={() => seekTo(phrase.timestamp)}>
                    <span>{formatTime(phrase.timestamp)}</span>
                    <span>
                      {phrase.action}
                      {phrase.fromAnalysis ? ' · draft' : ''}
                    </span>
                    <span>{OUTCOME_LABELS[phrase.outcome]}</span>
                  </button>
                  <button
                    type="button"
                    className="text-btn"
                    onClick={() => removePhrase(phrase.id)}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      )}
    </div>
  )
}
