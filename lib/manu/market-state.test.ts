import { describe, expect, it } from 'vitest'
import { buildMarketState, detectLiquidationReset, sameSession, type LiveSnapshotInput } from './market-state'
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

function live(overrides: Partial<LiveSnapshotInput>): LiveSnapshotInput {
  return {
    price: null,
    cvd: null,
    cvdSessionStartedAt: null,
    fundingRate: null,
    openInterest: null,
    bookImbalance: null,
    bidDepth: null,
    askDepth: null,
    spread: null,
    liquidationLongNotional: null,
    liquidationShortNotional: null,
    liquidationsSessionStartedAt: null,
    ...overrides,
  }
}

describe('sameSession', () => {
  it('treats null/undefined on either side as never comparable', () => {
    expect(sameSession(null, 'a')).toBe(false)
    expect(sameSession('a', null)).toBe(false)
    expect(sameSession(null, null)).toBe(false)
    expect(sameSession(undefined, undefined)).toBe(false)
  })

  it('is true only for an exact match', () => {
    expect(sameSession('a', 'a')).toBe(true)
    expect(sameSession('a', 'b')).toBe(false)
  })
})

describe('buildMarketState', () => {
  const now = new Date('2026-01-01T00:16:00Z')

  it('marks dataQuality INSUFFICIENT when there is no live price at all', () => {
    const state = buildMarketState('BTCUSDT', now, live({}), [])
    expect(state.dataQuality).toBe('INSUFFICIENT')
  })

  it('classifies RANGING when the 15m price move is within the noise floor', () => {
    const history = [record({ createdAt: '2026-01-01T00:01:00Z', price: 100 })]
    const state = buildMarketState('BTCUSDT', now, live({ price: 100.01 }), history)
    expect(state.marketRegime).toBe('RANGING')
  })

  it('classifies TRENDING_UP when 1m/5m/15m price changes all agree in direction', () => {
    const history = [
      record({ createdAt: '2026-01-01T00:01:00Z', price: 90 }),
      record({ createdAt: '2026-01-01T00:11:00Z', price: 95 }),
      record({ createdAt: '2026-01-01T00:15:00Z', price: 99 }),
    ]
    const state = buildMarketState('BTCUSDT', now, live({ price: 100 }), history)
    expect(state.marketRegime).toBe('TRENDING_UP')
  })

  it('classifies VOLATILE when short-term and longer-term price direction disagree', () => {
    const history = [
      record({ createdAt: '2026-01-01T00:01:00Z', price: 90 }), // 15m ago: price was lower -> net up
      record({ createdAt: '2026-01-01T00:15:00Z', price: 105 }), // 1m ago: price was higher -> just dropped
    ]
    const state = buildMarketState('BTCUSDT', now, live({ price: 100 }), history)
    expect(state.marketRegime).toBe('VOLATILE')
  })

  it('only computes a CVD delta against a historical point from the same session', () => {
    const history = [record({ createdAt: '2026-01-01T00:11:00Z', cvd: 10, cvdSessionStartedAt: 'session-A' })]
    const sameSessionState = buildMarketState('BTCUSDT', now, live({ price: 100, cvd: 15, cvdSessionStartedAt: 'session-A' }), history)
    expect(sameSessionState.cvdDelta5m).toBeCloseTo(5)

    const crossSessionState = buildMarketState('BTCUSDT', now, live({ price: 100, cvd: 15, cvdSessionStartedAt: 'session-B' }), history)
    expect(crossSessionState.cvdDelta5m).toBeNull()
  })
})

describe('detectLiquidationReset', () => {
  it('uses the exact session marker when available', () => {
    const last = record({ liquidationLongNotional: 1000, liquidationsSessionStartedAt: 'session-A' })
    const sameSessionLive = live({ liquidationLongNotional: 2000, liquidationsSessionStartedAt: 'session-A' })
    expect(detectLiquidationReset(last, sameSessionLive)).toBe(false)

    const resetLive = live({ liquidationLongNotional: 50, liquidationsSessionStartedAt: 'session-B' })
    expect(detectLiquidationReset(last, resetLive)).toBe(true)
  })

  it('falls back to the monotonic-decrease heuristic for legacy rows with no session marker', () => {
    const legacyLast = record({ liquidationLongNotional: 1000, liquidationsSessionStartedAt: null })
    expect(detectLiquidationReset(legacyLast, live({ liquidationLongNotional: 500 }))).toBe(true)
    expect(detectLiquidationReset(legacyLast, live({ liquidationLongNotional: 1500 }))).toBe(false)
  })

  it('is false when there is no prior record to compare against', () => {
    expect(detectLiquidationReset(null, live({ liquidationLongNotional: 10 }))).toBe(false)
  })
})
