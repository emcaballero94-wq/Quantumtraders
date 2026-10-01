import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchRecentDeribitOptionTrades } from './deribit-source'

function mockFetchOnce(body: unknown, ok = true, status = 200) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok,
      status,
      json: async () => body,
    }),
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('fetchRecentDeribitOptionTrades', () => {
  it('normalizes a well-formed trade into an OptionTrade with USD premium/notional', async () => {
    mockFetchOnce({
      result: {
        trades: [
          {
            trade_id: '1',
            timestamp: 1_700_000_000_000,
            price: 0.05,
            amount: 2,
            direction: 'buy',
            instrument_name: 'BTC-27JUN25-70000-C',
            index_price: 65_000,
            iv: 62.5,
          },
        ],
      },
    })

    const trades = await fetchRecentDeribitOptionTrades('BTC')
    expect(trades).toHaveLength(1)
    const trade = trades[0]
    expect(trade.optionType).toBe('CALL')
    expect(trade.strike).toBe(70_000)
    expect(trade.expiration).toBe('2025-06-27')
    expect(trade.side).toBe('BUY')
    expect(trade.executionSide).toBe('AT_ASK')
    expect(trade.contracts).toBe(2)
    expect(trade.premium).toBeCloseTo(2 * 0.05 * 65_000)
    expect(trade.notional).toBe(2 * 70_000)
    expect(trade.impliedVolatility).toBe(62.5)
    expect(trade.source).toBe('deribit')
  })

  it('maps a sell trade to SELL/AT_BID', async () => {
    mockFetchOnce({
      result: {
        trades: [
          {
            timestamp: 1_700_000_000_000,
            price: 0.02,
            amount: 1,
            direction: 'sell',
            instrument_name: 'ETH-3OCT25-2600-P',
            index_price: 2_500,
          },
        ],
      },
    })

    const trades = await fetchRecentDeribitOptionTrades('ETH')
    expect(trades[0].side).toBe('SELL')
    expect(trades[0].executionSide).toBe('AT_BID')
    expect(trades[0].optionType).toBe('PUT')
    expect(trades[0].expiration).toBe('2025-10-03')
  })

  it('skips trades whose instrument_name does not match the expected format', async () => {
    mockFetchOnce({
      result: {
        trades: [
          { timestamp: 1, price: 0.01, amount: 1, direction: 'buy', instrument_name: 'BTC-PERPETUAL', index_price: 1 },
          {
            timestamp: 2,
            price: 0.01,
            amount: 1,
            direction: 'buy',
            instrument_name: 'BTC-27JUN25-70000-C',
            index_price: 65_000,
          },
        ],
      },
    })

    const trades = await fetchRecentDeribitOptionTrades('BTC')
    expect(trades).toHaveLength(1)
  })

  it('returns an empty array when the index price is missing, leaving premium null instead of guessing', async () => {
    mockFetchOnce({
      result: {
        trades: [
          { timestamp: 1, price: 0.01, amount: 1, direction: 'buy', instrument_name: 'BTC-27JUN25-70000-C' },
        ],
      },
    })

    const trades = await fetchRecentDeribitOptionTrades('BTC')
    expect(trades).toHaveLength(1)
    expect(trades[0].premium).toBeNull()
    expect(trades[0].notional).toBe(70_000)
  })

  it('returns an empty array on a non-OK response', async () => {
    mockFetchOnce({}, false, 500)
    const trades = await fetchRecentDeribitOptionTrades('BTC')
    expect(trades).toEqual([])
  })

  it('returns an empty array when fetch throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))
    const trades = await fetchRecentDeribitOptionTrades('BTC')
    expect(trades).toEqual([])
  })

  it('sorts trades oldest-first regardless of API response order', async () => {
    mockFetchOnce({
      result: {
        trades: [
          { timestamp: 200, price: 0.01, amount: 1, direction: 'buy', instrument_name: 'BTC-27JUN25-70000-C', index_price: 1 },
          { timestamp: 100, price: 0.01, amount: 1, direction: 'buy', instrument_name: 'BTC-27JUN25-70000-C', index_price: 1 },
        ],
      },
    })

    const trades = await fetchRecentDeribitOptionTrades('BTC')
    expect(trades.map((t) => t.timestamp)).toEqual([100, 200])
  })
})
