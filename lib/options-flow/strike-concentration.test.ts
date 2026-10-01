import { describe, expect, it } from 'vitest'
import { computeStrikeConcentration, identifyKeyStrikes } from './strike-concentration'
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

describe('computeStrikeConcentration', () => {
  it('groups premium and contracts by strike, split by call/put', () => {
    const trades = [
      makeTrade({ strike: 100, optionType: 'CALL', premium: 1000, contracts: 2 }),
      makeTrade({ strike: 100, optionType: 'PUT', premium: 500, contracts: 1 }),
      makeTrade({ strike: 110, optionType: 'CALL', premium: 2000, contracts: 3 }),
    ]
    const levels = computeStrikeConcentration(trades)
    expect(levels).toHaveLength(2)
    const at100 = levels.find((l) => l.strike === 100)!
    expect(at100.callPremium).toBe(1000)
    expect(at100.putPremium).toBe(500)
    expect(at100.netDirectionalPressure).toBe(500)
  })

  it('sorts levels by strike ascending', () => {
    const trades = [makeTrade({ strike: 200 }), makeTrade({ strike: 50 }), makeTrade({ strike: 100 })]
    const levels = computeStrikeConcentration(trades)
    expect(levels.map((l) => l.strike)).toEqual([50, 100, 200])
  })
})

describe('identifyKeyStrikes', () => {
  it('returns the top-N strikes by total premium with their share of the total', () => {
    const trades = [
      makeTrade({ strike: 100, premium: 8000 }),
      makeTrade({ strike: 110, premium: 1000 }),
      makeTrade({ strike: 120, premium: 1000 }),
    ]
    const levels = computeStrikeConcentration(trades)
    const keyStrikes = identifyKeyStrikes(levels, 1)
    expect(keyStrikes).toHaveLength(1)
    expect(keyStrikes[0].strike).toBe(100)
    expect(keyStrikes[0].shareOfTotalPremium).toBeCloseTo(0.8)
  })

  it('returns an empty array when there is no premium at all', () => {
    expect(identifyKeyStrikes([])).toEqual([])
  })
})
