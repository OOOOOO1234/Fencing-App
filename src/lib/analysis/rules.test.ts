import { describe, expect, it } from 'vitest'
import { applyPhraseRules, outcomeFromGesture } from './rules'
import type { Phrase } from '../../types'

describe('outcomeFromGesture', () => {
  it('maps hand awards', () => {
    expect(outcomeFromGesture('hand_you', 'left')).toBe('point_for')
    expect(outcomeFromGesture('hand_them', 'right')).toBe('point_against')
    expect(outcomeFromGesture('simultaneous', 'left')).toBe('no_touch')
    expect(outcomeFromGesture('unknown', 'left')).toBeNull()
  })
})

describe('applyPhraseRules', () => {
  it('overrides outcome from clear hands', () => {
    const phrases: Phrase[] = [
      {
        id: '1',
        timestamp: 1,
        action: 'Simple attack',
        outcome: 'point_against',
        refGesture: 'hand_you',
      },
    ]
    const next = applyPhraseRules(phrases, 'left')
    expect(next[0]?.outcome).toBe('point_for')
    expect(next[0]?.sources).toContain('hands')
  })

  it('flags renewal vs riposte contradiction', () => {
    const phrases: Phrase[] = [
      {
        id: '2',
        timestamp: 2,
        action: 'Remise',
        opponentAction: 'Parry-riposte',
        outcome: 'point_against',
        refGesture: 'hand_them',
      },
    ]
    const next = applyPhraseRules(phrases, 'left')
    expect(next[0]?.needsReview).toBe(true)
  })
})
