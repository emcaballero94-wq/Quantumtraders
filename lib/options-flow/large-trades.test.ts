import { describe, expect, it } from 'vitest'
import { detectLargeTrades } from './large-trades'
import type { OptionTrade } from './types'

function makeTrade(premium: number | null): OptionTrade {
  return {
    symbol: 'O:TEST',
    underlying: 'TEST',
    timestamp: Date.now(),
    optionType: 'CALL',
    side: 'UNKNOWN',
    strike: 100,
    expiration: '2026-01-01',
    dte: 10,
    contracts: 1,
    premium,
    notional: null,
    bid: null,
    ask: null,
    price: null,
    executionSide: 'UNKNOWN',
    impliedVolatility: null,
    delta: null,
    gamma: null,
    theta: null,
    vega: null,
    openInterest: null,
    volume: null,
    source: 'test',
  }
}

describe('detectLargeTrades', () => {
  const trades = [makeTrade(10_000), makeTrade(50_000), makeTrade(200_000), makeTrade(null)]

  it('flags trades at or above an absolute dollar threshold', () => {
    const result = detectLargeTrades(trades, { type: 'absolute', value: 50_000 })
    expect(result).toHaveLength(2)
    expect(result[0].trade.premium).toBe(200_000)
  })

  it('ignores trades with null premium entirely', () => {
    const result = detectLargeTrades(trades, { type: 'absolute', value: 0 })
    expect(result.every((lt) => lt.trade.premium !== null)).toBe(true)
  })

  it('flags trades above a percentile of the session premium distribution', () => {
    const result = detectLargeTrades(trades, { type: 'percentile', value: 100 })
    expect(result).toHaveLength(1)
    expect(result[0].trade.premium).toBe(200_000)
  })

  it('flags trades above a multiple of the session mean premium', () => {
    // mean of [10k, 50k, 200k] = 86,666.67 — 2x that is ~173,333, only 200k clears it
    const result = detectLargeTrades(trades, { type: 'relative-to-session', value: 2 })
    expect(result).toHaveLength(1)
    expect(result[0].trade.premium).toBe(200_000)
  })

  it('returns results sorted by premium descending', () => {
    const result = detectLargeTrades(trades, { type: 'absolute', value: 0 })
    const premiums = result.map((r) => r.trade.premium)
    expect(premiums).toEqual([...premiums].sort((a, b) => (b ?? 0) - (a ?? 0)))
  })
})
