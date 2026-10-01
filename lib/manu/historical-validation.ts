import type { OrderFlowBriefRecord } from '@/lib/oracle/orderflow-persistence'
import type { HistoricalPatternMatch, HorizonStats, SampleLabel } from './types'
import { computeForwardOutcome } from './forward-returns'
import { sameSession } from './market-state'

// A historical instance must agree on at least 3 of these 4 sign dimensions
// with the current condition to count as a "similar" match.
const MATCH_THRESHOLD = 0.75
const HORIZONS_MS = { '5m': 5 * 60_000, '15m': 15 * 60_000, '60m': 60 * 60_000 } as const
const LOOKBACK_MS = 5 * 60_000

export interface Fingerprint {
  cvd: number
  oi: number
  imbalance: number
  liqSkew: number
}

function sign(value: number | null): number {
  if (value === null || !Number.isFinite(value)) return 0
  if (value > 0) return 1
  if (value < 0) return -1
  return 0
}

function findAtOrBefore(records: OrderFlowBriefRecord[], upTo: number, targetMs: number): OrderFlowBriefRecord | null {
  let result: OrderFlowBriefRecord | null = null
  for (let i = 0; i < upTo; i += 1) {
    if (new Date(records[i].createdAt).getTime() <= targetMs) result = records[i]
    else break
  }
  return result
}

// Derives the same 4-dimension sign fingerprint for a historical record that
// `currentFingerprintFromState` derives for the live state — both must agree
// on units (raw deltas, not percentages) so the signs line up.
function fingerprintAt(records: OrderFlowBriefRecord[], index: number): Fingerprint | null {
  const current = records[index]
  const targetMs = new Date(current.createdAt).getTime() - LOOKBACK_MS
  const prior = findAtOrBefore(records, index, targetMs)
  if (!prior) return null

  // CVD is a client-side accumulator that resets on reload — only diff it
  // between two records that share the same session marker. Open interest
  // comes from the exchange, so it's always safely comparable.
  const cvdDelta =
    current.cvd !== null && prior.cvd !== null && sameSession(current.cvdSessionStartedAt, prior.cvdSessionStartedAt)
      ? current.cvd - prior.cvd
      : null
  const oiDelta = current.openInterest !== null && prior.openInterest !== null ? current.openInterest - prior.openInterest : null
  const liqSkew =
    current.liquidationShortNotional !== null && current.liquidationLongNotional !== null
      ? current.liquidationShortNotional - current.liquidationLongNotional
      : null

  return {
    cvd: sign(cvdDelta),
    oi: sign(oiDelta),
    imbalance: sign(current.bookImbalance),
    liqSkew: sign(liqSkew),
  }
}

function matchScore(a: Fingerprint, b: Fingerprint): number {
  const dims: (keyof Fingerprint)[] = ['cvd', 'oi', 'imbalance', 'liqSkew']
  const matched = dims.filter((d) => a[d] === b[d]).length
  return matched / dims.length
}

export function sampleSizeLabel(n: number): SampleLabel {
  if (n < 30) return 'INSUFFICIENT_SAMPLE'
  if (n < 100) return 'LIMITED_SAMPLE'
  if (n < 300) return 'USABLE_SAMPLE'
  return 'ROBUST_SAMPLE'
}

function mean(values: number[]): number | null {
  return values.length > 0 ? values.reduce((sum, v) => sum + v, 0) / values.length : null
}

// The median is reported alongside the mean because a handful of extreme
// moves can drag the mean far from what a "typical" outcome looked like.
function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

function buildHorizonStats(records: OrderFlowBriefRecord[], matchedIndices: number[], horizonMs: number): HorizonStats {
  const outcomes = matchedIndices.map((i) => computeForwardOutcome(records, i, horizonMs)).filter((o) => o.forwardReturnPct !== null)

  const returns = outcomes.map((o) => o.forwardReturnPct as number)
  const mfes = outcomes.map((o) => o.maxFavorableExcursionPct as number)
  const maes = outcomes.map((o) => o.maxAdverseExcursionPct as number)

  return {
    gradedCount: outcomes.length,
    positiveRatePct: outcomes.length > 0 ? (returns.filter((r) => r > 0).length / outcomes.length) * 100 : null,
    meanReturnPct: mean(returns),
    medianReturnPct: median(returns),
    maxFavorableExcursionPct: mfes.length > 0 ? Math.max(...mfes) : null,
    maxAdverseExcursionPct: maes.length > 0 ? Math.min(...maes) : null,
  }
}

export function currentFingerprintFromState(cvdDelta5m: number | null, oiDelta5m: number | null, imbalance: number | null, liqSkew: number | null): Fingerprint {
  return { cvd: sign(cvdDelta5m), oi: sign(oiDelta5m), imbalance: sign(imbalance), liqSkew: sign(liqSkew) }
}

// Finds historical records whose own conditions (5 minutes before that
// record) resemble the current fingerprint, then grades what price actually
// did afterward at each horizon. Never fabricates a sample — if nothing
// matches closely enough, sampleSize is 0 and callers must say so rather
// than filling in a number.
export function findSimilarConditions(records: OrderFlowBriefRecord[], currentFingerprint: Fingerprint): HistoricalPatternMatch {
  const matchedIndices: number[] = []
  for (let i = 0; i < records.length; i += 1) {
    const fp = fingerprintAt(records, i)
    if (!fp) continue
    if (matchScore(fp, currentFingerprint) >= MATCH_THRESHOLD) matchedIndices.push(i)
  }

  const sampleSize = matchedIndices.length

  return {
    sampleSize,
    sampleLabel: sampleSizeLabel(sampleSize),
    matchScore: MATCH_THRESHOLD,
    fingerprint: { ...currentFingerprint },
    horizons: {
      '5m': buildHorizonStats(records, matchedIndices, HORIZONS_MS['5m']),
      '15m': buildHorizonStats(records, matchedIndices, HORIZONS_MS['15m']),
      '60m': buildHorizonStats(records, matchedIndices, HORIZONS_MS['60m']),
    },
  }
}
