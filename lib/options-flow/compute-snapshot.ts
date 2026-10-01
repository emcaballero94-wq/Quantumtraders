import { fetchRecentDeribitOptionTrades } from './deribit-source'
import { aggregatePremium, aggregateDirectionalPremium, type DirectionalPremiumTotals } from './aggregation'
import { detectLargeTrades } from './large-trades'
import { computeStrikeConcentration, identifyKeyStrikes } from './strike-concentration'
import { computeFlowAcceleration } from './change-engine'
import { computeOptionsFlowScore } from './score'
import { computeCumulativeNetPremiumSeries, type NetPremiumPoint } from './net-premium-series'
import type { CryptoCurrency } from '@/lib/manu/crypto-symbol-mapping'
import type { KeyStrike, LargeTrade, OptionsFlowScore, PremiumTotals } from './types'

const WINDOW_MINUTES = 15
const LARGE_TRADE_PERCENTILE = 90
const NET_PREMIUM_BUCKET_MINUTES = 15
const NET_PREMIUM_MAX_BUCKETS = 40

export interface OptionsFlowSnapshot {
  currency: CryptoCurrency
  tradeCount: number
  oldestTradeAt: number | null
  newestTradeAt: number | null
  totals: PremiumTotals
  directional: DirectionalPremiumTotals
  score: OptionsFlowScore
  acceleration: ReturnType<typeof computeFlowAcceleration> & { trackedDirection: 'BULLISH' | 'BEARISH' }
  largeTrades: LargeTrade[]
  keyStrikes: KeyStrike[]
  netPremiumSeries: NetPremiumPoint[]
  generatedAt: number
}

// Single source of truth for "what does the current Options Flow look like"
// — reused by the /api/market/crypto-options/flow endpoint (raw display
// data) and the M.A.N.U. Options Flow brief (narrative facts), so the two
// never drift into computing the score or large trades differently.
export async function computeOptionsFlowSnapshot(currency: CryptoCurrency): Promise<OptionsFlowSnapshot> {
  const trades = await fetchRecentDeribitOptionTrades(currency)
  const now = Date.now()

  const totals = aggregatePremium(trades)
  const directional = aggregateDirectionalPremium(trades)
  const largeTrades = detectLargeTrades(trades, { type: 'percentile', value: LARGE_TRADE_PERCENTILE })

  const trackedDirection: 'BULLISH' | 'BEARISH' = directional.bearishPremium > directional.bullishPremium ? 'BEARISH' : 'BULLISH'
  const acceleration = computeFlowAcceleration(trades, now, WINDOW_MINUTES, trackedDirection)

  const score = computeOptionsFlowScore({ trades, acceleration, largeTrades })

  const strikeLevels = computeStrikeConcentration(trades)
  const keyStrikes = identifyKeyStrikes(strikeLevels, 5)

  const netPremiumSeries = computeCumulativeNetPremiumSeries(trades, NET_PREMIUM_BUCKET_MINUTES, NET_PREMIUM_MAX_BUCKETS)

  return {
    currency,
    tradeCount: trades.length,
    oldestTradeAt: trades[0]?.timestamp ?? null,
    newestTradeAt: trades[trades.length - 1]?.timestamp ?? null,
    totals,
    directional,
    score,
    acceleration: { ...acceleration, trackedDirection },
    largeTrades,
    keyStrikes,
    netPremiumSeries,
    generatedAt: now,
  }
}
