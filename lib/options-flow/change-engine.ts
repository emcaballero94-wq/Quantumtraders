import { aggregateDirectionalPremium, filterByWindow, type DirectionalPremiumTotals } from './aggregation'
import type { AccelerationDirection, Confidence, FlowAccelerationEvent, OptionTrade } from './types'

const FLAT_THRESHOLD_PCT = 5

// Tracks the classified (not raw call/put) bullish or bearish premium across
// two equal-length windows — "is the flow in this direction speeding up,
// slowing down, or steady?" per the spec's Flow Acceleration section.
export function computeFlowAcceleration(
  allTrades: OptionTrade[],
  endTimestamp: number,
  windowMinutes: number,
  direction: 'BULLISH' | 'BEARISH',
): FlowAccelerationEvent {
  const currentTrades = filterByWindow(allTrades, endTimestamp, windowMinutes)
  const previousTrades = filterByWindow(allTrades, endTimestamp - windowMinutes * 60_000, windowMinutes)

  const current = aggregateDirectionalPremium(currentTrades)
  const previous = aggregateDirectionalPremium(previousTrades)

  const key: keyof DirectionalPremiumTotals = direction === 'BULLISH' ? 'bullishPremium' : 'bearishPremium'
  const previousPremium = previous[key]
  const currentPremium = current[key]

  const magnitudePct = previousPremium > 0 ? ((currentPremium - previousPremium) / previousPremium) * 100 : null

  let accelDirection: AccelerationDirection
  if (magnitudePct === null) {
    accelDirection = currentPremium > 0 ? 'INCREASING' : 'FLAT'
  } else if (magnitudePct > FLAT_THRESHOLD_PCT) {
    accelDirection = 'INCREASING'
  } else if (magnitudePct < -FLAT_THRESHOLD_PCT) {
    accelDirection = 'DECREASING'
  } else {
    accelDirection = 'FLAT'
  }

  const tradeCount = currentTrades.length + previousTrades.length
  const confidence: Confidence = tradeCount >= 20 ? 'HIGH' : tradeCount >= 5 ? 'MEDIUM' : 'LOW'

  return {
    direction: accelDirection,
    magnitudePct,
    windowMinutes,
    previousPremium,
    currentPremium,
    confidence,
  }
}
