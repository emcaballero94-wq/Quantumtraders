// Shared vocabulary for M.A.N.U. (Market Analysis & Navigation Unit). Every
// layer (market state, change detection, events, historical validation,
// brief formatting) speaks in these types so they can be composed and
// tested independently of the API route that wires them together.

export type ChangeClass = 'UNCHANGED' | 'SHIFTING' | 'ACCELERATING' | 'DECELERATING' | 'REVERSING' | 'ANOMALOUS'

export type Severity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

export type MarketRegime = 'TRENDING_UP' | 'TRENDING_DOWN' | 'RANGING' | 'VOLATILE' | 'UNKNOWN'

export type DataQuality = 'GOOD' | 'DEGRADED' | 'INSUFFICIENT'

export type SampleLabel = 'INSUFFICIENT_SAMPLE' | 'LIMITED_SAMPLE' | 'USABLE_SAMPLE' | 'ROBUST_SAMPLE'

export interface MarketState {
  asset: string
  timestamp: string

  price: number | null
  priceChange1m: number | null
  priceChange5m: number | null
  priceChange15m: number | null

  cvd: number | null
  cvdDelta1m: number | null
  cvdDelta5m: number | null

  funding: number | null
  fundingChange: number | null

  openInterest: number | null
  openInterestChange1m: number | null
  openInterestChange5m: number | null

  orderBookImbalance: number | null
  bidDepth: number | null
  askDepth: number | null
  spread: number | null

  liquidationNotional: number | null
  liquidationLong: number | null
  liquidationShort: number | null

  marketRegime: MarketRegime
  dataQuality: DataQuality
}

export type EventType =
  | 'PRICE_ACCELERATION'
  | 'PRICE_REVERSAL'
  | 'CVD_ACCELERATION'
  | 'CVD_REVERSAL'
  | 'PRICE_CVD_DIVERGENCE'
  | 'OI_BUILDUP'
  | 'OI_UNWINDING'
  | 'FUNDING_SHIFT'
  | 'BID_IMBALANCE'
  | 'ASK_IMBALANCE'
  | 'LIQUIDATION_SPIKE'
  | 'LIQUIDITY_WITHDRAWAL'
  | 'LIQUIDITY_INCREASE'
  | 'SPREAD_EXPANSION'
  | 'ABSORPTION_CANDIDATE'
  | 'ORDERFLOW_REGIME_CHANGE'

export interface MarketEvent {
  type: EventType
  timestamp: string
  severity: Severity
  asset: string
  evidence: string
  values: Record<string, number | string | null>
  previousValues: Record<string, number | string | null>
}

export interface RelationshipObservation {
  pair: string
  observation: string
  detail: string
}

export interface HorizonStats {
  gradedCount: number
  positiveRatePct: number | null
  meanReturnPct: number | null
  medianReturnPct: number | null
  maxFavorableExcursionPct: number | null
  maxAdverseExcursionPct: number | null
}

export interface HistoricalPatternMatch {
  sampleSize: number
  sampleLabel: SampleLabel
  matchScore: number
  fingerprint: Record<string, number>
  horizons: {
    '5m': HorizonStats
    '15m': HorizonStats
    '60m': HorizonStats
  }
}
