import { describe, it, expect } from 'vitest'
import { computeGexMatrix } from './matrix'
import type { GexContract } from './compute'

// gamma = 0.0001 makes contractGex = gamma * oi * 100 * spot = oi when spot = 100,
// so expected GEX values are exactly the open interest figures below — easy to
// hand-verify the aggregate is a strike-by-strike sum across expirations.
function contract(strike: number, optionType: 'call' | 'put', openInterest: number): GexContract {
  return { strike, optionType, openInterest, gamma: 0.0001, iv: null, last: null }
}

describe('computeGexMatrix', () => {
  it('aggregates net GEX per expiration into a single sum', () => {
    const matrix = computeGexMatrix(
      [
        { expiration: '2026-10-02', yearsToExpiry: 0.01, contracts: [contract(100, 'call', 10)] },
        { expiration: '2026-10-09', yearsToExpiry: 0.02, contracts: [contract(100, 'call', 5)] },
      ],
      100,
    )

    expect(matrix.expirations).toHaveLength(2)
    expect(matrix.expirations[0].result.netGex).toBeCloseTo(10, 6)
    expect(matrix.expirations[1].result.netGex).toBeCloseTo(5, 6)
    expect(matrix.aggregate.netGex).toBeCloseTo(15, 6)
  })

  it('merges the same strike across expirations before finding walls', () => {
    const matrix = computeGexMatrix(
      [
        { expiration: '2026-10-02', yearsToExpiry: 0.01, contracts: [contract(100, 'call', 10), contract(110, 'call', 3)] },
        { expiration: '2026-10-09', yearsToExpiry: 0.02, contracts: [contract(100, 'call', 10)] },
      ],
      100,
    )

    // Strike 100 accumulates 10 + 10 = 20 across both expirations, strictly
    // more than strike 110's 3 — the aggregate call wall must reflect the
    // merged total, not just whichever expiration's own wall is largest.
    const strike100 = matrix.aggregate.profile.find((p) => p.strike === 100)
    expect(strike100?.callGex).toBeCloseTo(20, 6)
    expect(matrix.aggregate.callWallStrike).toBe(100)
  })

  it('computes the gamma flip from the merged profile, not any single expiration', () => {
    const matrix = computeGexMatrix(
      [
        { expiration: '2026-10-02', yearsToExpiry: 0.01, contracts: [contract(90, 'put', 10), contract(100, 'call', 5)] },
        { expiration: '2026-10-09', yearsToExpiry: 0.02, contracts: [contract(110, 'call', 20)] },
      ],
      100,
    )

    // Merged profile cumulative by strike: 90 -> -10, 100 -> -5, 110 -> +15 —
    // a real sign change between 100 and 110, even though neither expiration
    // alone spans more than two strikes.
    expect(matrix.aggregate.gammaFlip).not.toBeNull()
    expect(matrix.aggregate.gammaFlip as number).toBeGreaterThan(100)
    expect(matrix.aggregate.gammaFlip as number).toBeLessThan(110)
  })

  it('returns an empty aggregate profile for no expirations', () => {
    const matrix = computeGexMatrix([], 100)
    expect(matrix.expirations).toHaveLength(0)
    expect(matrix.aggregate.profile).toHaveLength(0)
    expect(matrix.aggregate.netGex).toBe(0)
    expect(matrix.aggregate.callWallStrike).toBeNull()
    expect(matrix.aggregate.gammaFlip).toBeNull()
  })
})
