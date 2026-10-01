import { describe, expect, it } from 'vitest'
import { computeFlowAcceleration } from './change-engine'
import type { OptionTrade } from './types'

function makeBullishTrade(timestamp: number, premium: number): OptionTrade {
  return {
    symbol: 'O:TEST',
    underlying: 'TEST',
    timestamp,
    optionType: 'CALL',
    side: 'BUY',
    strike: 100,
    expiration: '2026-01-01',
    dte: 10,
    contracts: 1,
    premium,
    notional: null,
    bid: null,
    ask: null,
    price: null,
    executionSide: 'AT_ASK',
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

describe('computeFlowAcceleration', () => {
  it('reports INCREASING when the tracked direction grows beyond the flat threshold', () => {
    const now = 20 * 60_000
    const trades = [
      makeBullishTrade(5 * 60_000, 100_000), // previous 15m window (5-20 min ago... adjust below)
      makeBullishTrade(18 * 60_000, 150_000), // current 15m window
    ]
    // previous window = (now - 30m, now - 15m] = (-10m, 5m] -> only the first trade at 5m
    // current window = (now - 15m, now] = (5m, 20m] -> only the second trade at 18m
    const result = computeFlowAcceleration(trades, now, 15, 'BULLISH')
    expect(result.previousPremium).toBe(100_000)
    expect(result.currentPremium).toBe(150_000)
    expect(result.direction).toBe('INCREASING')
    expect(result.magnitudePct).toBeCloseTo(50)
  })

  it('reports FLAT when there is no prior premium and current premium is also zero', () => {
    const result = computeFlowAcceleration([], 10 * 60_000, 15, 'BULLISH')
    expect(result.direction).toBe('FLAT')
    expect(result.magnitudePct).toBeNull()
  })

  it('reports LOW confidence when very few trades back the comparison', () => {
    const trades = [makeBullishTrade(5 * 60_000, 1000)]
    const result = computeFlowAcceleration(trades, 20 * 60_000, 15, 'BULLISH')
    expect(result.confidence).toBe('LOW')
  })
})
