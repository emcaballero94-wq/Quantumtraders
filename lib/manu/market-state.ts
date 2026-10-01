import type { OrderFlowBriefRecord } from '@/lib/oracle/orderflow-persistence'
import type { DataQuality, MarketRegime, MarketState } from './types'

const MINUTE_MS = 60_000
const RANGING_THRESHOLD_PCT = 0.05

export interface LiveSnapshotInput {
  price: number | null
  cvd: number | null
  /** See OrderFlowBriefRecord.cvdSessionStartedAt — required to safely diff CVD across time. */
  cvdSessionStartedAt: string | null
  fundingRate: number | null
  openInterest: number | null
  bookImbalance: number | null
  bidDepth: number | null
  askDepth: number | null
  spread: number | null
  liquidationLongNotional: number | null
  liquidationShortNotional: number | null
  liquidationsSessionStartedAt: string | null
}

// CVD and liquidation notionals are client-side accumulators that reset on
// every page reload — a value from one session is not comparable to a value
// from another, even if both are non-null numbers. Null on either side means
// "unknown session", which must also be treated as incomparable (never a
// coincidental match).
export function sameSession(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false
  return a === b
}

// `records` must be sorted ascending by createdAt. Returns the last record at
// or before `targetMs`, or null if history doesn't reach that far back.
function findAtOrBefore(records: OrderFlowBriefRecord[], targetMs: number): OrderFlowBriefRecord | null {
  let result: OrderFlowBriefRecord | null = null
  for (const r of records) {
    if (new Date(r.createdAt).getTime() <= targetMs) result = r
    else break
  }
  return result
}

function pctChange(from: number | null | undefined, to: number | null | undefined): number | null {
  if (from === null || from === undefined || to === null || to === undefined || from === 0) return null
  if (!Number.isFinite(from) || !Number.isFinite(to)) return null
  return ((to - from) / from) * 100
}

function diff(from: number | null | undefined, to: number | null | undefined): number | null {
  if (from === null || from === undefined || to === null || to === undefined) return null
  return to - from
}

function classifyRegime(c1: number | null, c5: number | null, c15: number | null): MarketRegime {
  if (c15 === null) return 'UNKNOWN'
  if (Math.abs(c15) < RANGING_THRESHOLD_PCT) return 'RANGING'

  const signs = [c1, c5, c15].filter((v): v is number => v !== null).map((v) => Math.sign(v))
  const allSameSign = signs.length > 0 && signs.every((s) => s === signs[0])
  if (!allSameSign) return 'VOLATILE'

  return c15 > 0 ? 'TRENDING_UP' : 'TRENDING_DOWN'
}

function assessDataQuality(live: LiveSnapshotInput, has5mHistory: boolean): DataQuality {
  if (live.price === null) return 'INSUFFICIENT'
  const missing = [live.cvd, live.fundingRate, live.openInterest, live.bookImbalance].filter((v) => v === null).length
  if (missing >= 3 || !has5mHistory) return 'DEGRADED'
  if (missing > 0) return 'DEGRADED'
  return 'GOOD'
}

