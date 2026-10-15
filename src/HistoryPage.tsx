import { useEffect, useState } from 'react'
import { formatPct } from './lib/stats'
import { listBouts } from './lib/storage'
import {
  boutTrendDate,
  buildActionTrends,
  formatTrendLabel,
  sortBoutsForTrends,
  type ActionTrend,
} from './lib/trends'
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
        <p>
          Action usage and success rates across saved bouts. X-axis uses the filmed date when you
          set one; otherwise the day you uploaded.
        </p>
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
        <>
          <ul className="bout-axis" aria-label="Bouts in order">
            {ordered.map((bout) => (
              <li key={bout.id}>
                <span>{formatTrendLabel(boutTrendDate(bout))}</span>
                <span className="muted">
                  {bout.title}
                  {bout.recordedAt ? '' : ' · upload day'}
                </span>
              </li>
            ))}
          </ul>

          <div className="trend-list">
            {trends.map((trend) => (
              <ActionTrendBlock key={trend.action} trend={trend} />
            ))}
          </div>
        </>
      ) : null}
    </section>
  )
}

function ActionTrendBlock({ trend }: { trend: ActionTrend }) {
  return (
    <article className="trend-block">
      <header className="trend-block-head">
        <h3>{trend.action}</h3>
        <p className="muted">{trend.totalAttempts} tries across {trend.points.length} bout{trend.points.length === 1 ? '' : 's'}</p>
      </header>

      <div className="trend-charts">
        <TrendChart
          title="Usage share"
          points={trend.points.map((p) => ({
            label: p.label,
            value: p.usageRate,
            hint: p.attempts ? `${p.attempts}/${p.totalAttempts}` : '0',
          }))}
          format={(v) => formatPct(v)}
        />
        <TrendChart
          title="Success rate"
          points={trend.points.map((p) => ({
            label: p.label,
            value: p.attempts > 0 ? p.successRate : null,
            hint: p.attempts ? `${p.attempts} try` : '—',
          }))}
          format={(v) => formatPct(v)}
        />
      </div>

      <div className="table-scroll">
        <table className="trend-table">
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">Bout</th>
              <th scope="col">Try</th>
              <th scope="col">Usage</th>
              <th scope="col">Success</th>
            </tr>
          </thead>
          <tbody>
            {trend.points.map((p) => (
              <tr key={p.boutId}>
                <td>{p.label}</td>
                <td>{p.title}</td>
                <td>{p.attempts}</td>
                <td>{formatPct(p.usageRate)}</td>
                <td>{formatPct(p.successRate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  )
}

interface ChartPoint {
  label: string
  value: number | null
  hint: string
}

function TrendChart({
  title,
  points,
  format,
}: {
  title: string
  points: ChartPoint[]
  format: (v: number | null) => string
}) {
  const w = 320
  const h = 120
  const padX = 8
  const padY = 12
  const plotted = points
    .map((p, i) => ({ ...p, i }))
    .filter((p) => p.value != null) as Array<ChartPoint & { i: number; value: number }>

  const coords = plotted.map((p) => {
    const x =
      points.length <= 1
        ? w / 2
        : padX + (p.i / (points.length - 1)) * (w - padX * 2)
    const y = padY + (1 - p.value) * (h - padY * 2)
    return { x, y, ...p }
  })

  const path =
    coords.length > 1
      ? coords.map((c, idx) => `${idx === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(' ')
      : ''

  return (
    <div className="trend-chart">
      <p className="trend-chart-title">{title}</p>
      <svg viewBox={`0 0 ${w} ${h}`} className="trend-svg" role="img" aria-label={title}>
        <line x1={padX} y1={h - padY} x2={w - padX} y2={h - padY} className="trend-axis" />
        <line x1={padX} y1={padY} x2={padX} y2={h - padY} className="trend-axis" />
        {path ? <path d={path} className="trend-line" fill="none" /> : null}
        {coords.map((c) => (
          <circle key={`${c.label}-${c.i}`} cx={c.x} cy={c.y} r={3.5} className="trend-dot">
            <title>
              {c.label}: {format(c.value)} ({c.hint})
            </title>
          </circle>
        ))}
      </svg>
      <div className="trend-x">
        {points.map((p) => (
          <span key={p.label + p.hint}>
            {p.label}
            <em>{format(p.value)}</em>
          </span>
        ))}
      </div>
    </div>
  )
}
