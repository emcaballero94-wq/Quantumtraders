import { describe, expect, it } from 'vitest'
import { aggregateDirectionalPremium, aggregatePremium, bucketByDte, dteBucketId, filterByWindow } from './aggregation'
import type { OptionTrade } from './types'

function makeTrade(overrides: Partial<OptionTrade>): OptionTrade {
  return {
    symbol: 'O:TEST',
    underlying: 'TEST',
    timestamp: 1_000_000,
    optionType: 'CALL',
    side: 'UNKNOWN',
    strike: 100,
    expiration: '2026-01-01',
    dte: 10,
    contracts: 1,
    premium: 1000,
    notional: 10_000,
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

describe('aggregatePremium', () => {
  it('splits premium, contracts and trade counts by call/put and computes ratios', () => {
    const trades = [
      makeTrade({ optionType: 'CALL', premium: 1000, contracts: 5 }),
      makeTrade({ optionType: 'CALL', premium: 2000, contracts: 5 }),
      makeTrade({ optionType: 'PUT', premium: 1500, contracts: 10 }),
    ]
    const totals = aggregatePremium(trades)
    expect(totals.callPremium).toBe(3000)
    expect(totals.putPremium).toBe(1500)
    expect(totals.netPremium).toBe(1500)
    expect(totals.callPutRatioByPremium).toBe(2)
    expect(totals.callPutRatioByContracts).toBe(1)
    expect(totals.callPutRatioByTradeCount).toBe(2)
  })

  it('returns null ratios when there is no put side to divide by', () => {
    const totals = aggregatePremium([makeTrade({ optionType: 'CALL' })])
    expect(totals.callPutRatioByPremium).toBeNull()
  })
})

describe('aggregateDirectionalPremium', () => {
  it('sums premium by classified direction, not raw call/put', () => {
    const trades = [
      makeTrade({ optionType: 'CALL', side: 'BUY', executionSide: 'AT_ASK', premium: 1000 }),
      makeTrade({ optionType: 'CALL', side: 'SELL', executionSide: 'AT_BID', premium: 500 }),
    ]
    const totals = aggregateDirectionalPremium(trades)
    expect(totals.bullishPremium).toBe(1000)
    expect(totals.bearishPremium).toBe(500)
  })
})

describe('dteBucketId', () => {
  it('buckets DTE into the five configured ranges', () => {
    expect(dteBucketId(0)).toBe('0-1')
    expect(dteBucketId(1)).toBe('0-1')
    expect(dteBucketId(5)).toBe('2-7')
    expect(dteBucketId(20)).toBe('8-30')
    expect(dteBucketId(45)).toBe('31-60')
    expect(dteBucketId(90)).toBe('60+')
  })
})

describe('bucketByDte', () => {
  it('groups trades into buckets in a fixed near-to-far order', () => {
    const trades = [makeTrade({ dte: 90 }), makeTrade({ dte: 0 }), makeTrade({ dte: 10 })]
    const buckets = bucketByDte(trades)
    expect(buckets.map((b) => b.id)).toEqual(['0-1', '8-30', '60+'])
  })
})

describe('filterByWindow', () => {
  it('keeps only trades within (end - windowMinutes, end] — exclusive start, inclusive end, so adjacent windows never double-count a boundary trade', () => {
    const trades = [
      makeTrade({ timestamp: 0 }),
      makeTrade({ timestamp: 5 * 60_000 }),
      makeTrade({ timestamp: 10 * 60_000 }),
    ]
    const result = filterByWindow(trades, 10 * 60_000, 5)
    expect(result.map((t) => t.timestamp)).toEqual([10 * 60_000])
  })
})
