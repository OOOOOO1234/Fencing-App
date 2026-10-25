import { useMemo, useState, type FormEvent } from 'react'
import { BarChart, SparkLine } from './components/Charts'
import { OpponentNameField } from './components/OpponentNameField'
import { ACTIONS, type ActionName } from './lib/actions'
import {
  buildOpponentProfile,
  defaultBoutTitle,
  displayOpponentName,
  formatBoutScore,
  listKnownOpponents,
  resolveOpponentName,
} from './lib/opponents'
import { formatTime } from './lib/stats'
import { getBout, newId, saveBout } from './lib/storage'
import type { Bout, Outcome, Phrase } from './types'
import { OUTCOME_LABELS, OUTCOMES } from './types'

interface OpponentsPageProps {
  bouts: Bout[]
  onBoutsChange: () => Promise<void> | void
  onAnalyzeOpponent: (name: string) => void
}

export function OpponentsPage({ bouts, onBoutsChange, onAnalyzeOpponent }: OpponentsPageProps) {
  const known = useMemo(() => listKnownOpponents(bouts), [bouts])
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState('')
  const [logOpen, setLogOpen] = useState(false)
  const [draftId, setDraftId] = useState<string | null>(null)
  const [recordedAt, setRecordedAt] = useState(() => new Date().toISOString().slice(0, 10))
  const [action, setAction] = useState<ActionName>('Simple attack')
  const [opponentAction, setOpponentAction] = useState<ActionName>('Counterattack')
  const [outcome, setOutcome] = useState<Outcome>('point_for')
  const [saving, setSaving] = useState(false)

  const profile = useMemo(
    () => (selected ? buildOpponentProfile(bouts, selected) : null),
    [bouts, selected],
  )

  function choose(name: string) {
    const resolved = resolveOpponentName(name, known.map((o) => o.name))
    if (!resolved) return
    setQuery(resolved)
    if (resolved !== selected) {
      setDraftId(null)
      setLogOpen(false)
    }
    setSelected(resolved)
  }

  async function ensureDraft(): Promise<Bout | null> {
    const name = selected
    if (!name) return null
    if (draftId) {
      const existing = (await getBout(draftId)) ?? bouts.find((b) => b.id === draftId)
      if (existing) return existing
    }
    const createdAt = new Date().toISOString()
    const bout: Bout = {
      id: newId(),
      title: defaultBoutTitle(name, false),
      side: 'left',
      createdAt,
      recordedAt: recordedAt || undefined,
      opponentName: name,
      hasVideo: false,
      phrases: [],
    }
    await saveBout(bout)
    setDraftId(bout.id)
    return bout
  }

  async function addTouch(event: FormEvent) {
    event.preventDefault()
    if (!selected) return
    setSaving(true)
    try {
      const bout = await ensureDraft()
      if (!bout) return
      const timestamp = bout.phrases.length
      const phrase: Phrase = {
        id: newId(),
        timestamp,
        action,
        opponentAction,
        outcome,
      }
      const next: Bout = {
        ...bout,
        recordedAt: recordedAt || bout.recordedAt,
        phrases: [...bout.phrases, phrase],
      }
      await saveBout(next)
      await onBoutsChange()
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="history opponents" aria-labelledby="opponents-title">
      <div className="history-head">
        <h2 id="opponents-title">Opponents</h2>
        <p>Look up a fencer, see every bout against them, and log new touches under their name.</p>
      </div>

      <OpponentNameField
        hint="(type to search or add)"
        value={query}
        opponents={known}
        onChange={(value) => {
          setQuery(value)
          if (selected && !value.trim()) setSelected('')
        }}
        onSelect={choose}
        onSubmit={choose}
      />
      {selected ? (
        <p>
          <button
            type="button"
            className="text-btn"
            onClick={() => {
              setSelected('')
              setQuery('')
              setDraftId(null)
              setLogOpen(false)
            }}
          >
            All opponents
          </button>
        </p>
      ) : null}

      {known.length > 0 && !selected ? (
        <ul className="opponent-index" aria-label="Known opponents">
          {known.map((item) => (
            <li key={item.key}>
              <button type="button" onClick={() => choose(item.name)}>
                <strong>{item.name}</strong>
                <span>
                  {item.boutCount} bout{item.boutCount === 1 ? '' : 's'}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {query && !selected ? (
        <p className="muted">
          Press Enter to open{' '}
          <button type="button" className="text-btn" onClick={() => choose(query)}>
            {displayOpponentName(query) || 'this opponent'}
          </button>
          .
        </p>
      ) : null}

      {selected && profile ? (
        <OpponentDetail
          profile={profile}
          logOpen={logOpen}
          setLogOpen={setLogOpen}
          recordedAt={recordedAt}
          setRecordedAt={setRecordedAt}
          action={action}
          setAction={setAction}
          opponentAction={opponentAction}
          setOpponentAction={setOpponentAction}
          outcome={outcome}
          setOutcome={setOutcome}
          saving={saving}
          onAddTouch={addTouch}
          onAnalyze={() => onAnalyzeOpponent(selected)}
        />
      ) : null}
    </section>
  )
}

function OpponentDetail({
  profile,
  logOpen,
  setLogOpen,
  recordedAt,
  setRecordedAt,
  action,
  setAction,
  opponentAction,
  setOpponentAction,
  outcome,
  setOutcome,
  saving,
  onAddTouch,
  onAnalyze,
}: {
  profile: NonNullable<ReturnType<typeof buildOpponentProfile>>
  logOpen: boolean
  setLogOpen: (open: boolean) => void
  recordedAt: string
  setRecordedAt: (value: string) => void
  action: ActionName
  setAction: (value: ActionName) => void
  opponentAction: ActionName
  setOpponentAction: (value: ActionName) => void
  outcome: Outcome
  setOutcome: (value: Outcome) => void
  saving: boolean
  onAddTouch: (event: FormEvent) => void
  onAnalyze: () => void
}) {
  const rec = profile.record
  const netLabel = rec.differential > 0 ? `+${rec.differential}` : String(rec.differential)
  const usedYou = profile.youByAction

  return (
    <div className="opponent-detail">
      <div className="stats-head">
        <h2>{profile.name}</h2>
        <p>
          {rec.wins}–{rec.losses}
          {rec.draws ? `–${rec.draws}` : ''} · {formatBoutScore({ you: rec.touchesFor, them: rec.touchesAgainst })}{' '}
          touches · net <span className={rec.differential >= 0 ? 'pos' : 'neg'}>{netLabel}</span>
        </p>
      </div>

      <div className="opponent-actions">
        <button type="button" className="analyze" onClick={onAnalyze}>
          Film / analyze
        </button>
        <button type="button" className="text-btn" onClick={() => setLogOpen(!logOpen)}>
          {logOpen ? 'Hide touch log' : 'Log touches'}
        </button>
      </div>

      {logOpen ? (
        <form className="tag" onSubmit={onAddTouch}>
          <p className="tag-hint">
            Tag a phrase the same way as Analyze — no video required. Actions match the sabre taxonomy.
          </p>
          <label className="date-field">
            <span>Filmed</span>
            <input
              type="date"
              value={recordedAt}
              onChange={(e) => setRecordedAt(e.target.value)}
            />
          </label>
          <div className="tag-grid opponent-tag-grid">
            <label>
              You
              <select value={action} onChange={(e) => setAction(e.target.value as ActionName)}>
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
              <select value={outcome} onChange={(e) => setOutcome(e.target.value as Outcome)}>
                {OUTCOMES.map((key) => (
                  <option key={key} value={key}>
                    {OUTCOME_LABELS[key]}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className="add" disabled={saving}>
              {saving ? 'Saving…' : 'Add'}
            </button>
          </div>
        </form>
      ) : null}

      {profile.bouts.length === 0 ? (
        <div className="history-empty">
          <p>No bouts tagged against {profile.name} yet. Log a touch or analyze a video.</p>
        </div>
      ) : (
        <>
          {profile.trend.length > 1 ? (
            <SparkLine
              title="Win rate over time"
              points={profile.trend.map((p) => ({
                label: p.label,
                value: p.cumulativeWinRate,
                hint: p.result ?? 'no score',
              }))}
            />
          ) : null}

          <div className="situation">
            <h3 className="situation-title">Patterns</h3>
            <p className="situation-lede">
              Pooled from every tagged phrase vs {profile.name}. Same actions as Moneyball.
            </p>
            <div className="chart-grid">
              <BarChart
                title="How you score"
                tone="for"
                items={usedYou.map((row) => ({
                  label: row.action,
                  value: row.successRate,
                  count: row.attempts,
                  hint: `${row.pointsFor} for / ${row.pointsAgainst} against`,
                }))}
                empty="No phrases tagged yet"
              />
              <BarChart
                title="Your usage"
                tone="accent"
                items={usedYou.map((row) => ({
                  label: row.action,
                  value: profile.stats.totals.attempts
                    ? row.attempts / profile.stats.totals.attempts
                    : null,
                  count: row.attempts,
                }))}
              />
              <BarChart
                title={`They do when you win (${profile.themWhenYouWin.phrases})`}
                tone="for"
                items={profile.themWhenYouWin.byAction.map((row) => ({
                  label: row.action,
                  value: row.share,
                  count: row.count,
                }))}
                empty="No opponent actions on your scoring phrases"
              />
              <BarChart
                title={`They do when you lose (${profile.themWhenYouLose.phrases})`}
                tone="against"
                items={profile.themWhenYouLose.byAction.map((row) => ({
                  label: row.action,
                  value: row.share,
                  count: row.count,
                }))}
                empty="No opponent actions on phrases against you"
              />
            </div>
            {profile.themSuccess.length > 0 ? (
              <BarChart
                title="Their action success (decisive phrases)"
                tone="against"
                items={profile.themSuccess.map((row) => ({
                  label: row.action,
                  value: row.theirSuccessRate,
                  count: row.attempts,
                  hint: `${row.theirPoints} their point / ${row.yourPoints} yours`,
                }))}
              />
            ) : null}
          </div>

          <div className="bout-history">
            <h3 className="situation-title">Bout history</h3>
            <ul className="bout-history-list">
              {profile.bouts.map((row) => (
                <li key={row.bout.id}>
                  <header>
                    <strong>{row.label}</strong>
                    <span className={`result result-${row.result ?? 'none'}`}>
                      {row.result ?? '—'} {formatBoutScore(row.score)}
                    </span>
                    {row.bout.hasVideo ? <em>video</em> : <em>logged</em>}
                  </header>
                  {row.phrases.length > 0 ? (
                    <ul
                      className={row.bout.hasVideo ? 'log compact-log' : 'log compact-log no-time'}
                      aria-label={`Touches vs ${profile.name}`}
                    >
                      {row.phrases.map((phrase) => (
                        <li key={phrase.id}>
                          {row.bout.hasVideo ? (
                            <span className="log-time">{formatTime(phrase.timestamp)}</span>
                          ) : null}
                          <span>
                            {phrase.action}
                            {phrase.opponentAction ? ` / ${phrase.opponentAction}` : ''}
                          </span>
                          <span className={outcomeClass(phrase.outcome)}>
                            {OUTCOME_LABELS[phrase.outcome]}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="muted">No phrases tagged.</p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  )
}

function outcomeClass(outcome: Outcome): string {
  if (outcome === 'point_for') return 'pos'
  if (outcome === 'point_against') return 'neg'
  return 'muted'
}
