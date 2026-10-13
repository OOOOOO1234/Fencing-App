import { useEffect, useRef, useState, type FormEvent } from 'react'
import { computeStats, formatPct, formatTime, parseClock } from './lib/stats'
import { newId } from './lib/storage'
import type { ActionName, FencerSide, Outcome, Phrase } from './types'
import { ACTIONS, OUTCOME_LABELS, OUTCOMES } from './types'

export default function App() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [side, setSide] = useState<FencerSide>('left')
  const [phrases, setPhrases] = useState<Phrase[]>([])
  const [action, setAction] = useState<ActionName>('Simple attack')
  const [outcome, setOutcome] = useState<Outcome>('point_for')
  const [timeLabel, setTimeLabel] = useState('0:00')

  useEffect(() => {
    return () => {
      if (videoUrl) URL.revokeObjectURL(videoUrl)
    }
  }, [videoUrl])

  function startBout(nextFile: File) {
    if (videoUrl) URL.revokeObjectURL(videoUrl)
    setFile(nextFile)
    setVideoUrl(URL.createObjectURL(nextFile))
    setPhrases([])
    setTimeLabel('0:00')
  }

  function reset() {
    if (videoUrl) URL.revokeObjectURL(videoUrl)
    setFile(null)
    setVideoUrl(null)
    setPhrases([])
    setTimeLabel('0:00')
  }

  function syncTime() {
    const t = videoRef.current?.currentTime
    if (t != null && Number.isFinite(t)) setTimeLabel(formatTime(t))
  }

  function addPhrase(event: FormEvent) {
    event.preventDefault()
    if (!videoUrl) return
    const timestamp = videoRef.current?.currentTime ?? parseClock(timeLabel)
    const phrase: Phrase = {
      id: newId(),
      timestamp,
      action,
      outcome,
    }
    setPhrases((prev) => [...prev, phrase].sort((a, b) => a.timestamp - b.timestamp))
  }

  function removePhrase(id: string) {
    setPhrases((prev) => prev.filter((p) => p.id !== id))
  }

  function seekTo(seconds: number) {
    const video = videoRef.current
    if (!video) return
    video.currentTime = seconds
    void video.play()
    setTimeLabel(formatTime(seconds))
  }

  const stats = computeStats(phrases)
  const usedActions = stats.byAction.filter((row) => row.attempts > 0)
  const rows = usedActions.length > 0 ? usedActions : stats.byAction
  const active = Boolean(videoUrl)

  return (
    <div className="page">
      <div className="atmosphere" aria-hidden />

      <header className="masthead">
        <h1 className="brand">Fencing-App</h1>
        <p className="lede">
          Upload one sabre bout. Get Moneyball rates — how often each action is tried, and whether
          it works.
        </p>
      </header>

      {!active ? (
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
              <span>
                · {side} fencer
              </span>
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

          <form className="tag" onSubmit={addPhrase}>
            <p className="tag-hint">
              Mark each phrase at the playhead — action and whether it scored for you.
            </p>
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
                    <span>{phrase.action}</span>
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
