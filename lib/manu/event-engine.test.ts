import { describe, expect, it } from 'vitest'
import { buildEvents } from './event-engine'
import type { MarketState } from './types'

function state(overrides: Partial<MarketState>): MarketState {
  return {
    asset: 'BTCUSDT',
    timestamp: '2026-01-01T00:00:00Z',
    price: 100,
    priceChange1m: null,
    priceChange5m: null,
    priceChange15m: null,
    cvd: null,
    cvdDelta1m: null,
    cvdDelta5m: null,
    funding: null,
    fundingChange: null,
    openInterest: null,
    openInterestChange1m: null,
    openInterestChange5m: null,
    orderBookImbalance: null,
    bidDepth: null,
    askDepth: null,
    spread: null,
    liquidationNotional: null,
    liquidationLong: null,
    liquidationShort: null,
    marketRegime: 'UNKNOWN',
    dataQuality: 'GOOD',
    ...overrides,
  }
}

const noChanges = { price: null, cvd: null, openInterest: null, funding: null }

describe('buildEvents — liquidation severity thresholds', () => {
  it('emits nothing below the LOW/MEDIUM threshold', () => {
    const events = buildEvents(state({}), noChanges, null, null, { long: 1000, short: 0 })
    expect(events.find((e) => e.type === 'LIQUIDATION_SPIKE')).toBeUndefined()
  })

  it('scales severity with the 1-minute notional delta, not the cumulative session total', () => {
    const medium = buildEvents(state({}), noChanges, null, null, { long: 5_000, short: 0 })
    expect(medium.find((e) => e.type === 'LIQUIDATION_SPIKE')?.severity).toBe('MEDIUM')

    const high = buildEvents(state({}), noChanges, null, null, { long: 50_000, short: 0 })
    expect(high.find((e) => e.type === 'LIQUIDATION_SPIKE')?.severity).toBe('HIGH')

    const critical = buildEvents(state({}), noChanges, null, null, { long: 250_000, short: 0 })
    expect(critical.find((e) => e.type === 'LIQUIDATION_SPIKE')?.severity).toBe('CRITICAL')
  })

  it('never fires when liquidation deltas are unavailable (session reset detected)', () => {
    const events = buildEvents(state({}), noChanges, null, null, null)
    expect(events.find((e) => e.type === 'LIQUIDATION_SPIKE')).toBeUndefined()
  })
})

describe('buildEvents — price/CVD divergence', () => {
  it('fires PRICE_CVD_DIVERGENCE when price and CVD move in opposite directions', () => {
    const divergent = state({ priceChange5m: 0.5, cvdDelta5m: -2 })
    const events = buildEvents(divergent, noChanges, null, null, null)
    expect(events.some((e) => e.type === 'PRICE_CVD_DIVERGENCE')).toBe(true)
  })

  it('does not fire when price and CVD agree', () => {
    const aligned = state({ priceChange5m: 0.5, cvdDelta5m: 2 })
    const events = buildEvents(aligned, noChanges, null, null, null)
    expect(events.some((e) => e.type === 'PRICE_CVD_DIVERGENCE')).toBe(false)
  })
})

describe('buildEvents — change classifications', () => {
  it('maps ACCELERATING to PRICE_ACCELERATION and ANOMALOUS to HIGH severity', () => {
    const events = buildEvents(state({}), { ...noChanges, price: 'ANOMALOUS' }, null, null, null)
    const ev = events.find((e) => e.type === 'PRICE_ACCELERATION')
    expect(ev?.severity).toBe('HIGH')
  })

  it('maps REVERSING to PRICE_REVERSAL', () => {
    const events = buildEvents(state({}), { ...noChanges, price: 'REVERSING' }, null, null, null)
    expect(events.some((e) => e.type === 'PRICE_REVERSAL')).toBe(true)
  })

  it('emits nothing for UNCHANGED', () => {
    const events = buildEvents(state({}), { ...noChanges, price: 'UNCHANGED', cvd: 'UNCHANGED' }, null, null, null)
    expect(events.find((e) => e.type === 'PRICE_ACCELERATION' || e.type === 'PRICE_REVERSAL')).toBeUndefined()
  })
})

describe('buildEvents — regime change', () => {
  it('fires ORDERFLOW_REGIME_CHANGE only when the regime actually changed', () => {
    const changed = buildEvents(state({ marketRegime: 'TRENDING_UP' }), noChanges, null, 'RANGING', null)
    expect(changed.some((e) => e.type === 'ORDERFLOW_REGIME_CHANGE')).toBe(true)

    const unchanged = buildEvents(state({ marketRegime: 'TRENDING_UP' }), noChanges, null, 'TRENDING_UP', null)
    expect(unchanged.some((e) => e.type === 'ORDERFLOW_REGIME_CHANGE')).toBe(false)
  })
})
