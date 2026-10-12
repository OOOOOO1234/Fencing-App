import { computeStats, formatPct, statsForDisplay } from '../lib/stats'
import type { Phrase } from '../types'

interface StatsTableProps {
  phrases: Phrase[]
}

export function StatsTable({ phrases }: StatsTableProps) {
  const stats = computeStats(phrases)
  const rows = statsForDisplay(stats)

  return (
    <section className="stats-panel" aria-labelledby="stats-heading">
      <div className="section-head">
        <h2 id="stats-heading">Moneyball stats</h2>
        <p className="muted">
          Attempt / success / fail from your phrase tags. Point for = worked; point against =
          failed.
        </p>
      </div>

      <div className="totals-strip" role="group" aria-label="Bout totals">
        <div>
          <span className="stat-label">Attempts</span>
          <strong>{stats.totals.attempts}</strong>
        </div>
        <div>
          <span className="stat-label">Success</span>
          <strong>{formatPct(stats.totals.successRate)}</strong>
        </div>
        <div>
          <span className="stat-label">Cost</span>
          <strong>{formatPct(stats.totals.costRate)}</strong>
        </div>
        <div>
          <span className="stat-label">Net</span>
          <strong className={stats.totals.net >= 0 ? 'net-pos' : 'net-neg'}>
            {stats.totals.net > 0 ? `+${stats.totals.net}` : stats.totals.net}
          </strong>
        </div>
      </div>

      <div className="table-wrap">
        <table className="stats-table">
          <thead>
            <tr>
              <th scope="col">Action</th>
              <th scope="col">Try</th>
              <th scope="col">For</th>
              <th scope="col">Against</th>
              <th scope="col">Success</th>
              <th scope="col">Cost</th>
              <th scope="col">Net</th>
              <th scope="col">Share</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.action} className={row.attempts === 0 ? 'empty-row' : undefined}>
                <th scope="row">{row.action}</th>
                <td>{row.attempts}</td>
                <td>{row.pointsFor}</td>
                <td>{row.pointsAgainst}</td>
                <td>{formatPct(row.successRate)}</td>
                <td>{formatPct(row.costRate)}</td>
                <td className={row.net > 0 ? 'net-pos' : row.net < 0 ? 'net-neg' : undefined}>
                  {row.net > 0 ? `+${row.net}` : row.net}
                </td>
                <td>{formatPct(row.shareOfPoints)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
