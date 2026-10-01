import { classifyTrade } from './classification'
import type { OptionTrade } from './types'

export interface NetPremiumPoint {
  /** Epoch ms marking the end of this bucket. */
  bucketEnd: number
  /** Classified (bullish - bearish) premium within this bucket alone. */
  netPremium: number
  /** Running total from the start of the returned window through this bucket. */
  cumulativeNetPremium: number
}

// Buckets classified premium (bullish - bearish, per classification.ts — not
// raw call/put) into fixed-size time windows and accumulates it, powering a
// "is flow turning more bullish or bearish" sparkline. Neutral/unknown-
// classified trades don't move the line either way.
//
// Bounded to the most recent `maxBuckets` windows ending at the latest
// trade's bucket — a single quiet trade from hours earlier won't blow up
// the series into thousands of mostly-empty buckets. Trades older than that
// window are simply excluded (the cumulative total starts at 0 at the
// window's edge, not from all-time) — this is "recent flow momentum", not a
// full-history ledger.
export function computeCumulativeNetPremiumSeries(
  trades: OptionTrade[],
  bucketMinutes: number,
  maxBuckets = 40,
): NetPremiumPoint[] {
  if (trades.length === 0) return []

  const bucketMs = bucketMinutes * 60_000
  const lastTimestamp = trades[trades.length - 1].timestamp
  const lastBucketStart = Math.floor(lastTimestamp / bucketMs) * bucketMs
  const firstBucketStart = lastBucketStart - (maxBuckets - 1) * bucketMs

  const netByBucket = new Map<number, number>()
  for (const trade of trades) {
    if (trade.timestamp < firstBucketStart) continue

    const classification = classifyTrade(trade)
    if (classification.direction !== 'BULLISH' && classification.direction !== 'BEARISH') continue

    const premium = trade.premium ?? 0
    const signed = classification.direction === 'BULLISH' ? premium : -premium
    const bucketStart = Math.floor(trade.timestamp / bucketMs) * bucketMs
    netByBucket.set(bucketStart, (netByBucket.get(bucketStart) ?? 0) + signed)
  }

  const points: NetPremiumPoint[] = []
  let cumulative = 0
  for (let bucketStart = firstBucketStart; bucketStart <= lastBucketStart; bucketStart += bucketMs) {
    const netPremium = netByBucket.get(bucketStart) ?? 0
    cumulative += netPremium
    points.push({ bucketEnd: bucketStart + bucketMs, netPremium, cumulativeNetPremium: cumulative })
  }
  return points
}
