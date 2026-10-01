import { blackScholesGreeks, solveImpliedVolatility, type OptionType } from './black-scholes'

export interface GexContract {
  strike: number
  optionType: OptionType
  openInterest: number
  /** Gamma already reported by the data source (Tradier/Deribit), when available. */
  gamma: number | null
  /** Implied volatility already reported by the source, used before solving our own. */
  iv: number | null
  /** Last traded price, used to solve IV when the source didn't report gamma or IV. */
  last: number | null
}

export interface GexProfilePoint {
  strike: number
  callGex: number
  /** Always <= 0 — puts contribute negative dealer gamma in this convention. */
  putGex: number
  netGex: number
}

export interface GexComputationResult {
  profile: GexProfilePoint[]
  netGex: number
  callWallStrike: number | null
  putWallStrike: number | null
  gammaFlip: number | null
  maxPainStrike: number | null
  /** How many contracts actually priced (had or could be given a usable gamma) vs. the whole chain. */
  contractsWithGamma: number
  totalContracts: number
}

const CONTRACT_MULTIPLIER = 100
const DEFAULT_RISK_FREE_RATE = 0.045
const DEFAULT_DIVIDEND_YIELD = 0

interface ResolveGammaInput {
  contract: GexContract
  spot: number
  yearsToExpiry: number
  riskFreeRate?: number
  dividendYield?: number
}

// Prefers the source's own reported gamma (both Tradier and Deribit report
// real greeks on most liquid contracts) — only solves IV from the last price
// and prices our own Black-Scholes gamma when the source didn't provide one.
export function resolveGamma({
  contract,
  spot,
  yearsToExpiry,
  riskFreeRate = DEFAULT_RISK_FREE_RATE,
  dividendYield = DEFAULT_DIVIDEND_YIELD,
}: ResolveGammaInput): number | null {
  if (contract.gamma !== null && Number.isFinite(contract.gamma) && contract.gamma !== 0) {
    return contract.gamma
  }

  const iv =
    contract.iv !== null && Number.isFinite(contract.iv) && contract.iv > 0
      ? contract.iv
      : contract.last !== null && contract.last > 0
        ? solveImpliedVolatility(contract.last, {
            spot,
            strike: contract.strike,
            yearsToExpiry,
            riskFreeRate,
            dividendYield,
            optionType: contract.optionType,
          })
        : null

  if (iv === null) return null

  return blackScholesGreeks({
    spot,
    strike: contract.strike,
    yearsToExpiry,
    iv,
    riskFreeRate,
    dividendYield,
    optionType: contract.optionType,
  }).gamma
}

// A crossing is only real between two strictly-signed cumulative totals — a
// strike carrying no exposure reads as exactly 0, and a 0 → negative step is
// the profile merely LEAVING the flat zero region it was already in, not a
// sign change. Chains with nothing listed far from the money would otherwise
// report a flip level at the edge of the chain instead of "no flip here".
// Exported so the multi-expiration matrix (lib/gex/matrix.ts) can run the same
// rule over a strike profile merged across expirations, instead of duplicating it.
export function findGammaFlip(profile: GexProfilePoint[], spot: number): number | null {
  if (profile.length < 2) return null

  let cumulative = 0
  const points = profile.map((p) => {
    cumulative += p.netGex
    return { strike: p.strike, cumulative }
  })

  const crossings: number[] = []
  for (let i = 1; i < points.length; i += 1) {
    const prev = points[i - 1]
    const curr = points[i]
    if (prev.cumulative === 0 || curr.cumulative === 0) continue
    if (Math.sign(prev.cumulative) === Math.sign(curr.cumulative)) continue

    const span = curr.strike - prev.strike
    const ratio = Math.abs(prev.cumulative) / (Math.abs(prev.cumulative) + Math.abs(curr.cumulative))
    crossings.push(prev.strike + ratio * span)
  }

  if (crossings.length === 0) return null
  // The chain can cross zero several times far from the money — the crossing
  // that answers "how far is the regime change from here" is the one nearest
  // the current price, not the first or deepest one.
  return crossings.reduce((closest, c) => (Math.abs(c - spot) < Math.abs(closest - spot) ? c : closest))
}

