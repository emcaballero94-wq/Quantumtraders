// Shared vocabulary for the Options Intelligence Engine. This layer is
// provider-agnostic on purpose — lib/options-flow/polygon-data.ts (or
// whatever vendor's client) is the only place that should know about a
// specific API's wire format. Everything below consumes/produces OptionTrade
// and its derived aggregates.
//
// Never invent a field the data source doesn't provide — use null instead.

export type OptionType = 'CALL' | 'PUT'
export type TradeSide = 'BUY' | 'SELL' | 'UNKNOWN'
export type ExecutionSide = 'AT_BID' | 'AT_ASK' | 'BETWEEN' | 'UNKNOWN'

export interface OptionTrade {
  symbol: string
  underlying: string
  /** Epoch milliseconds. */
  timestamp: number

  optionType: OptionType
  side: TradeSide

  strike: number
  /** ISO date (YYYY-MM-DD). */
  expiration: string
  /** Days to expiration at trade time, inclusive of the expiration day. */
  dte: number

  contracts: number

  /** price * contracts * 100, when price is known. */
  premium: number | null
  /** strike * contracts * 100 — a measure of notional exposure, independent of premium. */
  notional: number | null

  bid: number | null
  ask: number | null
  price: number | null

  executionSide: ExecutionSide

  impliedVolatility: number | null
  delta: number | null
  gamma: number | null
  theta: number | null
  vega: number | null

  openInterest: number | null
  volume: number | null

  /** Data provider identifier (e.g. 'polygon'), for provenance/debugging. */
  source: string
}

export type FlowDirection = 'BULLISH' | 'BEARISH' | 'NEUTRAL' | 'UNKNOWN'
export type Confidence = 'LOW' | 'MEDIUM' | 'HIGH'

export interface TradeClassification {
  direction: FlowDirection
  confidence: Confidence
  reason: string
}

export interface PremiumTotals {
  callPremium: number
  putPremium: number
  /** callPremium - putPremium. A magnitude, not a direction verdict by itself — see TradeClassification. */
  netPremium: number
  callContracts: number
  putContracts: number
  callVolumeTrades: number
  putVolumeTrades: number
  /** null when the denominator is zero or inputs are missing. */
  callPutRatioByPremium: number | null
  callPutRatioByContracts: number | null
  callPutRatioByTradeCount: number | null
}

export type DteBucketId = '0-1' | '2-7' | '8-30' | '31-60' | '60+'

export interface DteBucket {
  id: DteBucketId
  trades: OptionTrade[]
  totals: PremiumTotals
}

export type LargeTradeThresholdType = 'absolute' | 'percentile' | 'relative-to-session'

export interface LargeTradeThreshold {
  type: LargeTradeThresholdType
  /** Dollar premium for 'absolute'; 0-100 for 'percentile'; multiple of session mean for 'relative-to-session'. */
  value: number
}

export interface LargeTrade {
  trade: OptionTrade
  classification: TradeClassification
  thresholdType: LargeTradeThresholdType
}

export interface StrikeConcentrationLevel {
  strike: number
  callPremium: number
  putPremium: number
  callContracts: number
  putContracts: number
  callVolumeTrades: number
  putVolumeTrades: number
  callOpenInterest: number | null
  putOpenInterest: number | null
  /** callPremium - putPremium at this strike — magnitude only, same caveat as PremiumTotals.netPremium. */
  netDirectionalPressure: number
}

export interface KeyStrike {
  strike: number
  level: StrikeConcentrationLevel
  /** Share (0-1) of total premium across all strikes concentrated here. */
  shareOfTotalPremium: number
}

export interface FlowWindow {
  windowMinutes: number
  /** Epoch ms of the window's end (its "now"). */
  endTimestamp: number
  totals: PremiumTotals
  tradeCount: number
  largeTrades: LargeTrade[]
}

export type AccelerationDirection = 'INCREASING' | 'DECREASING' | 'FLAT'

export interface FlowAccelerationEvent {
  direction: AccelerationDirection
  /** Signed percent change of the tracked premium bucket (bullish or bearish) between the two windows. Null when the baseline window had zero premium. */
  magnitudePct: number | null
  windowMinutes: number
  previousPremium: number
  currentPremium: number
  confidence: Confidence
}

export type OptionsFlowEventType =
  | 'OPTIONS_FLOW_SHIFT'
  | 'LARGE_OPTIONS_TRADE'
  | 'STRIKE_CONCENTRATION'
  | 'FLOW_ACCELERATION'
  | 'FLOW_REVERSAL'
  | 'UNUSUAL_VOLUME'
  | 'UNUSUAL_PREMIUM'
  | 'EXPIRATION_CLUSTER'
  | 'CALL_PREMIUM_SPIKE'
  | 'PUT_PREMIUM_SPIKE'

export interface OptionsFlowEvent {
  type: OptionsFlowEventType
  timestamp: number
  magnitude: number | null
  previousState: unknown
  currentState: unknown
  significance: Confidence
  confidence: Confidence
  evidence: string
}

export type DataQuality = 'GOOD' | 'DEGRADED'

export interface OptionsFlowScore {
  /** 0-100. Avoid false precision — callers should round for display. */
  value: number
  confidence: Confidence
  dataQuality: DataQuality
  /** Named contributions that fed the score, for transparency (never shown as if it were ground truth, just a breakdown of the deterministic formula). */
  components: Record<string, number>
}
