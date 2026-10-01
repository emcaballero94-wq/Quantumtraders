// Shared vocabulary for the Options Flow brief — the M.A.N.U. narration layer
// on top of the deterministic lib/options-flow/ engine. Same split as GEX's
// brief (lib/manu-gex/): the backend computes every number, the AI (or the
// deterministic fallback) only narrates it. Unlike GEX, there's no
// once-a-day snapshot to diff against — /api/market/crypto-options/flow
// recomputes from the latest ~1000 Deribit trades on every call, so this
// brief is self-contained per request rather than day-over-day.

export type OptionsFlowLean = 'BULLISH' | 'BEARISH' | 'NEUTRAL'

export interface OptionsFlowLargeTradeFact {
  optionType: 'CALL' | 'PUT'
  strike: number
  side: 'BUY' | 'SELL' | 'UNKNOWN'
  premium: number | null
  dte: number
  direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL' | 'UNKNOWN'
}

export interface OptionsFlowKeyStrikeFact {
  strike: number
  shareOfTotalPremium: number
  netDirectionalPressure: number
}

export interface OptionsFlowAccelerationFact {
  direction: 'INCREASING' | 'DECREASING' | 'FLAT'
  magnitudePct: number | null
  trackedDirection: 'BULLISH' | 'BEARISH'
  windowMinutes: number
}

export interface OptionsFlowBriefFacts {
  currency: 'BTC' | 'ETH'
  /** Spot price (USD) at brief-generation time — null if the quote fetch failed. Needed to score the brief's lean against what price actually did later (see outcome-tracking.ts); never invented when unavailable. */
  underlyingPriceUsd: number | null
  tradeCount: number
  score: number
  scoreConfidence: 'LOW' | 'MEDIUM' | 'HIGH'
  dataQuality: 'GOOD' | 'DEGRADED'
  bullishPremium: number
  bearishPremium: number
  callPremium: number
  putPremium: number
  callPutRatio: number | null
  acceleration: OptionsFlowAccelerationFact | null
  largeTradeCount: number
  topLargeTrades: OptionsFlowLargeTradeFact[]
  keyStrikes: OptionsFlowKeyStrikeFact[]
}
