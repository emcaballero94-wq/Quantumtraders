import { describe, it, expect } from 'vitest'
import { compareToSnapshot } from './day-over-day'
import type { GexSnapshotRecord } from '@/lib/gex/snapshot-persistence'

function snapshot(overrides: Partial<GexSnapshotRecord>): GexSnapshotRecord {
  return {
    id: 'test-id',
    assetClass: 'equity',
    symbol: 'SPY',
    snapshotDate: '2026-09-30',
    underlyingPrice: 450,
    netGex: -1_000_000,
    callWallStrike: 460,
    putWallStrike: 440,
    gammaFlip: 455,
    matrix: { underlyingPrice: 450, expirations: [], aggregate: { profile: [], netGex: -1_000_000, callWallStrike: 460, putWallStrike: 440, gammaFlip: 455 } },
    capturedAt: '2026-09-30T21:30:00Z',
    ...overrides,
  }
}

describe('compareToSnapshot', () => {
  it('flags a flip from negative to positive regime', () => {
    const comparison = compareToSnapshot({ netGex: 2_000_000, callWallStrike: 465, putWallStrike: 445 }, snapshot({ netGex: -1_000_000 }))
    expect(comparison.regimeShift).toBe('FLIPPED_TO_POSITIVE')
  })

  it('flags a flip from positive to negative regime', () => {
    const comparison = compareToSnapshot({ netGex: -500_000, callWallStrike: 465, putWallStrike: 445 }, snapshot({ netGex: 1_000_000 }))
    expect(comparison.regimeShift).toBe('FLIPPED_TO_NEGATIVE')
  })

  it('reports unchanged regime when both sides keep the same sign', () => {
    const comparison = compareToSnapshot({ netGex: -2_000_000, callWallStrike: 460, putWallStrike: 440 }, snapshot({ netGex: -1_000_000 }))
    expect(comparison.regimeShift).toBe('UNCHANGED_NEGATIVE')
  })

  it('computes strike deltas and percent change relative to the prior session', () => {
    const comparison = compareToSnapshot(
      { netGex: -1_500_000, callWallStrike: 465, putWallStrike: 435 },
      snapshot({ netGex: -1_000_000, callWallStrike: 460, putWallStrike: 440 }),
    )
    expect(comparison.callWallDeltaStrikes).toBe(5)
    expect(comparison.putWallDeltaStrikes).toBe(-5)
    expect(comparison.netGexChangePct).toBeCloseTo(-50, 6)
  })

  it('returns null strike deltas when either side has no wall', () => {
    const comparison = compareToSnapshot({ netGex: 100, callWallStrike: null, putWallStrike: 440 }, snapshot({ callWallStrike: 460 }))
    expect(comparison.callWallDeltaStrikes).toBeNull()
  })
})
