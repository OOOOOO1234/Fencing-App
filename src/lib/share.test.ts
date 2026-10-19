import { describe, expect, it } from 'vitest'
import { decodeSharePayload, encodeSharePayload } from './share'
import type { Bout } from '../types'

describe('share payload', () => {
  it('round-trips a bout without video', () => {
    const bout: Bout = {
      id: 'abc',
      title: 'Pool bout',
      side: 'right',
      createdAt: '2026-01-01T00:00:00.000Z',
      hasVideo: true,
      phrases: [
        {
          id: 'p1',
          timestamp: 12,
          action: 'Simple attack',
          outcome: 'point_for',
        },
      ],
    }
    const encoded = encodeSharePayload(bout)
    const decoded = decodeSharePayload(encoded)
    expect(decoded?.title).toBe('Pool bout')
    expect(decoded?.hasVideo).toBe(false)
    expect(decoded?.phrases).toHaveLength(1)
  })
})
