import { formatPct } from '../lib/stats'

export interface BarItem {
  label: string
  value: number | null
  /** Absolute count shown beside the bar (optional). */
  count?: number
  hint?: string
}

/** Horizontal share / rate bars — chart-first Moneyball building block. */
export function BarChart({
  title,
  items,
  empty,
  tone = 'accent',
}: {
  title: string
  items: BarItem[]
  empty?: string
  tone?: 'accent' | 'for' | 'against'
}) {
  const shown = items.filter((i) => (i.count ?? 0) > 0 || (i.value != null && i.value > 0))
  if (shown.length === 0) {
    return (
      <div className="chart-block">
        <h3 className="chart-title">{title}</h3>
        <p className="chart-empty">{empty ?? 'No data yet'}</p>
      </div>
    )
  }

  const max = Math.max(
    ...shown.map((i) => i.value ?? 0),
    0.01,
  )

  return (
    <div className={`chart-block tone-${tone}`}>
      <h3 className="chart-title">{title}</h3>
      <ul className="bar-list" aria-label={title}>
        {shown.map((item) => {
          const pct = item.value == null ? 0 : (item.value / max) * 100
          return (
            <li key={item.label}>
              <div className="bar-meta">
                <span className="bar-label">{item.label}</span>
                <span className="bar-value">
                  {formatPct(item.value)}
                  {item.count != null ? <em> · {item.count}</em> : null}
                </span>
              </div>
              <div className="bar-track" title={item.hint}>
                <div className="bar-fill" style={{ width: `${pct}%` }} />
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export interface SparkPoint {
  label: string
  value: number | null
  hint: string
}

/** Compact line chart for History trends. */
export function SparkLine({
  title,
  points,
  format = formatPct,
}: {
  title: string
  points: SparkPoint[]
  format?: (v: number | null) => string
}) {
  const w = 320
  const h = 100
  const padX = 6
  const padY = 10
  const plotted = points
    .map((p, i) => ({ ...p, i }))
    .filter((p) => p.value != null) as Array<SparkPoint & { i: number; value: number }>

  const coords = plotted.map((p) => {
    const x =
      points.length <= 1 ? w / 2 : padX + (p.i / (points.length - 1)) * (w - padX * 2)
    const y = padY + (1 - p.value) * (h - padY * 2)
    return { x, y, ...p }
  })

  const path =
    coords.length > 1
      ? coords.map((c, idx) => `${idx === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(' ')
      : ''

  return (
    <div className="spark">
      <p className="chart-title">{title}</p>
      <svg viewBox={`0 0 ${w} ${h}`} className="spark-svg" role="img" aria-label={title}>
        <line x1={padX} y1={h - padY} x2={w - padX} y2={h - padY} className="spark-axis" />
        {path ? <path d={path} className="spark-line" fill="none" /> : null}
        {coords.map((c) => (
          <circle key={`${c.label}-${c.i}`} cx={c.x} cy={c.y} r={3.25} className="spark-dot">
            <title>
              {c.label}: {format(c.value)} ({c.hint})
            </title>
          </circle>
        ))}
      </svg>
      <div className="spark-x">
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
