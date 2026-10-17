import { computeStats } from './stats'
import type { ActionName, Bout } from '../types'
import { ACTIONS } from '../types'

/** Effective date for trend x-axis: filmed date if set, else created day. */
export function boutTrendDate(bout: Bout): string {
  if (bout.recordedAt && /^\d{4}-\d{2}-\d{2}/.test(bout.recordedAt)) {
    return bout.recordedAt.slice(0, 10)
  }
  return bout.createdAt.slice(0, 10)
}

export function formatTrendLabel(isoDay: string): string {
  const [y, m, d] = isoDay.split('-').map(Number)
  if (!y || !m || !d) return isoDay
  const dt = new Date(Date.UTC(y, m - 1, d))
  return dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit', timeZone: 'UTC' })
}

export interface BoutTrendPoint {
  boutId: string
  title: string
  date: string
  label: string
  totalAttempts: number
  /** attempts for this action / bout total attempts */
  usageRate: number | null
  successRate: number | null
  attempts: number
}

export interface ActionTrend {
  action: ActionName
  points: BoutTrendPoint[]
  /** lifetime attempts across all bouts */
  totalAttempts: number
}

/** Chronological bouts (oldest → newest) for trend charts. */
export function sortBoutsForTrends(bouts: Bout[]): Bout[] {
  return [...bouts].sort((a, b) => {
    const da = boutTrendDate(a)
    const db = boutTrendDate(b)
    if (da !== db) return da.localeCompare(db)
    return a.createdAt.localeCompare(b.createdAt)
  })
}

export function buildActionTrends(bouts: Bout[]): ActionTrend[] {
  const ordered = sortBoutsForTrends(bouts.filter((b) => b.phrases.length > 0))
  return ACTIONS.map((action) => {
    const points: BoutTrendPoint[] = ordered.map((bout) => {
      const stats = computeStats(bout.phrases)
      const row = stats.byAction.find((r) => r.action === action)!
      const total = stats.totals.attempts
      return {
        boutId: bout.id,
        title: bout.title,
        date: boutTrendDate(bout),
        label: formatTrendLabel(boutTrendDate(bout)),
        totalAttempts: total,
        usageRate: total > 0 ? row.attempts / total : null,
        successRate: row.successRate,
        attempts: row.attempts,
      }
    })
    const totalAttempts = points.reduce((sum, p) => sum + p.attempts, 0)
    return { action, points, totalAttempts }
  }).filter((t) => t.totalAttempts > 0)
}
