import { describe, expect, it } from 'vitest'
import { classifyChange, classifyMarketChanges, deltaBetween } from './change-detection'
import type { OrderFlowBriefRecord } from '@/lib/oracle/orderflow-persistence'

function record(overrides: Partial<OrderFlowBriefRecord>): OrderFlowBriefRecord {
  return {
    id: 'x',
    symbol: 'BTCUSDT',
    briefText: '',
    price: null,
    cvd: null,
    fundingRate: null,
    openInterest: null,
    bookImbalance: null,
    liquidationLongNotional: null,
    liquidationShortNotional: null,
    cvdSessionStartedAt: null,
    liquidationsSessionStartedAt: null,
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

describe('deltaBetween', () => {
  it('returns null when either side is missing (ausencia de datos)', () => {
    expect(deltaBetween(null, 5)).toBeNull()
    expect(deltaBetween(5, null)).toBeNull()
    expect(deltaBetween(undefined, 5)).toBeNull()
  })

  it('computes a plain difference otherwise', () => {
    expect(deltaBetween(1.2, 3.8)).toBeCloseTo(2.6)
  })
})

describe('classifyChange', () => {
  it('is UNCHANGED when both deltas are within the noise floor', () => {
    expect(classifyChange(0.01, 0.01, 0.05)).toBe('UNCHANGED')
  })

  it('matches the spec example: 1.2 -> 3.8 is ACCELERATING', () => {
    expect(classifyChange(1.2, 3.8, 0.1)).toBe('ACCELERATING')
  })

  it('is DECELERATING when the pace slows down but keeps direction', () => {
    expect(classifyChange(3.8, 1.2, 0.1)).toBe('DECELERATING')
  })

  it('is REVERSING when the sign flips and both moves are real', () => {
    expect(classifyChange(2, -2, 0.1)).toBe('REVERSING')
  })

  it('is ANOMALOUS when the current move dwarfs the prior one', () => {
    expect(classifyChange(1, 10, 0.1)).toBe('ANOMALOUS')
  })

  it('is SHIFTING when there was no real prior move to compare against', () => {
    expect(classifyChange(0, 5, 0.1)).toBe('SHIFTING')
    expect(classifyChange(null, 5, 0.1)).toBe('SHIFTING')
  })

  it('returns null when there is no current data at all', () => {
    expect(classifyChange(1, null, 0.1)).toBeNull()
  })
})

describe('classifyMarketChanges', () => {
  it('classifies CVD acceleration only within the same session', () => {
    const now = new Date('2026-01-01T00:02:00Z')
    const records = [
      record({ createdAt: '2026-01-01T00:00:00Z', cvd: 0, cvdSessionStartedAt: 'session-A' }),
      record({ createdAt: '2026-01-01T00:01:00Z', cvd: 1.2, cvdSessionStartedAt: 'session-A' }),
    ]
    const live = { price: null, cvd: 5.0, cvdSessionStartedAt: 'session-A', openInterest: null, fundingRate: null }
    const result = classifyMarketChanges(now, live, records)
    expect(result.cvd).toBe('ACCELERATING')
  })

  it('never diffs CVD across a session boundary (page reload)', () => {
    const now = new Date('2026-01-01T00:02:00Z')
    const records = [
      record({ createdAt: '2026-01-01T00:00:00Z', cvd: 0, cvdSessionStartedAt: 'session-A' }),
      record({ createdAt: '2026-01-01T00:01:00Z', cvd: 500, cvdSessionStartedAt: 'session-A' }),
      // Reload happens between this record and "live" — a new session starts.
    ]
    const live = { price: null, cvd: 0.9, cvdSessionStartedAt: 'session-B', openInterest: null, fundingRate: null }
    const result = classifyMarketChanges(now, live, records)
    // Without the session guard this would read as CVD collapsing by ~499 —
    // the guard must report "no comparable data" instead of a fake reversal.
    expect(result.cvd).toBeNull()
  })
})
