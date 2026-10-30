import { describe, expect, it } from 'vitest'
import { findOpponentSequences, phraseIdsForSequence } from './opponentSequences'
import type { Phrase } from '../types'

function phrase(
  id: string,
  timestamp: number,
  opponentAction: Phrase['opponentAction'],
  outcome: Phrase['outcome'] = 'point_for',
): Phrase {
  return {
    id,
    timestamp,
    action: 'Simple attack',
    opponentAction,
    outcome,
  }
}

describe('findOpponentSequences', () => {
  it('finds repeated opponent chains and ranks by count', () => {
    const phrases: Phrase[] = [
      phrase('a', 1, 'Counterattack', 'point_for'),
      phrase('b', 2, 'Parry-riposte', 'point_against'),
      phrase('c', 3, 'Simple attack', 'point_for'),
      phrase('d', 4, 'Counterattack', 'no_touch'),
      phrase('e', 5, 'Parry-riposte', 'point_against'),
      phrase('f', 6, 'Beat attack', 'point_for'),
      phrase('g', 7, 'Counterattack', 'point_for'),
      phrase('h', 8, 'Parry-riposte', 'point_against'),
    ]

    const sequences = findOpponentSequences(phrases)
    const top = sequences[0]
    expect(top?.key).toBe('Counterattack → Parry-riposte')
    expect(top?.count).toBe(3)
    expect(top?.theirScoreRate).toBe(1)
    expect(top?.edge).toMatch(/break the second action|touch/i)
  })

  it('ignores phrases without opponent actions', () => {
    const phrases: Phrase[] = [
      phrase('a', 1, 'Counterattack'),
      { id: 'x', timestamp: 2, action: 'Simple attack', outcome: 'point_for' },
      phrase('b', 3, 'Parry-riposte'),
      phrase('c', 4, 'Counterattack'),
      phrase('d', 5, 'Parry-riposte'),
    ]
    const sequences = findOpponentSequences(phrases)
    expect(sequences.some((s) => s.key === 'Counterattack → Parry-riposte')).toBe(true)
  })

  it('returns empty when nothing repeats', () => {
    const phrases: Phrase[] = [
      phrase('a', 1, 'Counterattack'),
      phrase('b', 2, 'Parry-riposte'),
      phrase('c', 3, 'Simple attack'),
    ]
    expect(findOpponentSequences(phrases)).toEqual([])
  })
})

describe('phraseIdsForSequence', () => {
  it('returns ids for the selected occurrence', () => {
    const phrases: Phrase[] = [
      phrase('a', 1, 'Counterattack', 'point_for'),
      phrase('b', 2, 'Parry-riposte', 'point_against'),
      phrase('c', 3, 'Simple attack', 'point_for'),
      phrase('d', 4, 'Counterattack', 'no_touch'),
      phrase('e', 5, 'Parry-riposte', 'point_against'),
    ]
    const seq = findOpponentSequences(phrases)[0]!
    expect([...phraseIdsForSequence(seq, 0)].sort()).toEqual(['a', 'b'])
    expect([...phraseIdsForSequence(seq, 1)].sort()).toEqual(['d', 'e'])
  })
})
