import type { OptionTrade } from './types'

// Crypto-native "lottery ticket" heuristic — adapted from, not ported from,
// ai-investment-skills' lottery filter (see docs/mando-v2-roadmap.md §1).
// That repo's only tested rule was `bid <= 0.05 && ask <= 0.05` on equity
// options, which needs Polygon-grade NBBO data we don't have: Deribit's
// public trade feed (lib/options-flow/deribit-source.ts) carries no bid/ask,
// only the executed price/premium. So instead of a bid/ask price cap, this
// flags a trade as likely noise when either:
//   - its total premium is below a flat dollar floor (a real position-sized
//     bet, however the contract is priced, clears this easily), or
//   - it's both deep out-of-the-money AND short-dated — the classic "cheap,
//     far-out, about-to-expire" speculative pattern.
// Unlike the source repo (calls only), this applies to both calls and puts
// — a cheap, deep-OTM, short-dated put is just as much a lottery ticket as
// a call.
//
// These thresholds are a starting point, not a validated universal truth —
// per the roadmap doc, they need calibration against real Deribit sessions
// before being trusted the way the repo's author calibrated theirs over 17
// tickers and 2 months. Treat the "adjusted" numbers this produces as a
// second opinion alongside the raw ones, never a replacement — the raw
// numbers stay exactly as they were.
export const NOISE_PREMIUM_FLOOR_USD = 50
export const NOISE_DEEP_OTM_PCT = 0.4
export const NOISE_SHORT_DTE_DAYS = 7

export interface NoiseClassification {
  isNoise: boolean
  reason: string | null
}

export function classifyNoise(trade: OptionTrade, spotPriceUsd: number | null): NoiseClassification {
  if (trade.premium !== null && trade.premium < NOISE_PREMIUM_FLOOR_USD) {
    return { isNoise: true, reason: `premium below $${NOISE_PREMIUM_FLOOR_USD} floor` }
  }

  if (spotPriceUsd !== null && spotPriceUsd > 0) {
    const otmPct = Math.abs(trade.strike - spotPriceUsd) / spotPriceUsd
    if (otmPct > NOISE_DEEP_OTM_PCT && trade.dte <= NOISE_SHORT_DTE_DAYS) {
      return { isNoise: true, reason: `>${Math.round(NOISE_DEEP_OTM_PCT * 100)}% OTM with ${trade.dte} DTE left` }
    }
  }

  return { isNoise: false, reason: null }
}

export interface NoiseFilterResult {
  nonNoiseTrades: OptionTrade[]
  noiseTrades: OptionTrade[]
  /** Share (0-100) of total contracts (calls + puts) classified as noise. Null when there are no trades at all. */
  noiseContractsPct: number | null
}

// Splits by contracts (not trade count or dollar premium) — a few trades
// with huge contract counts dominate real flow, so weighting by headcount
// would understate their share same as weighting by premium would overstate
// cheap-but-large-size lottery activity.
export function filterNoiseTrades(trades: OptionTrade[], spotPriceUsd: number | null): NoiseFilterResult {
  const nonNoiseTrades: OptionTrade[] = []
  const noiseTrades: OptionTrade[] = []

  for (const trade of trades) {
    if (classifyNoise(trade, spotPriceUsd).isNoise) {
      noiseTrades.push(trade)
    } else {
      nonNoiseTrades.push(trade)
    }
  }

  const totalContracts = trades.reduce((sum, t) => sum + t.contracts, 0)
  const noiseContracts = noiseTrades.reduce((sum, t) => sum + t.contracts, 0)

  return {
    nonNoiseTrades,
    noiseTrades,
    noiseContractsPct: totalContracts > 0 ? (noiseContracts / totalContracts) * 100 : null,
  }
}
