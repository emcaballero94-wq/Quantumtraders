import { describe, expect, it } from 'vitest'
import { classifyNoise, filterNoiseTrades } from './noise-filter'
import { aggregatePremium } from './aggregation'
import type { OptionTrade } from './types'

function makeTrade(overrides: Partial<OptionTrade>): OptionTrade {
  return {
    symbol: 'O:TEST',
    underlying: 'BTC',
    timestamp: Date.now(),
    optionType: 'CALL',
    side: 'BUY',
    strike: 65_000,
    expiration: '2026-01-01',
    dte: 30,
    contracts: 1,
    premium: 5000,
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
    ...overrides,
  }
}

const SPOT = 65_000

describe('classifyNoise', () => {
  it('flags a trade whose premium is below the dollar floor, regardless of strike', () => {
    const trade = makeTrade({ premium: 20, strike: 65_000, dte: 30 })
    const result = classifyNoise(trade, SPOT)
    expect(result.isNoise).toBe(true)
    expect(result.reason).toMatch(/premium below/)
  })

  it('flags a deep-OTM, short-dated trade even with a large premium', () => {
    // 46% OTM, 2 DTE — the "cheap ticket" pattern even though premium itself is large here.
    const trade = makeTrade({ premium: 6000, strike: 95_000, dte: 2 })
    const result = classifyNoise(trade, SPOT)
    expect(result.isNoise).toBe(true)
    expect(result.reason).toMatch(/OTM/)
  })

  it('does not flag a deep-OTM trade with plenty of time left', () => {
    const trade = makeTrade({ premium: 6000, strike: 95_000, dte: 60 })
    expect(classifyNoise(trade, SPOT).isNoise).toBe(false)
  })

  it('does not flag a short-dated trade close to the money', () => {
    const trade = makeTrade({ premium: 6000, strike: 66_000, dte: 2 })
    expect(classifyNoise(trade, SPOT).isNoise).toBe(false)
  })

  it('does not flag a normal, reasonably priced, near-the-money trade', () => {
    const trade = makeTrade({ premium: 5000, strike: 66_000, dte: 30 })
    expect(classifyNoise(trade, SPOT).isNoise).toBe(false)
  })

  it('falls back to the premium floor alone when spot price is unavailable', () => {
    const cheap = makeTrade({ premium: 10, strike: 999_999, dte: 1 })
    const normal = makeTrade({ premium: 5000, strike: 999_999, dte: 1 })
    expect(classifyNoise(cheap, null).isNoise).toBe(true)
    expect(classifyNoise(normal, null).isNoise).toBe(false)
  })

  it('applies the same rules to puts, not just calls', () => {
    const lotteryPut = makeTrade({ optionType: 'PUT', premium: 15, strike: 40_000, dte: 3 })
    expect(classifyNoise(lotteryPut, SPOT).isNoise).toBe(true)
  })
})

describe('filterNoiseTrades + aggregatePremium — signal inversion scenario', () => {
  // Mirrors the audited repo's RXRX fixture: raw P/C looks bullish (lots of
  // call premium), but once the noise is excluded the real picture flips
  // bearish. Numbers are synthetic, not from Deribit.
  const lotteryCalls = Array.from({ length: 5 }, () =>
    makeTrade({ optionType: 'CALL', premium: 6000, strike: 95_000, dte: 2, contracts: 500 }),
  )
  const realCalls = Array.from({ length: 2 }, () =>
    makeTrade({ optionType: 'CALL', premium: 2000, strike: 66_000, dte: 30, contracts: 50 }),
  )
  const puts = [makeTrade({ optionType: 'PUT', premium: 10_000, strike: 60_000, dte: 30, contracts: 400 })]

  const allTrades = [...lotteryCalls, ...realCalls, ...puts]

  it('raw totals look bullish (low put/call premium ratio)', () => {
    const raw = aggregatePremium(allTrades)
    expect(raw.callPremium).toBe(34_000) // 5*6000 + 2*2000
    expect(raw.putPremium).toBe(10_000)
    expect(raw.callPutRatioByPremium).toBeCloseTo(34_000 / 10_000, 5)
    expect(raw.callPutRatioByPremium!).toBeGreaterThan(1) // more call premium than put premium
  })

  it('adjusted totals (non-noise only) flip the picture', () => {
    const { nonNoiseTrades, noiseTrades, noiseContractsPct } = filterNoiseTrades(allTrades, SPOT)
    expect(noiseTrades).toHaveLength(5) // just the lottery calls
    expect(nonNoiseTrades).toHaveLength(3) // 2 real calls + 1 put

    const adjusted = aggregatePremium(nonNoiseTrades)
    expect(adjusted.callPremium).toBe(4000) // 2*2000, lottery excluded
    expect(adjusted.putPremium).toBe(10_000)

    // Raw: 4.2x more call premium than put. Adjusted: 2.5x more put than call.
    const rawCallHeavy = aggregatePremium(allTrades).callPremium > aggregatePremium(allTrades).putPremium
    const adjustedPutHeavy = adjusted.putPremium > adjusted.callPremium
    expect(rawCallHeavy).toBe(true)
    expect(adjustedPutHeavy).toBe(true)

    // Majority of contracts (2500 of 3000) are the lottery calls.
    expect(noiseContractsPct).not.toBeNull()
    expect(noiseContractsPct!).toBeGreaterThan(80)
  })
})

describe('filterNoiseTrades — clean session control case', () => {
  // No deep-OTM/short-dated or sub-floor trades — adjusted should barely
  // differ from raw, same as the audited repo's CEL control fixture.
  const cleanTrades = [
    makeTrade({ optionType: 'CALL', premium: 4000, strike: 66_000, dte: 20, contracts: 20 }),
    makeTrade({ optionType: 'CALL', premium: 3500, strike: 67_000, dte: 25, contracts: 15 }),
    makeTrade({ optionType: 'PUT', premium: 3000, strike: 63_000, dte: 20, contracts: 18 }),
  ]

  it('classifies close to 0% of contracts as noise', () => {
    const { noiseContractsPct } = filterNoiseTrades(cleanTrades, SPOT)
    expect(noiseContractsPct).toBe(0)
  })

  it('raw and adjusted call/put ratios are identical when nothing is filtered', () => {
    const raw = aggregatePremium(cleanTrades)
    const { nonNoiseTrades } = filterNoiseTrades(cleanTrades, SPOT)
    const adjusted = aggregatePremium(nonNoiseTrades)
    expect(adjusted.callPutRatioByPremium).toBe(raw.callPutRatioByPremium)
  })
})
