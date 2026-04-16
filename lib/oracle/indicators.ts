import type { Candle, Trend } from './types'

// ─── EMA ────────────────────────────────────────────────────

/**
 * Exponential Moving Average (Wilder's method compatible)
 * Returns array of EMAs aligned to the last `prices.length - period + 1` values
 */
export function calculateEMA(prices: number[], period: number): number[] {
  if (prices.length < period) return []

  const k = 2 / (period + 1)
  const emas: number[] = []

  // Seed with SMA of the first `period` bars
  const seed = prices.slice(0, period).reduce((a, b) => a + b, 0) / period
  emas.push(seed)

  for (let i = period; i < prices.length; i++) {
    emas.push(prices[i] * k + emas[emas.length - 1] * (1 - k))
  }

  return emas
}

/**
 * Returns only the latest EMA value
 */
export function latestEMA(prices: number[], period: number): number {
  const emas = calculateEMA(prices, period)
  return emas[emas.length - 1] ?? 0
}

// ─── ATR ────────────────────────────────────────────────────

/**
 * Average True Range — Wilder's smoothing
 */
export function calculateATR(candles: Candle[], period: number = 14): number {
  if (candles.length < 2) return 0

  const trs: number[] = []
  for (let i = 1; i < candles.length; i++) {
    const { high, low } = candles[i]
    const prevClose = candles[i - 1].close
    trs.push(Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose)))
  }

  if (trs.length < period) {
    return trs.reduce((a, b) => a + b, 0) / trs.length
  }

  // First ATR = simple average
  let atr = trs.slice(0, period).reduce((a, b) => a + b, 0) / period

  // Wilder smoothing for subsequent values
  for (let i = period; i < trs.length; i++) {
    atr = (atr * (period - 1) + trs[i]) / period
  }

  return atr
}

// ─── Trend Detection ────────────────────────────────────────

/**
 * Detect trend using EMA slope + price position
 */
export function detectTrend(candles: Candle[], emaPeriod: number = 21): Trend {
  if (candles.length < emaPeriod + 5) return 'sideways'

  const closes = candles.map((c) => c.close)
  const emas = calculateEMA(closes, emaPeriod)

  if (emas.length < 5) return 'sideways'

  const currentEMA  = emas[emas.length - 1]
  const prevEMA5    = emas[emas.length - 5]
  const currentPrice = closes[closes.length - 1]

  const slopePercent = ((currentEMA - prevEMA5) / prevEMA5) * 100

  if (slopePercent > 0.05 && currentPrice > currentEMA) return 'uptrend'
  if (slopePercent < -0.05 && currentPrice < currentEMA) return 'downtrend'
  return 'sideways'
}

// ─── Structure Detection (HH/HL or LH/LL) ───────────────────

export interface StructureAnalysis {
  structure:   'bullish' | 'bearish' | 'ranging'
  lastHigh:    number
  lastLow:     number
  swing:       number   // distance from last pivot in %
}

export function analyzeStructure(candles: Candle[], lookback: number = 20): StructureAnalysis {
  if (candles.length < lookback) {
    const last = candles[candles.length - 1]
    return { structure: 'ranging', lastHigh: last?.high ?? 0, lastLow: last?.low ?? 0, swing: 0 }
  }

  const recent = candles.slice(-lookback)

  // Find local highs and lows (simple pivot detection)
  const highs: number[] = []
  const lows: number[] = []

  for (let i = 2; i < recent.length - 2; i++) {
    const c = recent[i]
    const isHigh = c.high > recent[i - 1].high && c.high > recent[i - 2].high &&
                   c.high > recent[i + 1].high && c.high > recent[i + 2].high
    const isLow  = c.low  < recent[i - 1].low  && c.low  < recent[i - 2].low  &&
                   c.low  < recent[i + 1].low  && c.low  < recent[i + 2].low

    if (isHigh) highs.push(c.high)
    if (isLow)  lows.push(c.low)
  }

  if (highs.length < 2 || lows.length < 2) {
    const h = Math.max(...recent.map((c) => c.high))
    const l = Math.min(...recent.map((c) => c.low))
    return { structure: 'ranging', lastHigh: h, lastLow: l, swing: ((h - l) / l) * 100 }
  }

  const lastHigh     = highs[highs.length - 1]
  const prevHigh     = highs[highs.length - 2]
  const lastLow      = lows[lows.length - 1]
  const prevLow      = lows[lows.length - 2]
  const currentPrice = recent[recent.length - 1].close

  let structure: StructureAnalysis['structure'] = 'ranging'
  if (lastHigh > prevHigh && lastLow > prevLow) structure = 'bullish'
  if (lastHigh < prevHigh && lastLow < prevLow) structure = 'bearish'

  const swing = ((currentPrice - lastLow) / lastLow) * 100

  return { structure, lastHigh, lastLow, swing }
}

// ─── Price Location ──────────────────────────────────────────

export interface PriceLocation {
  position:        'above_both' | 'between' | 'below_both'
  distanceToEma21: number   // % distance
  distanceToEma50: number
}

export function analyzePriceLocation(
  price:  number,
  ema21:  number,
  ema50:  number,
): PriceLocation {
  const distanceToEma21 = ((price - ema21) / ema21) * 100
  const distanceToEma50 = ((price - ema50) / ema50) * 100

  let position: PriceLocation['position']
  if (price > ema21 && price > ema50)  position = 'above_both'
  else if (price < ema21 && price < ema50) position = 'below_both'
  else position = 'between'

  return { position, distanceToEma21, distanceToEma50 }
}

// ─── ATR Quality ─────────────────────────────────────────────

export interface ATRQuality {
  score:       'high' | 'medium' | 'low'
  normalized:  number   // ATR as % of price
  description: string
}

export function analyzeATRQuality(atr: number, price: number): ATRQuality {
  const normalized = (atr / price) * 100

  if (normalized > 0.5) {
    return { score: 'high', normalized, description: 'Alta volatilidad — buenas extensiones' }
  }
  if (normalized > 0.2) {
    return { score: 'medium', normalized, description: 'Volatilidad moderada — operable' }
  }
  return { score: 'low', normalized, description: 'Volatilidad baja — movimientos limitados' }
}

// ─── Score Helpers ───────────────────────────────────────────

/** Clamp a value between 0 and 100 */
export function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value))
}

/** Weighted average of factor scores */
export function weightedScore(
  factors: Array<{ score: number; weight: number }>,
): number {
  const totalWeight = factors.reduce((s, f) => s + f.weight, 0)
  const weighted    = factors.reduce((s, f) => s + f.score * f.weight, 0)
  return clamp(totalWeight > 0 ? weighted / totalWeight : 0)
}
