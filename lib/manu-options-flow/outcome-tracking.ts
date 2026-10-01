import type { OptionsFlowLean } from './types'

export type ActualDirection = 'up' | 'down' | 'flat'

// Moves smaller than this (either way) over the horizon count as "flat" —
// BTC/ETH chop a fraction of a percent constantly, so a hair-trigger band
// would call almost every BULLISH/BEARISH lean "wrong" on pure noise.
const FLAT_BAND_PCT = 1

export function classifyActualDirection(priceChangePct: number): ActualDirection {
  if (priceChangePct > FLAT_BAND_PCT) return 'up'
  if (priceChangePct < -FLAT_BAND_PCT) return 'down'
  return 'flat'
}

// A NEUTRAL lean is scored as correct when price stayed flat, not treated as
// an automatic pass or fail — it's a real prediction (low conviction either
// way), not an abstention.
export function wasLeanCorrect(lean: OptionsFlowLean, direction: ActualDirection): boolean {
  if (lean === 'BULLISH') return direction === 'up'
  if (lean === 'BEARISH') return direction === 'down'
  return direction === 'flat'
}

export interface OutcomeComputation {
  priceChangePct: number
  actualDirection: ActualDirection
  correct: boolean
}

export function computeOutcome(lean: OptionsFlowLean, priceAtBrief: number, priceAtOutcome: number): OutcomeComputation {
  const priceChangePct = ((priceAtOutcome - priceAtBrief) / priceAtBrief) * 100
  const actualDirection = classifyActualDirection(priceChangePct)
  return { priceChangePct, actualDirection, correct: wasLeanCorrect(lean, actualDirection) }
}
