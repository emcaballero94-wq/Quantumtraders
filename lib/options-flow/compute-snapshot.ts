import { fetchRecentDeribitOptionTrades } from './deribit-source'
import { aggregatePremium, aggregateDirectionalPremium, type DirectionalPremiumTotals } from './aggregation'
import { detectLargeTrades } from './large-trades'
import { computeStrikeConcentration, identifyKeyStrikes } from './strike-concentration'
import { computeFlowAcceleration } from './change-engine'
import { computeOptionsFlowScore } from './score'
import { computeCumulativeNetPremiumSeries, type NetPremiumPoint } from './net-premium-series'
import { filterNoiseTrades } from './noise-filter'
import { fetchMarketQuotes } from '@/lib/market-data'
import type { CryptoCurrency } from '@/lib/manu/crypto-symbol-mapping'
import type { KeyStrike, LargeTrade, OptionsFlowScore, PremiumTotals } from './types'

const WINDOW_MINUTES = 15
const LARGE_TRADE_PERCENTILE = 90
const NET_PREMIUM_BUCKET_MINUTES = 15
const NET_PREMIUM_MAX_BUCKETS = 40

const SPOT_QUOTE_SYMBOL: Record<CryptoCurrency, string> = { BTC: 'BTCUSD', ETH: 'ETHUSD' }

// Shared by the flow API route and the M.A.N.U. brief — both need "what's
// BTC/ETH actually worth right now" and should get it from the same place,
// the same way the rest of the app already prices these pairs.
export async function fetchCryptoSpotPriceUsd(currency: CryptoCurrency): Promise<number | null> {
  try {
    const [quote] = await fetchMarketQuotes([SPOT_QUOTE_SYMBOL[currency]])
    return quote?.price ?? null
  } catch (error) {
    console.error(`[fetchCryptoSpotPriceUsd] Failed to fetch spot price for ${currency}:`, error)
    return null
  }
}

export interface OptionsFlowSnapshot {
  currency: CryptoCurrency
  /** Null when the spot quote fetch failed — the noise filter's OTM check and the outcome tracker both degrade gracefully without it, never guessing a price. */
  spotPriceUsd: number | null
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
  /**
   * "Adjusted" = totals.{call,put}Premium recomputed excluding trades
   * lib/options-flow/noise-filter.ts flags as likely lottery/noise activity.
   * Exposed alongside `totals`, never in place of it — see
   * docs/mando-v2-roadmap.md §1 on why raw and adjusted must both survive.
   */
  noise: {
    /** Share (0-100) of total contracts classified as noise. Null when there are no trades. */
    noiseContractsPct: number | null
    adjustedTotals: PremiumTotals
  }
  generatedAt: number
}

// Single source of truth for "what does the current Options Flow look like"
// — reused by the /api/market/crypto-options/flow endpoint (raw display
// data) and the M.A.N.U. Options Flow brief (narrative facts), so the two
// never drift into computing the score or large trades differently.
export async function computeOptionsFlowSnapshot(currency: CryptoCurrency): Promise<OptionsFlowSnapshot> {
  const [trades, spotPriceUsd] = await Promise.all([
    fetchRecentDeribitOptionTrades(currency),
    fetchCryptoSpotPriceUsd(currency),
  ])
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

  const { nonNoiseTrades, noiseContractsPct } = filterNoiseTrades(trades, spotPriceUsd)
  const adjustedTotals = aggregatePremium(nonNoiseTrades)

  return {
    currency,
    spotPriceUsd,
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
    noise: { noiseContractsPct, adjustedTotals },
    generatedAt: now,
  }
}
