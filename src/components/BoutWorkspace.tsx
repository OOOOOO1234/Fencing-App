import { useEffect, useRef, useState, type FormEvent } from 'react'
import { draftsToPhrases } from '../lib/analysis/types'
import { getAnalysisProvider } from '../lib/analysis/provider'
import { hasAnalysisProvider } from '../lib/config'
import { boutSummaryText, boutToCsv, downloadText } from '../lib/export'
import { glossaryFor } from '../lib/glossary'
import { formatTime, parseClock } from '../lib/stats'
import { buildShareUrl } from '../lib/share'
import { newId, saveInvite } from '../lib/storage'
import type {
  ActionName,
  Bout,
  FencerSide,
  Initiative,
  Outcome,
  Phrase,
} from '../types'
import { ACTIONS, OUTCOME_LABELS, OUTCOMES } from '../types'
import { StatsTable } from './StatsTable'

interface BoutWorkspaceProps {
  bout: Bout
  videoUrl: string | null
  readOnly?: boolean
  onSavePhrases: (phrases: Phrase[]) => Promise<void>
  onSaveMeta: (patch: { title: string; side: FencerSide }) => Promise<void>
  onBack: () => void
  onDelete?: () => Promise<void>
}

export function BoutWorkspace({
  bout,
  videoUrl,
  readOnly = false,
  onSavePhrases,
  onSaveMeta,
  onBack,
  onDelete,
}: BoutWorkspaceProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [phrases, setPhrases] = useState<Phrase[]>(bout.phrases)
  const [title, setTitle] = useState(bout.title)
  const [side, setSide] = useState<FencerSide>(bout.side)
  const [editingMeta, setEditingMeta] = useState(false)
  const [action, setAction] = useState<ActionName>('Simple attack')
  const [outcome, setOutcome] = useState<Outcome>('point_for')
  const [remark, setRemark] = useState('')
  const [scoreYou, setScoreYou] = useState('')
  const [scoreThem, setScoreThem] = useState('')
  const [initiative, setInitiative] = useState<Initiative>('unknown')
  const [manualTime, setManualTime] = useState('0:00')
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)
  const [analyzing, setAnalyzing] = useState(false)

  useEffect(() => {
    setPhrases(bout.phrases)
    setTitle(bout.title)
    setSide(bout.side)
    setDirty(false)
  }, [bout.id, bout.phrases, bout.title, bout.side])

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
    if (readOnly) return
    const timestamp = videoUrl ? readVideoTime() : parseClock(manualTime)
    const phrase: Phrase = {
      id: newId(),
      timestamp,
      action,
      outcome,
      remark: remark.trim() || undefined,
      scoreYou: scoreYou === '' ? undefined : Number(scoreYou),
      scoreThem: scoreThem === '' ? undefined : Number(scoreThem),
      initiative: initiative === 'unknown' ? undefined : initiative,
    }
    const next = [...phrases, phrase].sort((a, b) => a.timestamp - b.timestamp)
    setPhrases(next)
    setDirty(true)
    setRemark('')
    void persist(next)
  }

  function handleRemove(id: string) {
    if (readOnly) return
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

  async function handleAnalyze() {
    setAnalyzing(true)
    setMessage(null)
    const provider = getAnalysisProvider()
    const result = await provider.analyze({
      boutId: bout.id,
      side: bout.side,
      title: bout.title,
    })
    if (result.status === 'ok' && result.drafts.length > 0) {
      const drafts = draftsToPhrases(result.drafts, newId)
      const next = [...phrases, ...drafts].sort((a, b) => a.timestamp - b.timestamp)
      setPhrases(next)
      setDirty(true)
      await persist(next)
    }
    setMessage(result.message)
    setAnalyzing(false)
  }

  async function handleInvite() {
    const token = newId().replace(/-/g, '').slice(0, 16)
    const snapshot = { ...bout, phrases }
    await saveInvite({
      id: newId(),
      boutId: bout.id,
      token,
      createdAt: new Date().toISOString(),
      role: 'coach',
      label: 'Coach invite',
    })
    const url = buildShareUrl(snapshot)
    setInviteUrl(url)
    try {
      await navigator.clipboard.writeText(url)
      setMessage('Coach link copied (read-only snapshot in the URL). Syncs to cloud when Supabase keys are set.')
    } catch {
      setMessage('Coach link ready below. Copy it to share read-only stats.')
    }
  }

  const actionHint = glossaryFor(action)

  return (
    <div className="workspace">
      <header className="workspace-bar">
        <button type="button" className="btn ghost" onClick={onBack}>
          ← All bouts
        </button>
        <div className="workspace-title">
          {editingMeta && !readOnly ? (
            <form
              className="meta-edit"
              onSubmit={(e) => {
                e.preventDefault()
                void (async () => {
                  await onSaveMeta({ title: title.trim() || bout.title, side })
                  setEditingMeta(false)
                  setMessage('Bout details saved')
                })()
              }}
            >
              <input value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Title" />
              <select
                value={side}
                onChange={(e) => setSide(e.target.value as FencerSide)}
                aria-label="Side"
              >
                <option value="left">Left</option>
                <option value="right">Right</option>
              </select>
              <button type="submit" className="btn tiny primary">
                Save
              </button>
              <button
                type="button"
                className="btn tiny ghost"
                onClick={() => {
                  setTitle(bout.title)
                  setSide(bout.side)
                  setEditingMeta(false)
                }}
              >
                Cancel
              </button>
            </form>
          ) : (
            <>
              <h2>{bout.title}</h2>
              <p className="muted">
                Analyzing <strong>{bout.side}</strong> fencer
                {bout.isDemo ? (
                  <>
                    {' '}
                    · <span className="badge demo">Demo data</span>
                  </>
                ) : null}
                {readOnly ? ' · coach view (read-only)' : null}
                {dirty ? ' · unsaved changes…' : null}
                {saving ? ' · saving…' : null}
                {message && !saving ? ` · ${message}` : null}
              </p>
            </>
          )}
        </div>
        <div className="workspace-actions">
          {!readOnly ? (
            <button type="button" className="btn secondary" onClick={() => setEditingMeta(true)}>
              Edit
            </button>
          ) : null}
          <button
            type="button"
            className="btn secondary"
            onClick={() =>
              downloadText(
                `${bout.title.replace(/\s+/g, '-').toLowerCase()}-phrases.csv`,
                boutToCsv({ ...bout, phrases }),
                'text/csv',
              )
            }
          >
            Export CSV
          </button>
          <button
            type="button"
            className="btn secondary"
            onClick={() => {
              void (async () => {
                const text = boutSummaryText({ ...bout, phrases })
                try {
                  await navigator.clipboard.writeText(text)
                  setMessage('Summary copied')
                } catch {
                  downloadText('bout-summary.txt', text, 'text/plain')
                }
              })()
            }}
          >
            Copy summary
          </button>
          {!readOnly && onDelete ? (
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
          ) : null}
        </div>
      </header>

      {bout.isDemo ? (
        <p className="banner demo" role="status">
          Sample phrase data to explore stats — not AI vision. Upload your own video to tag a real
          bout.
        </p>
      ) : readOnly ? (
        <p className="banner info" role="status">
          Read-only coach share. You can watch stats and export; tagging is disabled.
        </p>
      ) : (
        <p className="banner info" role="status">
          Manual tagging always works. AI analysis runs only when{' '}
          <code>VITE_ANALYSIS_API_URL</code> + <code>VITE_ANALYSIS_API_KEY</code> are set
          {hasAnalysisProvider() ? ' (keys detected).' : ' (currently not configured).'}
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

          {!readOnly ? (
            <>
              <div className="form-actions" style={{ marginTop: '0.75rem' }}>
                <button
                  type="button"
                  className="btn secondary"
                  disabled={analyzing}
                  onClick={() => void handleAnalyze()}
                >
                  {analyzing
                    ? 'Analyzing…'
                    : hasAnalysisProvider()
                      ? 'Analyze with AI'
                      : 'AI analysis (needs API key)'}
                </button>
                <button type="button" className="btn secondary" onClick={() => void handleInvite()}>
                  Invite coach
                </button>
              </div>
              {inviteUrl ? (
                <p className="file-name break-all">
                  Share link: <a href={inviteUrl}>{inviteUrl}</a>
                </p>
              ) : null}

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
                    />
                  </label>
                  <button type="button" className="btn secondary" onClick={captureTime}>
                    Use playhead
                  </button>
                </div>

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
                <p className="muted tiny">
                  {actionHint.summary} {actionHint.rowNote}
                </p>

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

                <div className="tag-row score-row">
                  <label>
                    Score you
                    <input
                      type="number"
                      min={0}
                      value={scoreYou}
                      onChange={(e) => setScoreYou(e.target.value)}
                      placeholder="opt."
                    />
                  </label>
                  <label>
                    Score them
                    <input
                      type="number"
                      min={0}
                      value={scoreThem}
                      onChange={(e) => setScoreThem(e.target.value)}
                      placeholder="opt."
                    />
                  </label>
                  <label>
                    Initiative
                    <select
                      value={initiative}
                      onChange={(e) => setInitiative(e.target.value as Initiative)}
                    >
                      <option value="unknown">Unknown</option>
                      <option value="you">You started</option>
                      <option value="them">They started</option>
                    </select>
                  </label>
                </div>

                <label>
                  Optional remark
                  <input
                    type="text"
                    value={remark}
                    onChange={(e) => setRemark(e.target.value)}
                    placeholder="Wrong call note — does not change counts"
                  />
                </label>

                <button type="submit" className="btn primary">
                  Add phrase
                </button>
              </form>
            </>
          ) : null}
        </div>

        <div className="data-column">
          <StatsTable phrases={phrases} />

          <section className="phrase-list" aria-labelledby="phrases-heading">
            <div className="section-head">
              <h2 id="phrases-heading">Exchange log</h2>
              <p className="muted">{phrases.length} phrase{phrases.length === 1 ? '' : 's'}</p>
            </div>
            {phrases.length === 0 ? (
              <div className="empty-inline">
                <p className="muted">
                  No phrases yet. Seek the video to the start of an exchange, pick the action and
                  awarded outcome, then add it.
                </p>
              </div>
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
                      <span className="phrase-action">
                        {phrase.action}
                        {phrase.fromAnalysis ? ' · AI draft' : ''}
                      </span>
                      <span className={`phrase-outcome outcome-${phrase.outcome}`}>
                        {OUTCOME_LABELS[phrase.outcome]}
                      </span>
                    </button>
                    {phrase.scoreYou != null && phrase.scoreThem != null ? (
                      <p className="phrase-remark">
                        Score {phrase.scoreYou}-{phrase.scoreThem}
                        {phrase.initiative ? ` · ${phrase.initiative} started` : ''}
                      </p>
                    ) : null}
                    {phrase.remark ? <p className="phrase-remark">{phrase.remark}</p> : null}
                    {!readOnly ? (
                      <button
                        type="button"
                        className="btn tiny danger-ghost"
                        onClick={() => handleRemove(phrase.id)}
                      >
                        Remove
                      </button>
                    ) : null}
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
