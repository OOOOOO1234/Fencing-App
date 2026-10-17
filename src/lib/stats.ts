import type {
  ActionName,
  ActionStats,
  BoutStats,
  OpponentActionShare,
  OpponentSituationStats,
  Phrase,
  ScoreState,
} from '../types'
import { ACTIONS } from '../types'

function rate(numerator: number, denominator: number): number | null {
  if (denominator === 0) return null
  return numerator / denominator
}

function opponentShares(phrases: Phrase[]): OpponentActionShare[] {
  const withOpp = phrases.filter((p) => p.opponentAction)
  const total = withOpp.length
  return ACTIONS.map((action) => {
    const count = withOpp.filter((p) => p.opponentAction === action).length
    return {
      action,
      count,
      share: rate(count, total),
    }
  }).filter((row) => row.count > 0)
}

export function computeOpponentSituation(phrases: Phrase[]): OpponentSituationStats {
  const whenYouWin = phrases.filter((p) => p.outcome === 'point_for')
  const whenYouLose = phrases.filter((p) => p.outcome === 'point_against')
  const decisive = phrases.filter(
    (p) =>
      (p.outcome === 'point_for' || p.outcome === 'point_against') && p.opponentAction,
  )

  const opponentSuccess = ACTIONS.map((action) => {
    const rows = decisive.filter((p) => p.opponentAction === action)
    const theirPoints = rows.filter((p) => p.outcome === 'point_against').length
    const yourPoints = rows.filter((p) => p.outcome === 'point_for').length
    return {
      action,
      attempts: rows.length,
      theirPoints,
      yourPoints,
      theirSuccessRate: rate(theirPoints, rows.length),
    }
  }).filter((row) => row.attempts > 0)

  return {
    whenYouWin: {
      phrases: whenYouWin.length,
      byAction: opponentShares(whenYouWin),
    },
    whenYouLose: {
      phrases: whenYouLose.length,
      byAction: opponentShares(whenYouLose),
    },
    opponentSuccess,
  }
}

function emptyTotals(): BoutStats['totals'] {
  return {
    attempts: 0,
    pointsFor: 0,
    pointsAgainst: 0,
    doubles: 0,
    noTouch: 0,
    successRate: null,
    costRate: null,
    net: 0,
  }
}

function finalizeTotals(totals: BoutStats['totals']): BoutStats['totals'] {
  totals.successRate = rate(totals.pointsFor, totals.attempts)
  totals.costRate = rate(totals.pointsAgainst, totals.attempts)
  totals.net = totals.pointsFor - totals.pointsAgainst
  return totals
}

function accumulate(phrases: Phrase[]): BoutStats['totals'] {
  const totals = emptyTotals()
  totals.attempts = phrases.length
  totals.pointsFor = phrases.filter((p) => p.outcome === 'point_for').length
  totals.pointsAgainst = phrases.filter((p) => p.outcome === 'point_against').length
  totals.doubles = phrases.filter((p) => p.outcome === 'double').length
  totals.noTouch = phrases.filter((p) => p.outcome === 'no_touch').length
  return finalizeTotals(totals)
}

export function scoreStateOf(phrase: Phrase): ScoreState {
  if (phrase.scoreYou === undefined || phrase.scoreThem === undefined) return 'unknown'
  if (phrase.scoreYou > phrase.scoreThem) return 'ahead'
  if (phrase.scoreYou < phrase.scoreThem) return 'behind'
  return 'tied'
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

  const byScoreState: BoutStats['byScoreState'] = {
    ahead: accumulate(phrases.filter((p) => scoreStateOf(p) === 'ahead')),
    tied: accumulate(phrases.filter((p) => scoreStateOf(p) === 'tied')),
    behind: accumulate(phrases.filter((p) => scoreStateOf(p) === 'behind')),
    unknown: accumulate(phrases.filter((p) => scoreStateOf(p) === 'unknown')),
  }

  return {
    byAction,
    totals: accumulate(phrases),
    byScoreState,
    opponentSituation: computeOpponentSituation(phrases),
  }
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

export function parseClock(value: string): number {
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
