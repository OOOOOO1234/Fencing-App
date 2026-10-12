import { useEffect, useRef, useState, type FormEvent } from 'react'
import { formatTime } from '../lib/stats'
import { newId } from '../lib/storage'
import type { ActionName, Bout, Outcome, Phrase } from '../types'
import { ACTIONS, OUTCOME_LABELS, OUTCOMES } from '../types'
import { StatsTable } from './StatsTable'

interface BoutWorkspaceProps {
  bout: Bout
  videoUrl: string | null
  onSavePhrases: (phrases: Phrase[]) => Promise<void>
  onBack: () => void
  onDelete: () => Promise<void>
}

export function BoutWorkspace({
  bout,
  videoUrl,
  onSavePhrases,
  onBack,
  onDelete,
}: BoutWorkspaceProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [phrases, setPhrases] = useState<Phrase[]>(bout.phrases)
  const [action, setAction] = useState<ActionName>('Simple attack')
  const [outcome, setOutcome] = useState<Outcome>('point_for')
  const [remark, setRemark] = useState('')
  const [manualTime, setManualTime] = useState('0:00')
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    setPhrases(bout.phrases)
    setDirty(false)
  }, [bout.id, bout.phrases])

  function readVideoTime(): number {
    const video = videoRef.current
    if (video && Number.isFinite(video.currentTime)) {
      return video.currentTime
    }
    return parseClock(manualTime)
  }

  function captureTime() {
    const t = readVideoTime()
    setManualTime(formatTime(t))
  }

  async function persist(next: Phrase[]) {
    setSaving(true)
    setMessage(null)
    try {
      await onSavePhrases(next)
      setDirty(false)
      setMessage('Saved')
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  function handleAdd(event: FormEvent) {
    event.preventDefault()
    const timestamp = videoUrl ? readVideoTime() : parseClock(manualTime)
    const phrase: Phrase = {
      id: newId(),
      timestamp,
      action,
      outcome,
      remark: remark.trim() || undefined,
    }
    const next = [...phrases, phrase].sort((a, b) => a.timestamp - b.timestamp)
    setPhrases(next)
    setDirty(true)
    setRemark('')
    void persist(next)
  }

  function handleRemove(id: string) {
    const next = phrases.filter((p) => p.id !== id)
    setPhrases(next)
    setDirty(true)
    void persist(next)
  }

  function seekTo(seconds: number) {
    const video = videoRef.current
    if (video) {
      video.currentTime = seconds
      void video.play()
    }
    setManualTime(formatTime(seconds))
  }

  return (
    <div className="workspace">
      <header className="workspace-bar">
        <button type="button" className="btn ghost" onClick={onBack}>
          ← All bouts
        </button>
        <div className="workspace-title">
          <h2>{bout.title}</h2>
          <p className="muted">
            Analyzing <strong>{bout.side}</strong> fencer
            {bout.isDemo ? (
              <>
                {' '}
                · <span className="badge demo">Demo data</span>
              </>
            ) : null}
            {dirty ? ' · unsaved changes…' : null}
            {saving ? ' · saving…' : null}
            {message && !saving ? ` · ${message}` : null}
          </p>
        </div>
        <button
          type="button"
          className="btn danger-ghost"
          onClick={() => {
            if (window.confirm('Delete this bout and its video from this browser?')) {
              void onDelete()
            }
          }}
        >
          Delete
        </button>
      </header>

      {bout.isDemo ? (
        <p className="banner demo" role="status">
          This is sample phrase data so you can explore stats. It is not AI vision output. Upload
          your own video to tag a real bout.
        </p>
      ) : (
        <p className="banner info" role="status">
          Pose / action AI is not enabled. Tag each phrase yourself: seek the video, choose the
          action and outcome, add it. Stats update from your tags.
        </p>
      )}

      <div className="workspace-grid">
        <div className="player-column">
          {videoUrl ? (
            <video
              ref={videoRef}
              className="bout-video"
              src={videoUrl}
              controls
              playsInline
              onTimeUpdate={captureTime}
            />
          ) : (
            <div className="video-placeholder">
              <p>No video file for this bout.</p>
              <p className="muted">Enter a timestamp when you add a phrase.</p>
            </div>
          )}

          <form className="tag-form" onSubmit={handleAdd}>
            <h3>Tag a phrase</h3>
            <div className="tag-row">
              <label>
                Time
                <input
                  type="text"
                  value={manualTime}
                  onChange={(e) => setManualTime(e.target.value)}
                  onBlur={captureTime}
                  inputMode="numeric"
                  aria-describedby="time-hint"
                />
              </label>
              <button type="button" className="btn secondary" onClick={captureTime}>
                Use playhead
              </button>
            </div>
            <p id="time-hint" className="muted tiny">
              Format m:ss or seconds. Rows seek the video when clicked.
            </p>

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
              Outcome (awarded touch)
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

            <label>
              Optional remark (wrong call, etc.)
              <input
                type="text"
                value={remark}
                onChange={(e) => setRemark(e.target.value)}
                placeholder="Does not change the counts"
              />
            </label>

            <button type="submit" className="btn primary">
              Add phrase
            </button>
          </form>
        </div>

        <div className="data-column">
          <StatsTable phrases={phrases} />

          <section className="phrase-list" aria-labelledby="phrases-heading">
            <div className="section-head">
              <h2 id="phrases-heading">Exchange log</h2>
              <p className="muted">{phrases.length} phrase{phrases.length === 1 ? '' : 's'}</p>
            </div>
            {phrases.length === 0 ? (
              <p className="muted">No phrases yet. Tag the first exchange from the video.</p>
            ) : (
              <ul>
                {phrases.map((phrase) => (
                  <li key={phrase.id}>
                    <button
                      type="button"
                      className="phrase-row"
                      onClick={() => seekTo(phrase.timestamp)}
                    >
                      <span className="phrase-time">{formatTime(phrase.timestamp)}</span>
                      <span className="phrase-action">{phrase.action}</span>
                      <span className={`phrase-outcome outcome-${phrase.outcome}`}>
                        {OUTCOME_LABELS[phrase.outcome]}
                      </span>
                    </button>
                    {phrase.remark ? <p className="phrase-remark">{phrase.remark}</p> : null}
                    <button
                      type="button"
                      className="btn tiny danger-ghost"
                      onClick={() => handleRemove(phrase.id)}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}

function parseClock(value: string): number {
  const trimmed = value.trim()
  if (!trimmed) return 0
  if (trimmed.includes(':')) {
    const parts = trimmed.split(':').map((p) => Number(p))
    if (parts.some((n) => Number.isNaN(n))) return 0
    if (parts.length === 2) return parts[0]! * 60 + parts[1]!
    if (parts.length === 3) return parts[0]! * 3600 + parts[1]! * 60 + parts[2]!
  }
  const asNumber = Number(trimmed)
  return Number.isFinite(asNumber) ? asNumber : 0
}
