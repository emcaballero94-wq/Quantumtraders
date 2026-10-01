import { describe, expect, it } from 'vitest'
import { classifyTrade } from './classification'
import type { OptionTrade } from './types'

function makeTrade(overrides: Partial<OptionTrade>): OptionTrade {
  return {
    symbol: 'O:SPY260101C00500000',
    underlying: 'SPY',
    timestamp: Date.now(),
    optionType: 'CALL',
    side: 'UNKNOWN',
    strike: 500,
    expiration: '2026-01-01',
    dte: 30,
    contracts: 10,
    premium: 50_000,
    notional: 500_000,
    bid: 4.9,
    ask: 5.1,
    price: 5.0,
    executionSide: 'UNKNOWN',
    impliedVolatility: 0.25,
    delta: 0.4,
    gamma: 0.01,
    theta: -0.02,
    vega: 0.1,
    openInterest: 1000,
    volume: 200,
    source: 'test',
    ...overrides,
  }
}

describe('classifyTrade', () => {
  it('returns UNKNOWN with LOW confidence when neither side nor executionSide is known', () => {
    const trade = makeTrade({ optionType: 'CALL', side: 'UNKNOWN', executionSide: 'UNKNOWN' })
    const result = classifyTrade(trade)
    expect(result.direction).toBe('UNKNOWN')
    expect(result.confidence).toBe('LOW')
  })

  it('classifies a call bought at the ask as bullish with HIGH confidence when side agrees', () => {
    const trade = makeTrade({ optionType: 'CALL', side: 'BUY', executionSide: 'AT_ASK' })
    const result = classifyTrade(trade)
    expect(result.direction).toBe('BULLISH')
    expect(result.confidence).toBe('HIGH')
  })

  it('classifies a call sold at the bid as bearish, not simply "call = bullish"', () => {
    const trade = makeTrade({ optionType: 'CALL', side: 'SELL', executionSide: 'AT_BID' })
    const result = classifyTrade(trade)
    expect(result.direction).toBe('BEARISH')
  })

  it('classifies a put bought at the ask as bearish', () => {
    const trade = makeTrade({ optionType: 'PUT', side: 'BUY', executionSide: 'AT_ASK' })
    const result = classifyTrade(trade)
    expect(result.direction).toBe('BEARISH')
    expect(result.confidence).toBe('HIGH')
  })

  it('classifies a put sold at the bid as bullish, not simply "put = bearish"', () => {
    const trade = makeTrade({ optionType: 'PUT', side: 'SELL', executionSide: 'AT_BID' })
    const result = classifyTrade(trade)
    expect(result.direction).toBe('BULLISH')
  })

  it('falls back to trade side alone with MEDIUM confidence when executionSide is BETWEEN', () => {
    const trade = makeTrade({ optionType: 'CALL', side: 'BUY', executionSide: 'BETWEEN' })
    const result = classifyTrade(trade)
    expect(result.direction).toBe('BULLISH')
    expect(result.confidence).toBe('MEDIUM')
  })
})