// `recentHistory` should cover at least the last ~15-20 minutes for this
// asset, sorted ascending. Live values come straight from the browser's
// throttled WebSocket snapshots (see app/api/manu/analyze/route.ts).
export function buildMarketState(asset: string, now: Date, live: LiveSnapshotInput, recentHistory: OrderFlowBriefRecord[]): MarketState {
  const nowMs = now.getTime()
  const at1m = findAtOrBefore(recentHistory, nowMs - 1 * MINUTE_MS)
  const at5m = findAtOrBefore(recentHistory, nowMs - 5 * MINUTE_MS)
  const at15m = findAtOrBefore(recentHistory, nowMs - 15 * MINUTE_MS)

  const priceChange1m = pctChange(at1m?.price, live.price)
  const priceChange5m = pctChange(at5m?.price, live.price)
  const priceChange15m = pctChange(at15m?.price, live.price)

  // Price/funding/OI come straight from the exchange, so they're comparable
  // across any time span. CVD is a client-side accumulator — only diff it
  // against a historical point from the SAME browser session.
  const cvdDelta1m = at1m && sameSession(at1m.cvdSessionStartedAt, live.cvdSessionStartedAt) ? diff(at1m.cvd, live.cvd) : null
  const cvdDelta5m = at5m && sameSession(at5m.cvdSessionStartedAt, live.cvdSessionStartedAt) ? diff(at5m.cvd, live.cvd) : null

  const fundingChange = diff(at5m?.fundingRate, live.fundingRate)

  const openInterestChange1m = pctChange(at1m?.openInterest, live.openInterest)
  const openInterestChange5m = pctChange(at5m?.openInterest, live.openInterest)

  const liquidationNotional =
    live.liquidationLongNotional !== null && live.liquidationShortNotional !== null
      ? live.liquidationLongNotional + live.liquidationShortNotional
      : null

  return {
    asset,
    timestamp: now.toISOString(),
    price: live.price,
    priceChange1m,
    priceChange5m,
    priceChange15m,
    cvd: live.cvd,
    cvdDelta1m,
    cvdDelta5m,
    funding: live.fundingRate,
    fundingChange,
    openInterest: live.openInterest,
    openInterestChange1m,
    openInterestChange5m,
    orderBookImbalance: live.bookImbalance,
    bidDepth: live.bidDepth,
    askDepth: live.askDepth,
    spread: live.spread,
    liquidationNotional,
    liquidationLong: live.liquidationLongNotional,
    liquidationShort: live.liquidationShortNotional,
    marketRegime: classifyRegime(priceChange1m, priceChange5m, priceChange15m),
    dataQuality: assessDataQuality(live, at5m !== null),
  }
}

// Reconstructs the MarketState as it would have looked at `records[index]`,
// treating that record as "live" against everything before it. Used to get a
// same-shape "previous state" (e.g. for ORDERFLOW_REGIME_CHANGE) without a
// separate market_states table — orderflow_briefs already has everything
// needed to recompute it on the fly.
export function buildMarketStateFromRecord(asset: string, records: OrderFlowBriefRecord[], index: number): MarketState | null {
  const record = records[index]
  if (!record) return null

  const asOfLive: LiveSnapshotInput = {
    price: record.price,
    cvd: record.cvd,
    cvdSessionStartedAt: record.cvdSessionStartedAt,
    fundingRate: record.fundingRate,
    openInterest: record.openInterest,
    bookImbalance: record.bookImbalance,
    bidDepth: null,
    askDepth: null,
    spread: null,
    liquidationLongNotional: record.liquidationLongNotional,
    liquidationShortNotional: record.liquidationShortNotional,
    liquidationsSessionStartedAt: record.liquidationsSessionStartedAt,
  }

  return buildMarketState(asset, new Date(record.createdAt), asOfLive, records.slice(0, index))
}

// Liquidation notionals are cumulative counters that reset to 0 whenever the
// Order Flow page reloads. Prefer the explicit session marker (exact) — fall
// back to the "value went down" heuristic only for legacy rows persisted
// before that column existed, since it can miss a reset that happened to
// still leave a larger number than before.
export function detectLiquidationReset(lastRecord: OrderFlowBriefRecord | null, live: LiveSnapshotInput): boolean {
  if (!lastRecord) return false

  if (lastRecord.liquidationsSessionStartedAt && live.liquidationsSessionStartedAt) {
    return lastRecord.liquidationsSessionStartedAt !== live.liquidationsSessionStartedAt
  }

  const longReset =
    lastRecord.liquidationLongNotional !== null &&
    live.liquidationLongNotional !== null &&
    live.liquidationLongNotional < lastRecord.liquidationLongNotional
  const shortReset =
    lastRecord.liquidationShortNotional !== null &&
    live.liquidationShortNotional !== null &&
    live.liquidationShortNotional < lastRecord.liquidationShortNotional
  return longReset || shortReset
}
