import { classifyTrade } from './classification'
import type { LargeTrade, LargeTradeThreshold, OptionTrade } from './types'

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.ceil((p / 100) * sorted.length) - 1
  return sorted[Math.max(0, Math.min(sorted.length - 1, index))]
}

function mean(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((sum, v) => sum + v, 0) / values.length
}

// Supports three threshold styles per the spec — a single fixed dollar
// amount misses both quiet days (nothing ever qualifies) and busy ones
// (everything does), so callers pick what fits the session.
export function detectLargeTrades(trades: OptionTrade[], threshold: LargeTradeThreshold): LargeTrade[] {
  const premiums = trades.map((t) => t.premium).filter((p): p is number => p !== null)

  let cutoff: number
  switch (threshold.type) {
    case 'absolute':
      cutoff = threshold.value
      break
    case 'percentile':
      cutoff = percentile(premiums, threshold.value)
      break
    case 'relative-to-session':
      cutoff = mean(premiums) * threshold.value
      break
  }

  return trades
    .filter((trade) => trade.premium !== null && trade.premium >= cutoff)
    .map((trade) => ({
      trade,
      classification: classifyTrade(trade),
      thresholdType: threshold.type,
    }))
    .sort((a, b) => (b.trade.premium ?? 0) - (a.trade.premium ?? 0))
}
