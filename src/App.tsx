import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { BarChart } from './components/Charts'
import { OpponentNameField } from './components/OpponentNameField'
import { PhraseRow } from './components/PhraseEdit'
import { HistoryPage } from './HistoryPage'
import { OpponentsPage } from './OpponentsPage'
import { loadFewShotExamples, rememberCorrection } from './lib/analysis/corrections'
import { draftsToPhrases } from './lib/analysis/types'
import { getAnalysisProvider } from './lib/analysis/provider'
import { applyPhraseRules } from './lib/analysis/rules'
import { ACTIONS, type ActionName } from './lib/actions'
import { extractAudioClips, extractAudioCues } from './lib/audio'
import { captureSmartFrames } from './lib/frames'
import { defaultBoutTitle, listKnownOpponents, resolveOpponentName } from './lib/opponents'
import { computeStats, formatPct, formatTime, parseClock } from './lib/stats'
import { createDemoBout, listBouts, newId, saveBout } from './lib/storage'
import type { Bout, FencerSide, Outcome, Phrase } from './types'
import { OUTCOME_LABELS, OUTCOMES } from './types'

type Page = 'analyze' | 'history' | 'opponents'

const DEMO_VIDEO_PATH = '/demo/sabre-sample.webm'
const DEMO_VIDEO_NAME = 'Demo sabre bout (Commons sample)'

