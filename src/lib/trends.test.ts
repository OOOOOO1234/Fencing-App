import { describe, expect, it } from 'vitest'
import { boutTrendDate, buildActionTrends, sortBoutsForTrends } from './trends'
import type { Bout } from '../types'

function bout(partial: Partial<Bout> & Pick<Bout, 'id' | 'title' | 'createdAt'>): Bout {
  return {
    side: 'left',
    hasVideo: false,
    phrases: [],
    ...partial,
  }
}

describe('trends', () => {
  it('prefers recordedAt over createdAt for the axis date', () => {
    const b = bout({
      id: '1',
      title: 'A',
      createdAt: '2026-10-15T12:00:00.000Z',
      recordedAt: '2026-09-01',
    })
    expect(boutTrendDate(b)).toBe('2026-09-01')
  })

  it('falls back to created day when recordedAt missing', () => {
    const b = bout({
      id: '1',
      title: 'A',
      createdAt: '2026-10-15T12:00:00.000Z',
    })
    expect(boutTrendDate(b)).toBe('2026-10-15')
  })

  it('builds usage and success series chronologically', () => {
    const bouts: Bout[] = [
      bout({
        id: 'b2',
        title: 'Later',
        createdAt: '2026-10-10T00:00:00.000Z',
        recordedAt: '2026-10-10',
        phrases: [
          { id: '1', timestamp: 1, action: 'Simple attack', outcome: 'point_for' },
          { id: '2', timestamp: 2, action: 'Simple attack', outcome: 'point_against' },
        ],
      }),
      bout({
        id: 'b1',
        title: 'Earlier',
        createdAt: '2026-10-01T00:00:00.000Z',
        recordedAt: '2026-10-01',
        phrases: [
          { id: '3', timestamp: 1, action: 'Simple attack', outcome: 'point_for' },
          { id: '4', timestamp: 2, action: 'Parry-riposte', outcome: 'point_for' },
        ],
      }),
    ]
    const ordered = sortBoutsForTrends(bouts)
    expect(ordered.map((b) => b.id)).toEqual(['b1', 'b2'])

    const trends = buildActionTrends(bouts)
    const simple = trends.find((t) => t.action === 'Simple attack')
    expect(simple?.points).toHaveLength(2)
    expect(simple?.points[0]?.usageRate).toBeCloseTo(0.5)
    expect(simple?.points[0]?.successRate).toBeCloseTo(1)
    expect(simple?.points[1]?.usageRate).toBeCloseTo(1)
    expect(simple?.points[1]?.successRate).toBeCloseTo(0.5)
  })
})
