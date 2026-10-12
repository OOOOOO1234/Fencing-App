import { describe, expect, it } from 'vitest'
import { computeStats, formatPct, formatTime, scoreStateOf } from './stats'
import type { Phrase } from '../types'

const phrases: Phrase[] = [
  { id: '1', timestamp: 10, action: 'Simple attack', outcome: 'point_for', scoreYou: 0, scoreThem: 0 },
  { id: '2', timestamp: 20, action: 'Simple attack', outcome: 'point_against', scoreYou: 1, scoreThem: 0 },
  { id: '3', timestamp: 30, action: 'Parry-riposte', outcome: 'point_for', scoreYou: 1, scoreThem: 1 },
  { id: '4', timestamp: 40, action: 'Counterattack', outcome: 'no_touch' },
  { id: '5', timestamp: 50, action: 'Simple attack', outcome: 'point_for', scoreYou: 0, scoreThem: 2 },
]

describe('computeStats', () => {
  it('counts attempts and outcomes per action', () => {
    const stats = computeStats(phrases)
    const simple = stats.byAction.find((row) => row.action === 'Simple attack')
    expect(simple).toMatchObject({
      attempts: 3,
      pointsFor: 2,
      pointsAgainst: 1,
      net: 1,
    })
    expect(simple?.successRate).toBeCloseTo(2 / 3)
    expect(simple?.costRate).toBeCloseTo(1 / 3)
    expect(simple?.shareOfPoints).toBeCloseTo(2 / 3)
  })

  it('rolls up bout totals', () => {
    const stats = computeStats(phrases)
    expect(stats.totals.attempts).toBe(5)
    expect(stats.totals.pointsFor).toBe(3)
    expect(stats.totals.pointsAgainst).toBe(1)
    expect(stats.totals.noTouch).toBe(1)
    expect(stats.totals.net).toBe(2)
    expect(stats.totals.successRate).toBeCloseTo(3 / 5)
  })

  it('splits by score state', () => {
    const stats = computeStats(phrases)
    expect(stats.byScoreState.tied.attempts).toBe(2)
    expect(stats.byScoreState.ahead.attempts).toBe(1)
    expect(stats.byScoreState.behind.attempts).toBe(1)
    expect(stats.byScoreState.unknown.attempts).toBe(1)
  })

  it('handles empty phrase lists', () => {
    const stats = computeStats([])
    expect(stats.totals.attempts).toBe(0)
    expect(stats.totals.successRate).toBeNull()
    expect(stats.byAction).toHaveLength(9)
  })
})

describe('format helpers', () => {
  it('formats percent and clock', () => {
    expect(formatPct(0.5)).toBe('50%')
    expect(formatPct(null)).toBe('—')
    expect(formatTime(65)).toBe('1:05')
    expect(formatTime(5)).toBe('0:05')
  })

  it('derives score state', () => {
    expect(scoreStateOf({ id: 'x', timestamp: 0, action: 'Simple attack', outcome: 'point_for', scoreYou: 3, scoreThem: 1 })).toBe('ahead')
    expect(scoreStateOf({ id: 'x', timestamp: 0, action: 'Simple attack', outcome: 'point_for' })).toBe('unknown')
  })
})
