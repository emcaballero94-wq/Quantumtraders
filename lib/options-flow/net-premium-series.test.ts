import { describe, expect, it } from 'vitest'
import { computeCumulativeNetPremiumSeries } from './net-premium-series'
import type { OptionTrade } from './types'

function makeTrade(overrides: Partial<OptionTrade>): OptionTrade {
  return {
    symbol: 'O:TEST',
    underlying: 'TEST',
    timestamp: Date.now(),
    optionType: 'CALL',
    side: 'BUY',
    strike: 100,
    expiration: '2026-01-01',
    dte: 10,
    contracts: 1,
    premium: 1000,
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

const BUCKET_MS = 15 * 60_000

describe('computeCumulativeNetPremiumSeries', () => {
  it('returns an empty array for no trades', () => {
    expect(computeCumulativeNetPremiumSeries([], 15)).toEqual([])
  })

  it('accumulates a single bullish trade into one bucket', () => {
    const trades = [makeTrade({ timestamp: 0, optionType: 'CALL', executionSide: 'AT_ASK', premium: 5000 })]
    const series = computeCumulativeNetPremiumSeries(trades, 15, 1)
    expect(series).toHaveLength(1)
    expect(series[0].netPremium).toBe(5000)
    expect(series[0].cumulativeNetPremium).toBe(5000)
  })

  it('nets a bullish call and a bearish call-sold trade in the same bucket', () => {
    const trades = [
      makeTrade({ timestamp: 0, optionType: 'CALL', executionSide: 'AT_ASK', premium: 5000 }), // bullish
      makeTrade({ timestamp: 1000, optionType: 'CALL', executionSide: 'AT_BID', premium: 2000 }), // bearish
    ]
    const series = computeCumulativeNetPremiumSeries(trades, 15, 1)
    expect(series).toHaveLength(1)
    expect(series[0].netPremium).toBe(3000)
  })

  it('accumulates across multiple buckets in chronological order', () => {
    const trades = [
      makeTrade({ timestamp: 0, executionSide: 'AT_ASK', premium: 1000 }), // bucket 0: +1000
      makeTrade({ timestamp: BUCKET_MS, executionSide: 'AT_BID', premium: 400 }), // bucket 1: -400
      makeTrade({ timestamp: BUCKET_MS * 2, executionSide: 'AT_ASK', premium: 200 }), // bucket 2: +200
    ]
    const series = computeCumulativeNetPremiumSeries(trades, 15, 3)
    expect(series).toHaveLength(3)
    expect(series.map((p) => p.netPremium)).toEqual([1000, -400, 200])
    expect(series.map((p) => p.cumulativeNetPremium)).toEqual([1000, 600, 800])
  })

  it('fills empty buckets with zero net but carries the cumulative total forward', () => {
    const trades = [
      makeTrade({ timestamp: 0, executionSide: 'AT_ASK', premium: 1000 }),
      makeTrade({ timestamp: BUCKET_MS * 2, executionSide: 'AT_ASK', premium: 500 }),
    ]
    const series = computeCumulativeNetPremiumSeries(trades, 15, 3)
    expect(series.map((p) => p.netPremium)).toEqual([1000, 0, 500])
    expect(series.map((p) => p.cumulativeNetPremium)).toEqual([1000, 1000, 1500])
  })

  it('excludes trades older than the maxBuckets window instead of growing the series', () => {
    const trades = [
      makeTrade({ timestamp: 0, executionSide: 'AT_ASK', premium: 999_999 }), // way outside the kept window
      makeTrade({ timestamp: BUCKET_MS * 100, executionSide: 'AT_ASK', premium: 1000 }),
    ]
    const series = computeCumulativeNetPremiumSeries(trades, 15, 2)
    expect(series).toHaveLength(2)
    expect(series[series.length - 1].cumulativeNetPremium).toBe(1000)
  })

  it('ignores trades whose classification is UNKNOWN', () => {
    const trades = [makeTrade({ timestamp: 0, side: 'UNKNOWN', executionSide: 'UNKNOWN', premium: 5000 })]
    const series = computeCumulativeNetPremiumSeries(trades, 15, 1)
    expect(series[0].netPremium).toBe(0)
    expect(series[0].cumulativeNetPremium).toBe(0)
  })
})
