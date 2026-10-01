import { aggregateDirectionalPremium } from './aggregation'
import { computeStrikeConcentration, identifyKeyStrikes } from './strike-concentration'
import type { Confidence, DataQuality, FlowAccelerationEvent, LargeTrade, OptionTrade, OptionsFlowScore } from './types'

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

// A deterministic 0-100 "Options Pressure Score" — the backend computes this,
// never the AI (section 16/18 of the spec). It's a weighted blend of four
// components, each already 0-100 on its own:
//   - directionalBias: net lean of classified premium (50 = balanced)
//   - accelerationBoost: how fast that lean is building (50 = steady)
//   - largeTradeConcentration: how much of total premium sits in large trades
//   - strikeConcentration: how much of total premium sits in the top 3 strikes
// Weights (0.4/0.25/0.2/0.15) favor direction and its momentum over where
// the capital happens to sit — concentration alone doesn't say which way.
export function computeOptionsFlowScore(input: {
  trades: OptionTrade[]
  acceleration: FlowAccelerationEvent | null
  largeTrades: LargeTrade[]
}): OptionsFlowScore {
  const { trades, acceleration, largeTrades } = input
  const directional = aggregateDirectionalPremium(trades)
  const totalDirectionalPremium = directional.bullishPremium + directional.bearishPremium

  const directionalBias =
    totalDirectionalPremium > 0
      ? 50 + 50 * ((directional.bullishPremium - directional.bearishPremium) / totalDirectionalPremium)
      : 50

  const accelerationBoost = acceleration?.magnitudePct != null ? 50 + clamp(acceleration.magnitudePct, -50, 50) : 50

  const totalPremium = trades.reduce((sum, t) => sum + (t.premium ?? 0), 0)
  const largeTradePremium = largeTrades.reduce((sum, lt) => sum + (lt.trade.premium ?? 0), 0)
  const largeTradeConcentration = totalPremium > 0 ? clamp((largeTradePremium / totalPremium) * 200, 0, 100) : 0

  const levels = computeStrikeConcentration(trades)
  const keyStrikes = identifyKeyStrikes(levels, 3)
  const topStrikesShare = keyStrikes.reduce((sum, k) => sum + k.shareOfTotalPremium, 0)
  const strikeConcentrationScore = clamp(topStrikesShare * 100, 0, 100)

  const value = clamp(
    0.4 * directionalBias + 0.25 * accelerationBoost + 0.2 * largeTradeConcentration + 0.15 * strikeConcentrationScore,
    0,
    100,
  )

  const classifiedCount = directional.bullishTradeCount + directional.bearishTradeCount
  const dataQuality: DataQuality = totalPremium > 0 && classifiedCount > 0 ? 'GOOD' : 'DEGRADED'
  const confidence: Confidence = trades.length >= 30 ? 'HIGH' : trades.length >= 8 ? 'MEDIUM' : 'LOW'

  return {
    value: Math.round(value),
    confidence,
    dataQuality,
    components: {
      directionalBias: Math.round(directionalBias),
      accelerationBoost: Math.round(accelerationBoost),
      largeTradeConcentration: Math.round(largeTradeConcentration),
      strikeConcentration: Math.round(strikeConcentrationScore),
    },
  }
}
