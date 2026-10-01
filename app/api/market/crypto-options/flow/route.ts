import { NextResponse } from 'next/server'
import { fetchRecentDeribitOptionTrades } from '@/lib/options-flow/deribit-source'
import { aggregatePremium, aggregateDirectionalPremium } from '@/lib/options-flow/aggregation'
import { detectLargeTrades } from '@/lib/options-flow/large-trades'
import { computeStrikeConcentration, identifyKeyStrikes } from '@/lib/options-flow/strike-concentration'
import { computeFlowAcceleration } from '@/lib/options-flow/change-engine'
import { computeOptionsFlowScore } from '@/lib/options-flow/score'
import { computeCumulativeNetPremiumSeries } from '@/lib/options-flow/net-premium-series'
import { rejectIfRateLimited } from '@/lib/server/endpoint-guards'
import type { CryptoCurrency } from '@/lib/manu/crypto-symbol-mapping'

const WINDOW_MINUTES = 15
const LARGE_TRADE_PERCENTILE = 90
const MAX_LARGE_TRADES_RETURNED = 15
const MAX_KEY_STRIKES_RETURNED = 5
const NET_PREMIUM_BUCKET_MINUTES = 15
const NET_PREMIUM_MAX_BUCKETS = 40

export async function GET(request: Request) {
  const blocked = rejectIfRateLimited(request, {
    routeKey: 'market-crypto-options-flow',
    limit: 60,
    windowMs: 60_000,
  })
  if (blocked) return blocked

  const { searchParams } = new URL(request.url)
  const currencyParam = searchParams.get('currency')?.trim().toUpperCase()
  if (currencyParam !== 'BTC' && currencyParam !== 'ETH') {
    return NextResponse.json({ success: false, error: 'currency must be BTC or ETH' }, { status: 400 })
  }
  const currency: CryptoCurrency = currencyParam

  try {
    const trades = await fetchRecentDeribitOptionTrades(currency)
    const now = Date.now()

    const totals = aggregatePremium(trades)
    const directional = aggregateDirectionalPremium(trades)
    const largeTrades = detectLargeTrades(trades, { type: 'percentile', value: LARGE_TRADE_PERCENTILE })

    // Track whichever side currently carries more classified premium —
    // acceleration asks "is THIS lean speeding up or fading", not both at once.
    const trackedDirection: 'BULLISH' | 'BEARISH' =
      directional.bearishPremium > directional.bullishPremium ? 'BEARISH' : 'BULLISH'
    const acceleration = computeFlowAcceleration(trades, now, WINDOW_MINUTES, trackedDirection)

    const score = computeOptionsFlowScore({ trades, acceleration, largeTrades })

    const strikeLevels = computeStrikeConcentration(trades)
    const keyStrikes = identifyKeyStrikes(strikeLevels, MAX_KEY_STRIKES_RETURNED)

    const netPremiumSeries = computeCumulativeNetPremiumSeries(
      trades,
      NET_PREMIUM_BUCKET_MINUTES,
      NET_PREMIUM_MAX_BUCKETS,
    )

    return NextResponse.json({
      success: true,
      currency,
      source: 'deribit',
      tradeCount: trades.length,
      oldestTradeAt: trades[0]?.timestamp ?? null,
      newestTradeAt: trades[trades.length - 1]?.timestamp ?? null,
      totals,
      directional,
      score,
      acceleration: { ...acceleration, trackedDirection },
      largeTrades: largeTrades.slice(0, MAX_LARGE_TRADES_RETURNED).map((lt) => ({
        symbol: lt.trade.symbol,
        optionType: lt.trade.optionType,
        strike: lt.trade.strike,
        expiration: lt.trade.expiration,
        dte: lt.trade.dte,
        contracts: lt.trade.contracts,
        premium: lt.trade.premium,
        side: lt.trade.side,
        timestamp: lt.trade.timestamp,
        classification: lt.classification,
      })),
      keyStrikes: keyStrikes.map((k) => ({
        strike: k.strike,
        callPremium: k.level.callPremium,
        putPremium: k.level.putPremium,
        netDirectionalPressure: k.level.netDirectionalPressure,
        shareOfTotalPremium: k.shareOfTotalPremium,
      })),
      netPremiumSeries,
      generatedAt: now,
    })
  } catch (error) {
    console.error('[/api/market/crypto-options/flow] Error:', error)
    return NextResponse.json({ success: false, error: 'Failed to compute options flow' }, { status: 502 })
  }
}
