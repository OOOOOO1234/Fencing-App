import { computeStats } from './stats'
import { boutTrendDate, formatTrendLabel, sortBoutsForTrends } from './trends'
import type { Bout, BoutStats, Phrase } from '../types'

/** Case-insensitive identity for a named opponent. Collapses inner whitespace. */
export function opponentKey(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase()
}

export function displayOpponentName(name: string): string {
  return name.trim().replace(/\s+/g, ' ')
}

export function isSameOpponent(a: string, b: string): boolean {
  const ka = opponentKey(a)
  const kb = opponentKey(b)
  return ka.length > 0 && ka === kb
}

/** Prefer an existing stored spelling so "alex" and "Alex" stay one person. */
export function resolveOpponentName(input: string, existingNames: readonly string[]): string {
  const display = displayOpponentName(input)
  if (!display) return ''
  const key = opponentKey(display)
  const match = existingNames.find((name) => opponentKey(name) === key)
  return match ? displayOpponentName(match) : display
}

export function namedBouts(bouts: readonly Bout[]): Bout[] {
  return bouts.filter((b) => b.opponentName && opponentKey(b.opponentName).length > 0)
}

export function boutsForOpponent(bouts: readonly Bout[], name: string): Bout[] {
  return namedBouts(bouts).filter((b) => isSameOpponent(b.opponentName!, name))
}

export interface KnownOpponent {
  key: string
  name: string
  boutCount: number
}

/** Unique opponents, canonical name = most recently used spelling. */
export function listKnownOpponents(bouts: readonly Bout[]): KnownOpponent[] {
  const byKey = new Map<string, { name: string; boutCount: number; updated: string }>()
  for (const bout of namedBouts(bouts)) {
    const name = displayOpponentName(bout.opponentName!)
    const key = opponentKey(name)
    const updated = bout.updatedAt ?? bout.createdAt
    const prev = byKey.get(key)
    if (!prev) {
      byKey.set(key, { name, boutCount: 1, updated })
      continue
    }
    prev.boutCount += 1
    if (updated >= prev.updated) {
      prev.name = name
      prev.updated = updated
    }
  }
  return [...byKey.values()]
    .map(({ name, boutCount }) => ({ key: opponentKey(name), name, boutCount }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

export function filterOpponentSuggestions(
  opponents: readonly KnownOpponent[],
  query: string,
): KnownOpponent[] {
  const q = opponentKey(query)
  if (!q) return [...opponents]
  return opponents.filter((o) => o.key.includes(q))
}

export interface BoutScore {
  you: number
  them: number
}

/** Bout score from phrase awards (doubles count for both). */
export function boutScore(bout: Bout): BoutScore {
  let you = 0
  let them = 0
  for (const phrase of bout.phrases) {
    if (phrase.outcome === 'point_for' || phrase.outcome === 'double') you += 1
    if (phrase.outcome === 'point_against' || phrase.outcome === 'double') them += 1
  }
  return { you, them }
}

export type BoutResult = 'W' | 'L' | 'D' | null

export function boutResult(score: BoutScore): BoutResult {
  if (score.you === 0 && score.them === 0) return null
  if (score.you > score.them) return 'W'
  if (score.you < score.them) return 'L'
  return 'D'
}

export function formatBoutScore(score: BoutScore): string {
  return `${score.you}–${score.them}`
}

export interface OpponentRecord {
  wins: number
  losses: number
  draws: number
  bouts: number
  touchesFor: number
  touchesAgainst: number
  differential: number
}

export function opponentRecord(bouts: readonly Bout[]): OpponentRecord {
  let wins = 0
  let losses = 0
  let draws = 0
  let touchesFor = 0
  let touchesAgainst = 0
  for (const bout of bouts) {
    const score = boutScore(bout)
    touchesFor += score.you
    touchesAgainst += score.them
    const result = boutResult(score)
    if (result === 'W') wins += 1
    else if (result === 'L') losses += 1
    else if (result === 'D') draws += 1
  }
  return {
    wins,
    losses,
    draws,
    bouts: bouts.length,
    touchesFor,
    touchesAgainst,
    differential: touchesFor - touchesAgainst,
  }
}

export interface OpponentBoutRow {
  bout: Bout
  date: string
  label: string
  score: BoutScore
  result: BoutResult
  phrases: Phrase[]
}

export interface OpponentTrendPoint {
  boutId: string
  date: string
  label: string
  result: BoutResult
  net: number
  cumulativeWinRate: number | null
}

export interface OpponentProfile {
  name: string
  bouts: OpponentBoutRow[]
  record: OpponentRecord
  stats: BoutStats
  youByAction: BoutStats['byAction']
  themWhenYouWin: BoutStats['opponentSituation']['whenYouWin']
  themWhenYouLose: BoutStats['opponentSituation']['whenYouLose']
  themSuccess: BoutStats['opponentSituation']['opponentSuccess']
  trend: OpponentTrendPoint[]
}

export function buildOpponentProfile(allBouts: readonly Bout[], name: string): OpponentProfile | null {
  const display = displayOpponentName(name)
  if (!display) return null
  const matched = sortBoutsForTrends(boutsForOpponent(allBouts, display))
  const phrases = matched.flatMap((b) => b.phrases)
  const stats = computeStats(phrases)
  const record = opponentRecord(matched)

  let winsSoFar = 0
  let decided = 0
  const trend: OpponentTrendPoint[] = matched.map((bout) => {
    const score = boutScore(bout)
    const result = boutResult(score)
    if (result === 'W' || result === 'L') {
      decided += 1
      if (result === 'W') winsSoFar += 1
    }
    const date = boutTrendDate(bout)
    return {
      boutId: bout.id,
      date,
      label: formatTrendLabel(date),
      result,
      net: score.you - score.them,
      cumulativeWinRate: decided > 0 ? winsSoFar / decided : null,
    }
  })

  const canonical =
    listKnownOpponents(matched)[0]?.name ?? display

  return {
    name: canonical,
    bouts: [...matched].reverse().map((bout) => {
      const date = boutTrendDate(bout)
      const score = boutScore(bout)
      return {
        bout,
        date,
        label: formatTrendLabel(date),
        score,
        result: boutResult(score),
        phrases: bout.phrases,
      }
    }),
    record,
    stats,
    youByAction: stats.byAction.filter((row) => row.attempts > 0),
    themWhenYouWin: stats.opponentSituation.whenYouWin,
    themWhenYouLose: stats.opponentSituation.whenYouLose,
    themSuccess: stats.opponentSituation.opponentSuccess,
    trend,
  }
}

export function defaultBoutTitle(opponentName: string, hasVideo: boolean, fileName?: string): string {
  if (hasVideo && fileName) {
    return fileName.replace(/\.[^.]+$/, '') || fileName
  }
  return `vs ${displayOpponentName(opponentName)}`
}
