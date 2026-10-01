import { computeGex, findGammaFlip, findWalls, type GexContract, type GexComputationResult, type GexProfilePoint } from './compute'

export interface GexMatrixExpiryInput {
  expiration: string
  yearsToExpiry: number
  contracts: GexContract[]
}

export interface GexMatrixExpiryResult {
  expiration: string
  yearsToExpiry: number
  result: GexComputationResult
}

// Call wall / put wall / gamma flip computed over the strike profile merged
// across every included expiration — the same regime-level read GammaGrid's
// heatmap shows above the strike×expiry grid ("Net GEX across N shown
// expiries"), distinct from each expiration's own per-expiry walls/flip.
export interface GexMatrixAggregate {
  profile: GexProfilePoint[]
  netGex: number
  callWallStrike: number | null
  putWallStrike: number | null
  gammaFlip: number | null
}

export interface GexMatrixResult {
  underlyingPrice: number
  expirations: GexMatrixExpiryResult[]
  aggregate: GexMatrixAggregate
}

export function computeGexMatrix(perExpiration: GexMatrixExpiryInput[], spot: number): GexMatrixResult {
  const expirations: GexMatrixExpiryResult[] = perExpiration.map(({ expiration, yearsToExpiry, contracts }) => ({
    expiration,
    yearsToExpiry,
    result: computeGex(contracts, spot, yearsToExpiry),
  }))

  const merged = new Map<number, { call: number; put: number }>()
  for (const { result } of expirations) {
    for (const point of result.profile) {
      const entry = merged.get(point.strike) ?? { call: 0, put: 0 }
      entry.call += point.callGex
      entry.put += point.putGex
      merged.set(point.strike, entry)
    }
  }

  const profile: GexProfilePoint[] = Array.from(merged.entries())
    .map(([strike, { call, put }]) => ({ strike, callGex: call, putGex: put, netGex: call + put }))
    .sort((a, b) => a.strike - b.strike)

  const netGex = profile.reduce((sum, p) => sum + p.netGex, 0)
  const { callWallStrike, putWallStrike } = findWalls(profile)

  return {
    underlyingPrice: spot,
    expirations,
    aggregate: {
      profile,
      netGex,
      callWallStrike,
      putWallStrike,
      gammaFlip: findGammaFlip(profile, spot),
    },
  }
}