// The strike at which total payout to option holders (sum of intrinsic value
// times open interest, across both calls and puts) is smallest — the
// settlement price that costs option sellers the least. O(strikes^2), fine
// for a single expiration's chain (tens of strikes).
function findMaxPain(contracts: GexContract[]): number | null {
  const strikes = Array.from(new Set(contracts.map((c) => c.strike))).sort((a, b) => a - b)
  if (strikes.length === 0) return null

  let bestStrike: number | null = null
  let bestPayout = Infinity
  let anyOpenInterest = false

  for (const settlement of strikes) {
    let payout = 0
    for (const contract of contracts) {
      const oi = contract.openInterest ?? 0
      if (oi <= 0) continue
      anyOpenInterest = true
      payout += contract.optionType === 'call' ? Math.max(settlement - contract.strike, 0) * oi : Math.max(contract.strike - settlement, 0) * oi
    }
    if (payout < bestPayout) {
      bestPayout = payout
      bestStrike = settlement
    }
  }

  // No open interest anywhere means every settlement price pays out exactly
  // zero — picking the minimum would just return the lowest strike in the
  // chain, a confident and meaningless number. Honest answer: no max pain yet.
  return anyOpenInterest ? bestStrike : null
}

// The call wall is the strike with the largest positive call-side exposure,
// the put wall the strike with the largest put-side exposure magnitude.
// Exported so the multi-expiration matrix can find the same walls over a
// strike profile merged across expirations.
export function findWalls(profile: GexProfilePoint[]): { callWallStrike: number | null; putWallStrike: number | null } {
  let callWallStrike: number | null = null
  let maxCallGex = -Infinity
  let putWallStrike: number | null = null
  let maxPutMagnitude = -Infinity

  for (const point of profile) {
    if (point.callGex > maxCallGex) {
      maxCallGex = point.callGex
      callWallStrike = point.strike
    }
    const putMagnitude = -point.putGex
    if (putMagnitude > maxPutMagnitude) {
      maxPutMagnitude = putMagnitude
      putWallStrike = point.strike
    }
  }

  return { callWallStrike, putWallStrike }
}

// Dealer-positioning sign convention used across public GEX tools: calls
// contribute positive dealer gamma, puts negative ("dealers are net long
// calls / net short puts versus retail flow"). This is a standard heuristic
// approximation, NOT a measure of actual market-maker positions — those
// aren't public data. Surface that caveat in the UI, not just here.
export function computeGex(contracts: GexContract[], spot: number, yearsToExpiry: number): GexComputationResult {
  const byStrike = new Map<number, { call: number; put: number }>()
  let contractsWithGamma = 0

  for (const contract of contracts) {
    const gamma = resolveGamma({ contract, spot, yearsToExpiry })
    if (gamma === null) continue
    contractsWithGamma += 1

    const contractGex = gamma * (contract.openInterest ?? 0) * CONTRACT_MULTIPLIER * spot
    const entry = byStrike.get(contract.strike) ?? { call: 0, put: 0 }
    if (contract.optionType === 'call') entry.call += contractGex
    else entry.put -= contractGex
    byStrike.set(contract.strike, entry)
  }

  const profile: GexProfilePoint[] = Array.from(byStrike.entries())
    .map(([strike, { call, put }]) => ({ strike, callGex: call, putGex: put, netGex: call + put }))
    .sort((a, b) => a.strike - b.strike)

  const netGex = profile.reduce((sum, p) => sum + p.netGex, 0)
  const { callWallStrike, putWallStrike } = findWalls(profile)

  return {
    profile,
    netGex,
    callWallStrike,
    putWallStrike,
    gammaFlip: findGammaFlip(profile, spot),
    maxPainStrike: findMaxPain(contracts),
    contractsWithGamma,
    totalContracts: contracts.length,
  }
}
