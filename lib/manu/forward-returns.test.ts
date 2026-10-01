import { describe, expect, it } from 'vitest'
import { computeForwardOutcome, type PricePoint } from './forward-returns'

function point(createdAt: string, price: number | null): PricePoint {
  return { createdAt, price }
}

describe('computeForwardOutcome', () => {
  it('returns nulls when the horizon has not been reached yet', () => {
    const records = [point('2026-01-01T00:00:00Z', 100), point('2026-01-01T00:03:00Z', 105)]
    const outcome = computeForwardOutcome(records, 0, 15 * 60_000)
    expect(outcome.forwardReturnPct).toBeNull()
    expect(outcome.maxFavorableExcursionPct).toBeNull()
    expect(outcome.maxAdverseExcursionPct).toBeNull()
  })

  it('returns nulls when the origin price is missing (ausencia de datos)', () => {
    const records = [point('2026-01-01T00:00:00Z', null), point('2026-01-01T00:15:00Z', 105)]
    const outcome = computeForwardOutcome(records, 0, 15 * 60_000)
    expect(outcome.forwardReturnPct).toBeNull()
  })

  it('computes the forward return at the nearest record at-or-after the horizon', () => {
    const records = [point('2026-01-01T00:00:00Z', 100), point('2026-01-01T00:14:00Z', 108), point('2026-01-01T00:16:00Z', 110)]
    const outcome = computeForwardOutcome(records, 0, 15 * 60_000)
    expect(outcome.forwardReturnPct).toBeCloseTo(10, 5)
  })

  it('tracks the best and worst excursion along the path to the horizon', () => {
    const records = [
      point('2026-01-01T00:00:00Z', 100),
      point('2026-01-01T00:05:00Z', 90), // -10% dip along the way
      point('2026-01-01T00:10:00Z', 112), // +12% peak along the way
      point('2026-01-01T00:15:00Z', 105), // settles at +5% by the horizon
    ]
    const outcome = computeForwardOutcome(records, 0, 15 * 60_000)
    expect(outcome.forwardReturnPct).toBeCloseTo(5, 5)
    expect(outcome.maxFavorableExcursionPct).toBeCloseTo(12, 5)
    expect(outcome.maxAdverseExcursionPct).toBeCloseTo(-10, 5)
  })
})
