// Shared vocabulary for the GEX & Options brief — a lighter-weight sibling of
// lib/manu/* for Order Flow. That pipeline leans on a dense, continuously
// collected time series (a brief every ~60s) to do change detection and
// historical pattern matching; options chains don't move on that cadence; the
// only real history available is one snapshot per day
// (quantumtraders.gex_snapshots). So this brief compares today's live read
// against the most recent prior day instead of minute-over-minute deltas.

export interface OptionsChainSummary {
  totalVolume: number
  totalOpenInterest: number
  putCallVolumeRatio: number | null
  putCallOpenInterestRatio: number | null
  avgCallIv: number | null
  avgPutIv: number | null
  /** avgPutIv - avgCallIv. Positive means puts are pricing in more fear than calls (the usual skew). */
  ivSkew: number | null
}

export type GexRegime = 'POSITIVE' | 'NEGATIVE'

export type RegimeShift = 'UNCHANGED_POSITIVE' | 'UNCHANGED_NEGATIVE' | 'FLIPPED_TO_POSITIVE' | 'FLIPPED_TO_NEGATIVE'

export interface DayOverDayComparison {
  priorDate: string
  priorNetGex: number
  priorCallWallStrike: number | null
  priorPutWallStrike: number | null
  priorGammaFlip: number | null
  regimeShift: RegimeShift
  netGexChangePct: number | null
  callWallDeltaStrikes: number | null
  putWallDeltaStrikes: number | null
}

export type DataQuality = 'GOOD' | 'DEGRADED'

export interface GexBriefFacts {
  assetClass: 'equity' | 'crypto'
  symbol: string
  underlyingPrice: number
  netGex: number
  regime: GexRegime
  callWallStrike: number | null
  putWallStrike: number | null
  gammaFlip: number | null
  maxPainStrike: number | null
  contractsWithGamma: number
  totalContracts: number
  dataQuality: DataQuality
  chain: OptionsChainSummary
  dayOverDay: DayOverDayComparison | null
}
