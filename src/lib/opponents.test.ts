import { describe, expect, it } from 'vitest'
import type { Bout, Phrase } from '../types'
import {
  boutResult,
  boutScore,
  buildOpponentProfile,
  filterOpponentSuggestions,
  isSameOpponent,
  listKnownOpponents,
  opponentKey,
  resolveOpponentName,
} from './opponents'

function phrase(partial: Partial<Phrase> & Pick<Phrase, 'id' | 'outcome'>): Phrase {
  return {
    timestamp: 0,
    action: 'Simple attack',
    ...partial,
  }
}

function bout(partial: Partial<Bout> & Pick<Bout, 'id'>): Bout {
  return {
    title: 'Bout',
    side: 'left',
    createdAt: '2026-10-01T00:00:00.000Z',
    hasVideo: false,
    phrases: [],
    ...partial,
  }
}

describe('opponent identity', () => {
  it('treats names as the same person case-insensitively', () => {
    expect(opponentKey('  Alex  Kim ')).toBe('alex kim')
    expect(isSameOpponent('Alex Kim', 'alex kim')).toBe(true)
    expect(isSameOpponent('Alex', 'Alexa')).toBe(false)
  })

  it('reuses the existing spelling instead of splitting duplicates', () => {
    expect(resolveOpponentName('alex kim', ['Alex Kim', 'Jordan'])).toBe('Alex Kim')
    expect(resolveOpponentName('  New Name ', ['Alex Kim'])).toBe('New Name')
    expect(resolveOpponentName('   ', ['Alex'])).toBe('')
  })

  it('lists unique opponents from mixed-case bouts', () => {
    const known = listKnownOpponents([
      bout({ id: '1', opponentName: 'alex kim', createdAt: '2026-10-01T00:00:00.000Z' }),
      bout({ id: '2', opponentName: 'Alex Kim', createdAt: '2026-10-08T00:00:00.000Z' }),
      bout({ id: '3', opponentName: 'Jordan', createdAt: '2026-10-09T00:00:00.000Z' }),
      bout({ id: '4' }),
    ])
    expect(known).toEqual([
      { key: 'alex kim', name: 'Alex Kim', boutCount: 2 },
      { key: 'jordan', name: 'Jordan', boutCount: 1 },
    ])
  })

  it('filters suggestions by substring', () => {
    const list = listKnownOpponents([
      bout({ id: '1', opponentName: 'Alex Kim' }),
      bout({ id: '2', opponentName: 'Jordan Lee' }),
    ])
    expect(filterOpponentSuggestions(list, 'kim').map((o) => o.name)).toEqual(['Alex Kim'])
    expect(filterOpponentSuggestions(list, '').map((o) => o.name)).toEqual(['Alex Kim', 'Jordan Lee'])
  })
})

describe('bout score and profile', () => {
  it('counts doubles for both fencers', () => {
    const score = boutScore(
      bout({
        id: '1',
        phrases: [
          phrase({ id: 'a', outcome: 'point_for' }),
          phrase({ id: 'b', outcome: 'point_against' }),
          phrase({ id: 'c', outcome: 'double' }),
          phrase({ id: 'd', outcome: 'no_touch' }),
        ],
      }),
    )
    expect(score).toEqual({ you: 2, them: 2 })
    expect(boutResult(score)).toBe('D')
    expect(boutResult({ you: 0, them: 0 })).toBeNull()
  })

  it('builds W/L, differential, action tallies, and win-rate trend', () => {
    const bouts: Bout[] = [
      bout({
        id: 'early',
        opponentName: 'Alex',
        createdAt: '2026-10-01T00:00:00.000Z',
        recordedAt: '2026-10-01',
        phrases: [
          phrase({
            id: '1',
            action: 'Simple attack',
            opponentAction: 'Counterattack',
            outcome: 'point_for',
          }),
          phrase({
            id: '2',
            action: 'Simple attack',
            opponentAction: 'Parry-riposte',
            outcome: 'point_against',
          }),
        ],
      }),
      bout({
        id: 'late',
        opponentName: 'ALEX',
        createdAt: '2026-10-10T00:00:00.000Z',
        recordedAt: '2026-10-10',
        phrases: [
          phrase({
            id: '3',
            action: 'Parry-riposte',
            opponentAction: 'Simple attack',
            outcome: 'point_for',
          }),
          phrase({
            id: '4',
            action: 'Parry-riposte',
            opponentAction: 'Simple attack',
            outcome: 'point_for',
          }),
        ],
      }),
    ]

    const profile = buildOpponentProfile(bouts, 'alex')
    expect(profile).not.toBeNull()
    expect(profile!.record).toMatchObject({
      wins: 1,
      losses: 0,
      draws: 1,
      bouts: 2,
      touchesFor: 3,
      touchesAgainst: 1,
      differential: 2,
    })
    expect(profile!.bouts.map((row) => row.bout.id)).toEqual(['late', 'early'])
    expect(profile!.youByAction.find((r) => r.action === 'Parry-riposte')?.pointsFor).toBe(2)
    expect(profile!.themWhenYouLose.byAction[0]?.action).toBe('Parry-riposte')
    expect(profile!.trend.map((p) => p.cumulativeWinRate)).toEqual([null, 1])
  })

  it('returns null for a blank name', () => {
    expect(buildOpponentProfile([], '  ')).toBeNull()
  })
})
