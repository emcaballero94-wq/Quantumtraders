// Shared "what happened to price after this point" scanner. Used by both the
// historical validation engine (lib/manu/historical-validation.ts) and
// /api/oracle/orderflow-backtest, so the two don't maintain two slightly
// different definitions of "forward return" and "MFE/MAE".

export interface PricePoint {
  price: number | null
  createdAt: string
}

export interface ForwardOutcome {
  forwardReturnPct: number | null
  /** Best the price got in the trader's favor before the horizon, walking the path from origin to horizon. */
  maxFavorableExcursionPct: number | null
  /** Worst the price got against, over that same path. */
  maxAdverseExcursionPct: number | null
}

const EMPTY: ForwardOutcome = { forwardReturnPct: null, maxFavorableExcursionPct: null, maxAdverseExcursionPct: null }

// Walks forward from `index` until it finds the first record at or after
// `horizonMs` later (same "nearest at-or-after" semantics the original
// backtest used), tracking the running best/worst excursion along the way.
// Returns nulls when the series doesn't yet reach the horizon — never
// extrapolates or guesses a future price.
export function computeForwardOutcome(records: PricePoint[], index: number, horizonMs: number): ForwardOutcome {
  const origin = records[index]
  if (!origin || origin.price === null || origin.price === 0) return EMPTY

  const originTime = new Date(origin.createdAt).getTime()
  const targetTime = originTime + horizonMs

  let mfe = 0
  let mae = 0
  let forwardReturnPct: number | null = null

  for (let j = index + 1; j < records.length; j += 1) {
    const price = records[j].price
    if (price === null) continue
    const t = new Date(records[j].createdAt).getTime()
    const pct = ((price - origin.price) / origin.price) * 100

    if (t <= targetTime) {
      if (pct > mfe) mfe = pct
      if (pct < mae) mae = pct
    }

    if (t >= targetTime) {
      forwardReturnPct = pct
      break
    }
  }

  if (forwardReturnPct === null) return EMPTY

  return { forwardReturnPct, maxFavorableExcursionPct: mfe, maxAdverseExcursionPct: mae }
}
