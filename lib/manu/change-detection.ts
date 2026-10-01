import type { OrderFlowBriefRecord } from '@/lib/oracle/orderflow-persistence'
import type { ChangeClass } from './types'
import { sameSession } from './market-state'

// How much faster/slower the current pace has to be than the prior pace to
// count as ACCELERATING/DECELERATING vs. ANOMALOUS. Tunable constants, not a
// statistical calibration — documented so they're easy to revisit.
const ACCEL_FACTOR = 1.5
const ANOMALY_FACTOR = 4

export function deltaBetween(a: number | null | undefined, b: number | null | undefined): number | null {
  if (a === null || a === undefined || b === null || b === undefined) return null
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null
  return b - a
}

// Classifies a variable's trend by comparing its most recent change
// (currentDelta) against the change over the window before that
// (previousDelta) — e.g. CVD moved +1.2 last window, +3.8 this window =>
// ACCELERATING. `noiseThreshold` is the minimum absolute delta considered a
// real move for this variable (units match the variable itself).
export function classifyChange(previousDelta: number | null, currentDelta: number | null, noiseThreshold: number): ChangeClass | null {
  if (currentDelta === null || !Number.isFinite(currentDelta)) return null

  const currentSmall = Math.abs(currentDelta) <= noiseThreshold

  if (previousDelta === null || !Number.isFinite(previousDelta)) {
    return currentSmall ? 'UNCHANGED' : 'SHIFTING'
  }

  const previousSmall = Math.abs(previousDelta) <= noiseThreshold

  if (currentSmall && previousSmall) return 'UNCHANGED'
  if (previousSmall && !currentSmall) return 'SHIFTING'

  if (Math.sign(currentDelta) !== Math.sign(previousDelta) && !currentSmall) {
    return 'REVERSING'
  }

  const ratio = previousDelta !== 0 ? Math.abs(currentDelta) / Math.abs(previousDelta) : Infinity
  if (ratio >= ANOMALY_FACTOR) return 'ANOMALOUS'
  if (ratio >= ACCEL_FACTOR) return 'ACCELERATING'
  if (ratio <= 1 / ACCEL_FACTOR) return 'DECELERATING'
  return 'SHIFTING'
}

function findAtOrBefore(records: OrderFlowBriefRecord[], targetMs: number): OrderFlowBriefRecord | null {
  let result: OrderFlowBriefRecord | null = null
  for (const r of records) {
    if (new Date(r.createdAt).getTime() <= targetMs) result = r
    else break
  }
  return result
}

export interface LiveValues {
  price: number | null
  cvd: number | null
  /** See OrderFlowBriefRecord.cvdSessionStartedAt — required to safely diff CVD across time. */
  cvdSessionStartedAt: string | null
  openInterest: number | null
  fundingRate: number | null
}

export interface ChangeClassifications {
  price: ChangeClass | null
  cvd: ChangeClass | null
  openInterest: ChangeClass | null
  funding: ChangeClass | null
}

// Noise floors per variable — below this, a delta is treated as market
// microstructure noise rather than a real move. Price/OI are % deltas; CVD
// and funding are raw-unit deltas.
const NOISE_THRESHOLDS = { price: 0.02, cvd: 0.1, openInterest: 0.05, funding: 0.00002 }

// Classifies price/CVD/OI/funding using two consecutive ~1-minute windows
// pulled from the persisted brief history (briefs land roughly every 60s, so
// "1 minute ago" and "2 minutes ago" line up with one cycle each).
export function classifyMarketChanges(now: Date, live: LiveValues, records: OrderFlowBriefRecord[]): ChangeClassifications {
  const nowMs = now.getTime()
  const at1m = findAtOrBefore(records, nowMs - 60_000)
  const at2m = findAtOrBefore(records, nowMs - 120_000)

  const priceCurrent = deltaBetween(at1m?.price, live.price)
  const pricePrevious = deltaBetween(at2m?.price, at1m?.price)

  // CVD deltas are only meaningful between readings from the same browser
  // session — a reload zeroes the accumulator, which would otherwise look
  // like a huge (fake) move.
  const cvd1mSameSession = at1m ? sameSession(at1m.cvdSessionStartedAt, live.cvdSessionStartedAt) : false
  const cvd2mSameSession = at1m && at2m ? sameSession(at2m.cvdSessionStartedAt, at1m.cvdSessionStartedAt) : false
  const cvdCurrent = cvd1mSameSession ? deltaBetween(at1m?.cvd, live.cvd) : null
  const cvdPrevious = cvd2mSameSession ? deltaBetween(at2m?.cvd, at1m?.cvd) : null

  const oiCurrent = deltaBetween(at1m?.openInterest, live.openInterest)
  const oiPrevious = deltaBetween(at2m?.openInterest, at1m?.openInterest)

  const fundingCurrent = deltaBetween(at1m?.fundingRate, live.fundingRate)
  const fundingPrevious = deltaBetween(at2m?.fundingRate, at1m?.fundingRate)

  return {
    price: classifyChange(pricePrevious, priceCurrent, NOISE_THRESHOLDS.price),
    cvd: classifyChange(cvdPrevious, cvdCurrent, NOISE_THRESHOLDS.cvd),
    openInterest: classifyChange(oiPrevious, oiCurrent, NOISE_THRESHOLDS.openInterest),
    funding: classifyChange(fundingPrevious, fundingCurrent, NOISE_THRESHOLDS.funding),
  }
}
