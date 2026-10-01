import { describe, expect, it } from 'vitest'
import { computeOptionsFlowScore } from './score'
import { detectLargeTrades } from './large-trades'
import type { OptionTrade } from './types'

function makeTrade(overrides: Partial<OptionTrade>): OptionTrade {
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
    premium: 1000,
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
    ...overrides,
  }
}

describe('computeOptionsFlowScore', () => {
  it('returns DEGRADED data quality and LOW confidence when there are no trades', () => {
    const score = computeOptionsFlowScore({ trades: [], acceleration: null, largeTrades: [] })
    expect(score.components.directionalBias).toBe(50)
    expect(score.dataQuality).toBe('DEGRADED')
    expect(score.confidence).toBe('LOW')
  })

  it('scores above 50 when flow is clearly bullish', () => {
    const trades = [
      makeTrade({ optionType: 'CALL', side: 'BUY', executionSide: 'AT_ASK', premium: 50_000 }),
      makeTrade({ optionType: 'CALL', side: 'BUY', executionSide: 'AT_ASK', premium: 50_000, strike: 110 }),
    ]
    const score = computeOptionsFlowScore({ trades, acceleration: null, largeTrades: [] })
    expect(score.value).toBeGreaterThan(50)
    expect(score.dataQuality).toBe('GOOD')
  })

  it('never exceeds the 0-100 range regardless of inputs', () => {
    const trades = Array.from({ length: 50 }, (_, i) =>
      makeTrade({ optionType: 'CALL', side: 'BUY', executionSide: 'AT_ASK', premium: 1_000_000, strike: 100 + i }),
    )
    const largeTrades = detectLargeTrades(trades, { type: 'absolute', value: 0 })
    const score = computeOptionsFlowScore({ trades, acceleration: null, largeTrades })
    expect(score.value).toBeLessThanOrEqual(100)
    expect(score.value).toBeGreaterThanOrEqual(0)
  })
})
