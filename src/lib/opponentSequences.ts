import type { ActionName, Outcome, Phrase } from '../types'

export interface SequenceOccurrence {
  /** Phrase ids that form this run, in time order. */
  phraseIds: string[]
  startTimestamp: number
  /** Outcome of the last phrase in the run. */
  endOutcome: Outcome
}

export interface OpponentSequence {
  /** Stable key: actions joined by " → ". */
  key: string
  actions: ActionName[]
  count: number
  /** Share of runs that ended with a point against you. */
  theirScoreRate: number | null
  /** Share of runs that ended with a point for you. */
  yourScoreRate: number | null
  occurrences: SequenceOccurrence[]
  /** Short coaching note for the edge. */
  edge: string
}

function rate(numerator: number, denominator: number): number | null {
  if (denominator === 0) return null
  return numerator / denominator
}

function edgeNote(actions: ActionName[], theirScoreRate: number | null, yourScoreRate: number | null): string {
  const chain = actions.join(' → ')
  if (theirScoreRate != null && theirScoreRate >= 0.5) {
    return `They often finish “${chain}” for a touch — break the second action or take distance early.`
  }
  if (yourScoreRate != null && yourScoreRate >= 0.5) {
    return `You usually beat “${chain}” — keep the answer that closed it.`
  }
  return `Watch for “${chain}” — tag the second beat so you are ready before they land.`
}

/**
 * Find repeating opponent action sequences (length 2–3) across the bout.
 * Only phrases with `opponentAction` are considered, in timestamp order.
 */
export function findOpponentSequences(
  phrases: Phrase[],
  options?: { minCount?: number; maxLength?: number },
): OpponentSequence[] {
  const minCount = options?.minCount ?? 2
  const maxLength = options?.maxLength ?? 3

  const ordered = [...phrases]
    .filter((p) => p.opponentAction)
    .sort((a, b) => a.timestamp - b.timestamp)

  if (ordered.length < 2) return []

  type Acc = {
    actions: ActionName[]
    occurrences: SequenceOccurrence[]
  }
  const map = new Map<string, Acc>()

  for (let len = 2; len <= maxLength; len += 1) {
    if (ordered.length < len) continue
    for (let i = 0; i <= ordered.length - len; i += 1) {
      const window = ordered.slice(i, i + len)
      const actions = window.map((p) => p.opponentAction!) as ActionName[]
      const key = actions.join(' → ')
      const occurrence: SequenceOccurrence = {
        phraseIds: window.map((p) => p.id),
        startTimestamp: window[0]!.timestamp,
        endOutcome: window[len - 1]!.outcome,
      }
      const existing = map.get(key)
      if (existing) {
        existing.occurrences.push(occurrence)
      } else {
        map.set(key, { actions, occurrences: [occurrence] })
      }
    }
  }

  const sequences: OpponentSequence[] = []
  for (const [key, acc] of map) {
    if (acc.occurrences.length < minCount) continue
    const theirPoints = acc.occurrences.filter((o) => o.endOutcome === 'point_against').length
    const yourPoints = acc.occurrences.filter((o) => o.endOutcome === 'point_for').length
    const theirScoreRate = rate(theirPoints, acc.occurrences.length)
    const yourScoreRate = rate(yourPoints, acc.occurrences.length)
    sequences.push({
      key,
      actions: acc.actions,
      count: acc.occurrences.length,
      theirScoreRate,
      yourScoreRate,
      occurrences: acc.occurrences,
      edge: edgeNote(acc.actions, theirScoreRate, yourScoreRate),
    })
  }

  return sequences.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count
    if (b.actions.length !== a.actions.length) return b.actions.length - a.actions.length
    return a.key.localeCompare(b.key)
  })
}

export function phraseIdsForSequence(
  sequence: OpponentSequence | null,
  occurrenceIndex = 0,
): Set<string> {
  if (!sequence || sequence.occurrences.length === 0) return new Set()
  const idx = ((occurrenceIndex % sequence.occurrences.length) + sequence.occurrences.length) %
    sequence.occurrences.length
  return new Set(sequence.occurrences[idx]!.phraseIds)
}
