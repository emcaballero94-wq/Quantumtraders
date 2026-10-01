import { NextResponse } from 'next/server'
import { computeOptionsFlowSnapshot } from '@/lib/options-flow/compute-snapshot'
import { rejectIfRateLimited } from '@/lib/server/endpoint-guards'
import type { CryptoCurrency } from '@/lib/manu/crypto-symbol-mapping'

const MAX_LARGE_TRADES_RETURNED = 15

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
    const snapshot = await computeOptionsFlowSnapshot(currency)

    return NextResponse.json({
      success: true,
      currency: snapshot.currency,
      source: 'deribit',
      tradeCount: snapshot.tradeCount,
      oldestTradeAt: snapshot.oldestTradeAt,
      newestTradeAt: snapshot.newestTradeAt,
      totals: snapshot.totals,
      directional: snapshot.directional,
      score: snapshot.score,
      acceleration: snapshot.acceleration,
      largeTrades: snapshot.largeTrades.slice(0, MAX_LARGE_TRADES_RETURNED).map((lt) => ({
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
      keyStrikes: snapshot.keyStrikes.map((k) => ({
        strike: k.strike,
        callPremium: k.level.callPremium,
        putPremium: k.level.putPremium,
        netDirectionalPressure: k.level.netDirectionalPressure,
        shareOfTotalPremium: k.shareOfTotalPremium,
      })),
      netPremiumSeries: snapshot.netPremiumSeries,
      generatedAt: snapshot.generatedAt,
    })
  } catch (error) {
    console.error('[/api/market/crypto-options/flow] Error:', error)
    return NextResponse.json({ success: false, error: 'Failed to compute options flow' }, { status: 502 })
  }
}
