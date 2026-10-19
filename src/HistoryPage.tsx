import { useEffect, useState } from 'react'
import { SparkLine } from './components/Charts'
import { formatPct } from './lib/stats'
import { listBouts } from './lib/storage'
import { buildActionTrends, sortBoutsForTrends, type ActionTrend } from './lib/trends'
import type { Bout } from './types'

interface HistoryPageProps {
  onAnalyze: () => void
}

export function HistoryPage({ onAnalyze }: HistoryPageProps) {
  const [bouts, setBouts] = useState<Bout[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void (async () => {
      try {
        setBouts(await listBouts())
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const withPhrases = bouts.filter((b) => b.phrases.length > 0)
  const trends = buildActionTrends(withPhrases)
  const ordered = sortBoutsForTrends(withPhrases)

  return (
    <section className="history" aria-labelledby="history-title">
      <div className="history-head">
        <h2 id="history-title">History</h2>
        <p>Usage and success over time. X-axis uses filmed date when set.</p>
      </div>

      {loading ? <p className="muted">Loading…</p> : null}

      {!loading && ordered.length === 0 ? (
        <div className="history-empty">
          <p>No saved bouts with phrases yet.</p>
          <button type="button" className="text-btn" onClick={onAnalyze}>
            Analyze a video
          </button>
        </div>
      ) : null}

      {ordered.length > 0 ? (
        <div className="trend-list">
          {trends.map((trend) => (
            <ActionTrendBlock key={trend.action} trend={trend} />
          ))}
        </div>
      ) : null}
    </section>
  )
}

function ActionTrendBlock({ trend }: { trend: ActionTrend }) {
  return (
    <article className="trend-block">
      <header className="trend-block-head">
        <h3>{trend.action}</h3>
        <p className="muted">
          {trend.totalAttempts} tries · {trend.points.length} bout
          {trend.points.length === 1 ? '' : 's'}
        </p>
      </header>

      <div className="trend-charts">
        <SparkLine
          title="Usage share"
          points={trend.points.map((p) => ({
            label: p.label,
            value: p.usageRate,
            hint: p.attempts ? `${p.attempts}/${p.totalAttempts}` : '0',
          }))}
        />
        <SparkLine
          title="Success rate"
          points={trend.points.map((p) => ({
            label: p.label,
            value: p.attempts > 0 ? p.successRate : null,
            hint: p.attempts ? `${p.attempts} try` : '—',
          }))}
          format={(v) => formatPct(v)}
        />
      </div>
    </article>
  )
}
