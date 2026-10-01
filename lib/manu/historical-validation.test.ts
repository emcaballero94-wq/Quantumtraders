import { describe, expect, it } from 'vitest'
import { currentFingerprintFromState, findSimilarConditions, sampleSizeLabel } from './historical-validation'
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

describe('sampleSizeLabel', () => {
  it('classifies the boundaries exactly as specified', () => {
    expect(sampleSizeLabel(0)).toBe('INSUFFICIENT_SAMPLE')
    expect(sampleSizeLabel(29)).toBe('INSUFFICIENT_SAMPLE')
    expect(sampleSizeLabel(30)).toBe('LIMITED_SAMPLE')
    expect(sampleSizeLabel(99)).toBe('LIMITED_SAMPLE')
    expect(sampleSizeLabel(100)).toBe('USABLE_SAMPLE')
    expect(sampleSizeLabel(299)).toBe('USABLE_SAMPLE')
    expect(sampleSizeLabel(300)).toBe('ROBUST_SAMPLE')
  })
})

describe('findSimilarConditions', () => {
  it('never reports a sample when nothing resembles the current condition', () => {
    // Every record here has a flat/neutral fingerprint (all zeros); a
    // strongly bullish current fingerprint should match none of them.
    const records: OrderFlowBriefRecord[] = []
    for (let i = 0; i < 40; i += 1) {
      records.push(
        record({
          createdAt: new Date(Date.UTC(2026, 0, 1, 0, i)).toISOString(),
          price: 100,
          cvd: 0,
          openInterest: 1000,
          bookImbalance: 0,
          cvdSessionStartedAt: 'session-A',
        }),
      )
    }
    const fingerprint = currentFingerprintFromState(5, 5, 5, 5)
    const result = findSimilarConditions(records, fingerprint)
    expect(result.sampleSize).toBe(0)
    expect(result.sampleLabel).toBe('INSUFFICIENT_SAMPLE')
  })

  it('matches records whose own recent history resembles the current fingerprint and grades forward returns', () => {
    const records: OrderFlowBriefRecord[] = []
    for (let i = 0; i < 40; i += 1) {
      records.push(
        record({
          createdAt: new Date(Date.UTC(2026, 0, 1, 0, i)).toISOString(),
          price: 100 + i, // steadily rising, so forward returns are positive and measurable
          cvd: i, // steadily rising CVD within one continuous session
          openInterest: 1000 + i * 10, // steadily rising OI
          bookImbalance: 2, // consistently positive imbalance
          cvdSessionStartedAt: 'session-A',
        }),
      )
    }
    // Same direction as the fixture: CVD up, OI up, imbalance up. Liquidation
    // skew is left neutral (0) since the fixture doesn't set any.
    const fingerprint = currentFingerprintFromState(1, 1, 1, 0)
    const result = findSimilarConditions(records, fingerprint)

    // Records need 5 minutes of prior history to derive their own
    // fingerprint, so the first 5 of 40 don't count.
    expect(result.sampleSize).toBe(35)
    expect(result.sampleLabel).toBe('LIMITED_SAMPLE')
    expect(result.horizons['5m'].gradedCount).toBeGreaterThan(0)
    expect(result.horizons['5m'].positiveRatePct).toBe(100)
    expect(result.horizons['5m'].meanReturnPct).not.toBeNull()
    expect(result.horizons['5m'].medianReturnPct).not.toBeNull()
  })

  it('does not compare CVD across a session boundary when building historical fingerprints', () => {
    const records: OrderFlowBriefRecord[] = []
    for (let i = 0; i < 10; i += 1) {
      records.push(
        record({
          createdAt: new Date(Date.UTC(2026, 0, 1, 0, i)).toISOString(),
          price: 100,
          cvd: i < 5 ? i * 100 : i, // a reload happens at i=5, cvd drops from ~400 to single digits
          openInterest: 1000, // constant — the OI dimension never matches a "rising" fingerprint
          bookImbalance: 0,
          cvdSessionStartedAt: i < 5 ? 'session-A' : 'session-B',
        }),
      )
    }
    // Raw numbers alone would say CVD fell sharply (i=6 vs. its own 5-minutes-
    // earlier record i=1: 6 - 100 = -94, sign -1) — exactly matching a
    // bearish fingerprint. But that comparison crosses the session-B/session-A
    // boundary, so the guard must report it as neutral (sign 0) instead.
    // Combined with OI never matching, that keeps every candidate below the
    // 0.75 match threshold (only imbalance + liquidation-skew agree, 2 of 4).
    const fingerprint = currentFingerprintFromState(-1, 1, 0, 0)
    const result = findSimilarConditions(records, fingerprint)
    expect(result.sampleSize).toBe(0)
  })
})