export default function App() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [page, setPage] = useState<Page>('analyze')
  const [savedBouts, setSavedBouts] = useState<Bout[]>([])
  const [opponentName, setOpponentName] = useState('')
  const [boutId, setBoutId] = useState<string | null>(null)
  const [createdAt, setCreatedAt] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [side, setSide] = useState<FencerSide>('left')
  /** Optional filmed date (YYYY-MM-DD). Empty = use upload day in History. */
  const [recordedAt, setRecordedAt] = useState('')
  const [phrases, setPhrases] = useState<Phrase[]>([])
  const [action, setAction] = useState<ActionName>('Simple attack')
  const [opponentAction, setOpponentAction] = useState<ActionName>('Counterattack')
  const [outcome, setOutcome] = useState<Outcome>('point_for')
  const [timeLabel, setTimeLabel] = useState('0:00')
  const [analyzing, setAnalyzing] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [demoMode, setDemoMode] = useState(false)

  const knownOpponents = useMemo(() => listKnownOpponents(savedBouts), [savedBouts])

  async function refreshBouts() {
    setSavedBouts(await listBouts())
  }

  useEffect(() => {
    void refreshBouts()
  }, [])

  useEffect(() => {
    return () => {
      if (videoUrl) URL.revokeObjectURL(videoUrl)
    }
  }, [videoUrl])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('demo') !== '1') return
    let cancelled = false

    async function loadDemo() {
      setStatus('Loading demo sabre bout…')
      try {
        const res = await fetch(DEMO_VIDEO_PATH)
        if (!res.ok) throw new Error(`Demo video missing (${res.status})`)
        const blob = await res.blob()
        if (cancelled) return
        const demoFile = new File([blob], DEMO_VIDEO_NAME, {
          type: blob.type || 'video/webm',
        })
        const demo = createDemoBout()
        if (videoUrl) URL.revokeObjectURL(videoUrl)
        setDemoMode(true)
        setBoutId(demo.id)
        setCreatedAt(demo.createdAt)
        setFile(demoFile)
        setVideoUrl(URL.createObjectURL(demoFile))
        setSide(demo.side)
        setPhrases(demo.phrases)
        setTimeLabel('0:00')
        setStatus(
          'Demo test run loaded — sample sabre video with seeded Moneyball tags. Press Analyze bout to re-run AI.',
        )
        await saveBout({ ...demo, title: DEMO_VIDEO_NAME, hasVideo: true })
        await refreshBouts()
      } catch (err) {
        if (!cancelled) {
          setStatus(err instanceof Error ? err.message : 'Demo load failed')
        }
      }
    }

    void loadDemo()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount for ?demo=1
  }, [])

  function resolvedOpponent(raw = opponentName): string | undefined {
    const name = resolveOpponentName(
      raw,
      knownOpponents.map((o) => o.name),
    )
    return name || undefined
  }

  async function persist(
    nextPhrases: Phrase[],
    id: string,
    title: string,
    filmDate: string,
    created: string,
    opponentRaw = opponentName,
  ) {
    const opponent = resolvedOpponent(opponentRaw)
    const bout: Bout = {
      id,
      title: opponent && !file ? defaultBoutTitle(opponent, false) : title,
      side,
      createdAt: created,
      recordedAt: filmDate || undefined,
      opponentName: opponent,
      hasVideo: true,
      phrases: nextPhrases,
    }
    await saveBout(bout)
    await refreshBouts()
  }

  function startBout(nextFile: File) {
    if (videoUrl) URL.revokeObjectURL(videoUrl)
    const id = newId()
    const created = new Date().toISOString()
    setBoutId(id)
    setCreatedAt(created)
    setFile(nextFile)
    setVideoUrl(URL.createObjectURL(nextFile))
    setPhrases([])
    setTimeLabel('0:00')
    setStatus(null)
    void persist(
      [],
      id,
      nextFile.name.replace(/\.[^.]+$/, '') || nextFile.name,
      recordedAt,
      created,
    )
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
    setDemoMode(false)
    if (new URLSearchParams(window.location.search).has('demo')) {
      const url = new URL(window.location.href)
      url.searchParams.delete('demo')
      window.history.replaceState({}, '', url.pathname + url.search + url.hash)
    }
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
      opponentAction,
      outcome,
    }
    const next = [...phrases, phrase].sort((a, b) => a.timestamp - b.timestamp)
    void applyPhrases(next)
  }

  function updatePhrase(nextPhrase: Phrase) {
    if (nextPhrase.edited) rememberCorrection(nextPhrase)
    const next = phrases
      .map((p) => (p.id === nextPhrase.id ? nextPhrase : p))
      .sort((a, b) => a.timestamp - b.timestamp)
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
    setStatus('Preparing video…')
    try {
      if (video.readyState < 1) {
        await new Promise<void>((resolve, reject) => {
          const timer = window.setTimeout(() => {
            cleanup()
            reject(new Error('Video metadata timed out — wait for the player to load, then retry.'))
          }, 8000)
          const ok = () => {
            cleanup()
            resolve()
          }
          const fail = () => {
            cleanup()
            reject(new Error('Video failed to load'))
          }
          const cleanup = () => {
            window.clearTimeout(timer)
            video.removeEventListener('loadedmetadata', ok)
            video.removeEventListener('error', fail)
          }
          video.addEventListener('loadedmetadata', ok, { once: true })
          video.addEventListener('error', fail, { once: true })
        })
      }

      setStatus('Reading audio peaks…')
      const audioCues = file ? await extractAudioCues(file, { maxPeaks: 8 }) : []
      setStatus(
        audioCues.length
          ? `Cutting speech clips (${Math.min(4, audioCues.length)})…`
          : 'No audio peaks — sampling frames…',
      )
      const audioClips = file && audioCues.length
        ? await extractAudioClips(file, audioCues, { maxClips: 4, padSec: 1.2 })
        : []

      const anchors = [
        ...audioCues.map((c) => c.timestamp),
        ...audioClips.map((c) => c.timestamp),
      ]
      setStatus('Sampling frames around Halt…')
      const { frames, duration } = await captureSmartFrames(video, {
        anchors,
        evenCount: 3,
        maxFrames: 8,
        maxWidth: 384,
        quality: 0.55,
        onProgress: (done, total) => setStatus(`Sampling frames (${done}/${total})…`),
      })
      const fewShot = loadFewShotExamples(6)
      setStatus(
        audioClips.length
          ? `Whisper + vision (${audioClips.length} clips, ${frames.length} frames)…`
          : `Vision only (${frames.length} frames)…`,
      )
      const result = await getAnalysisProvider().analyze({
        side,
        title: file?.name,
        duration,
        frames,
        audioCues,
        audioClips,
        fewShot,
      })
      if (result.status === 'ok' && result.drafts.length > 0) {
        const drafts = applyPhraseRules(draftsToPhrases(result.drafts, newId), side)
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
  const opp = stats.opponentSituation
  const active = Boolean(videoUrl)

  return (
    <div className="page">
      <div className="atmosphere" aria-hidden />

      <header className="masthead">
        <div className="masthead-row">
          <h1 className="brand">TouchStat</h1>
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
            <button
              type="button"
              className={page === 'opponents' ? 'nav-on' : undefined}
              onClick={() => setPage('opponents')}
            >
              Opponents
            </button>
          </nav>
        </div>
        {page === 'analyze' ? (
          <p className="lede uvp">
            TouchStat delivers instant, AI-powered video breakdown for every fencing touch,
            turning raw bout footage into clear, actionable action stats for Foil, Épée, and
            Saber.
          </p>
        ) : page === 'opponents' ? (
          <p className="lede">Named-opponent history, W/L, and action patterns.</p>
        ) : (
          <p className="lede">Usage and success trends across saved bouts.</p>
        )}
      </header>

      {page === 'history' ? (
        <HistoryPage onAnalyze={() => setPage('analyze')} />
      ) : page === 'opponents' ? (
        <OpponentsPage
          bouts={savedBouts}
          onBoutsChange={refreshBouts}
          onAnalyzeOpponent={(name) => {
            setOpponentName(name)
            setPage('analyze')
          }}
        />
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
              Filmed <em>(optional)</em>
            </span>
            <input
              type="date"
              value={recordedAt}
              onChange={(e) => setRecordedAt(e.target.value)}
            />
          </label>

          <OpponentNameField
            hint="(optional)"
            value={opponentName}
            opponents={knownOpponents}
            onChange={setOpponentName}
            onSelect={setOpponentName}
          />

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
              <span> · {side}</span>
              {recordedAt ? <span> · {recordedAt}</span> : null}
              {resolvedOpponent() ? <span> · vs {resolvedOpponent()}</span> : null}
              {demoMode ? <span> · demo</span> : null}
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
              Ref hands + speech (Whisper) + your side. Hands decide the award. Edit if wrong.
            </p>
          </div>
          {status ? (
            <p className="status-line" role="status">
              {status}
            </p>
          ) : null}

          {phrases.length > 0 ? (
            <section className="moneyball" aria-labelledby="stats-title">
              <div className="stats-head">
                <h2 id="stats-title">Moneyball</h2>
                <p>
                  {stats.totals.attempts} tries · {formatPct(stats.totals.successRate)} success ·
                  net{' '}
                  <span className={stats.totals.net >= 0 ? 'pos' : 'neg'}>
                    {stats.totals.net > 0 ? `+${stats.totals.net}` : stats.totals.net}
                  </span>
                </p>
              </div>

              <div className="chart-grid">
                <BarChart
                  title="Your success rate"
                  tone="for"
                  items={usedActions.map((row) => ({
                    label: row.action,
                    value: row.successRate,
                    count: row.attempts,
                    hint: `${row.pointsFor} for / ${row.pointsAgainst} against`,
                  }))}
                  empty="Add phrases to see your rates"
                />
                <BarChart
                  title="Your usage share"
                  tone="accent"
                  items={usedActions.map((row) => ({
                    label: row.action,
                    value: stats.totals.attempts
                      ? row.attempts / stats.totals.attempts
                      : null,
                    count: row.attempts,
                  }))}
                />
              </div>

              <div className="situation">
                <h3 className="situation-title">Opponent when you win vs lose</h3>
                <p className="situation-lede">
                  What they did in phrases you scored — and phrases they scored.
                </p>
                <div className="chart-grid">
                  <BarChart
                    title={`When you win (${opp.whenYouWin.phrases})`}
                    tone="for"
                    items={opp.whenYouWin.byAction.map((row) => ({
                      label: row.action,
                      value: row.share,
                      count: row.count,
                    }))}
                    empty="No opponent tags on your scoring phrases yet"
                  />
                  <BarChart
                    title={`When you lose (${opp.whenYouLose.phrases})`}
                    tone="against"
                    items={opp.whenYouLose.byAction.map((row) => ({
                      label: row.action,
                      value: row.share,
                      count: row.count,
                    }))}
                    empty="No opponent tags on phrases against you yet"
                  />
                </div>
                {opp.opponentSuccess.length > 0 ? (
                  <BarChart
                    title="Opponent action — their success (when decisive)"
                    tone="against"
                    items={opp.opponentSuccess.map((row) => ({
                      label: row.action,
                      value: row.theirSuccessRate,
                      count: row.attempts,
                      hint: `${row.theirPoints} their point / ${row.yourPoints} yours`,
                    }))}
                  />
                ) : null}
              </div>
            </section>
          ) : null}

          <OpponentNameField
            id="bout-opponent-name"
            hint="(tags this bout)"
            value={opponentName}
            opponents={knownOpponents}
            onChange={setOpponentName}
            onSelect={setOpponentName}
            onCommit={(value) => {
              if (boutId && file && createdAt) {
                void persist(
                  phrases,
                  boutId,
                  file.name.replace(/\.[^.]+$/, '') || file.name,
                  recordedAt,
                  createdAt,
                  value,
                )
              }
            }}
          />

          <form className="tag" onSubmit={addPhrase}>
            <p className="tag-hint">Mark a phrase at the playhead — you + opponent action.</p>
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
                You
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
                Opponent
                <select
                  value={opponentAction}
                  onChange={(e) => setOpponentAction(e.target.value as ActionName)}
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

          {phrases.length > 0 ? (
            <ul className="log" aria-label="Phrases">
              {phrases.map((phrase) => (
                <PhraseRow
                  key={phrase.id}
                  phrase={phrase}
                  onSeek={seekTo}
                  onSave={updatePhrase}
                  onRemove={() => removePhrase(phrase.id)}
                />
              ))}
            </ul>
          ) : null}
        </section>
      )}
    </div>
  )
}
