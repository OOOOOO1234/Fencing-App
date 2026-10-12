import type { ActionName, ActionStats, BoutStats, Phrase } from '../types'
import { ACTIONS } from '../types'

function rate(numerator: number, denominator: number): number | null {
  if (denominator === 0) return null
  return numerator / denominator
}

export function computeStats(phrases: Phrase[]): BoutStats {
  const byAction: ActionStats[] = ACTIONS.map((action) => {
    const rows = phrases.filter((p) => p.action === action)
    const pointsFor = rows.filter((p) => p.outcome === 'point_for').length
    const pointsAgainst = rows.filter((p) => p.outcome === 'point_against').length
    const doubles = rows.filter((p) => p.outcome === 'double').length
    const noTouch = rows.filter((p) => p.outcome === 'no_touch').length
    const attempts = rows.length

    return {
      action,
      attempts,
      pointsFor,
      pointsAgainst,
      doubles,
      noTouch,
      successRate: rate(pointsFor, attempts),
      costRate: rate(pointsAgainst, attempts),
      net: pointsFor - pointsAgainst,
      shareOfPoints: null,
    }
  })

  const totalPointsFor = byAction.reduce((sum, row) => sum + row.pointsFor, 0)

  for (const row of byAction) {
    row.shareOfPoints = rate(row.pointsFor, totalPointsFor)
  }

  const totals = {
    attempts: phrases.length,
    pointsFor: totalPointsFor,
    pointsAgainst: byAction.reduce((sum, row) => sum + row.pointsAgainst, 0),
    doubles: byAction.reduce((sum, row) => sum + row.doubles, 0),
    noTouch: byAction.reduce((sum, row) => sum + row.noTouch, 0),
    successRate: null as number | null,
    costRate: null as number | null,
    net: 0,
  }
  totals.successRate = rate(totals.pointsFor, totals.attempts)
  totals.costRate = rate(totals.pointsAgainst, totals.attempts)
  totals.net = totals.pointsFor - totals.pointsAgainst

  return { byAction, totals }
}

export function formatPct(value: number | null): string {
  if (value === null) return '—'
  return `${Math.round(value * 100)}%`
}

export function formatTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds))
  const m = Math.floor(s / 60)
  const rem = s % 60
  return `${m}:${rem.toString().padStart(2, '0')}`
}

/** Actions that have at least one attempt, plus empty rows if nothing tagged yet. */
export function statsForDisplay(stats: BoutStats): ActionStats[] {
  const used = stats.byAction.filter((row) => row.attempts > 0)
  return used.length > 0 ? used : stats.byAction
}

export function isActionName(value: string): value is ActionName {
  return (ACTIONS as readonly string[]).includes(value)
}
