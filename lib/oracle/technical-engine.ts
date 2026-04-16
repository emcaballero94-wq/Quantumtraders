import type {
  Candle, CandleSet, Bias, Rating, Trend,
  TechnicalAlignment, TechnicalBreakdown, TechnicalFactor,
} from './types'
import {
  latestEMA, calculateEMA, calculateATR, detectTrend,
  analyzeStructure, analyzePriceLocation, analyzeATRQuality,
  weightedScore, clamp,
} from './indicators'

// ─── Factor Weights (must sum to 100) ────────────────────────
const WEIGHTS = {
  trendH4:       25,
  trendH1:       20,
  structureM15:  15,
  ema21:         15,
  ema50:         10,
  priceLocation: 10,
  atr:            5,
} as const

// ─── Trend → Score ───────────────────────────────────────────

function trendScore(trend: Trend, bias: 'long' | 'short'): number {
  if (trend === 'uptrend')   return bias === 'long'  ? 90 : 10
  if (trend === 'downtrend') return bias === 'short' ? 90 : 10
  return 45 // sideways
}

// ─── Determine Bias from H4 + H1 ─────────────────────────────

function determineBias(trendH4: Trend, trendH1: Trend): Bias {
  if (trendH4 === 'uptrend'   && trendH1 === 'uptrend')   return 'long'
  if (trendH4 === 'downtrend' && trendH1 === 'downtrend') return 'short'
  return 'neutral'
}

// ─── Score → Rating ──────────────────────────────────────────

function scoreToRating(score: number): Rating {
  if (score >= 70) return 'strong'
  if (score >= 50) return 'operable'
  if (score >= 30) return 'mixed'
  return 'avoid'
}

// ─── EMA Factor Scoring ──────────────────────────────────────

function ema21FactorScore(
  price:  number,
  ema21:  number,
  bias:   Bias,
): { score: number; description: string } {
  const distPct = ((price - ema21) / ema21) * 100
  const absDist = Math.abs(distPct)

  if (bias === 'long') {
    if (price > ema21 && absDist < 0.3)  return { score: 85, description: 'Precio sobre EMA21 — soporte dinámico cercano' }
    if (price > ema21 && absDist < 1.0)  return { score: 70, description: 'Precio sobre EMA21 — estructura alcista' }
    if (price > ema21)                   return { score: 55, description: 'Precio sobre EMA21 — extendido' }
    if (price < ema21 && absDist < 0.3)  return { score: 50, description: 'Precio en EMA21 — zona clave' }
    return { score: 20, description: 'Precio bajo EMA21 — debilidad' }
  }

  if (bias === 'short') {
    if (price < ema21 && absDist < 0.3)  return { score: 85, description: 'Precio bajo EMA21 — resistencia dinámica cercana' }
    if (price < ema21 && absDist < 1.0)  return { score: 70, description: 'Precio bajo EMA21 — estructura bajista' }
    if (price < ema21)                   return { score: 55, description: 'Precio bajo EMA21 — extendido' }
    return { score: 20, description: 'Precio sobre EMA21 — contratrend' }
  }

  return { score: 50, description: 'EMA21 — neutral' }
}

function ema50FactorScore(
  price:  number,
  ema50:  number,
  bias:   Bias,
): { score: number; description: string } {
  if (bias === 'long') {
    if (price > ema50) return { score: 80, description: 'Precio sobre EMA50 — tendencia macro alcista' }
    return { score: 20, description: 'Precio bajo EMA50 — contratrend macro' }
  }
  if (bias === 'short') {
    if (price < ema50) return { score: 80, description: 'Precio bajo EMA50 — tendencia macro bajista' }
    return { score: 20, description: 'Precio sobre EMA50 — contratrend macro' }
  }
  return { score: 45, description: 'EMA50 — neutral' }
}

// ─── Price Location Factor ───────────────────────────────────

function priceLocationFactor(
  price: number,
  ema21: number,
  ema50: number,
  bias:  Bias,
): { score: number; description: string } {
  const loc = analyzePriceLocation(price, ema21, ema50)

  if (bias === 'long' && loc.position === 'above_both')
    return { score: 85, description: 'Precio sobre EMA21 y EMA50 — alineación completa alcista' }
  if (bias === 'short' && loc.position === 'below_both')
    return { score: 85, description: 'Precio bajo EMA21 y EMA50 — alineación completa bajista' }
  if (loc.position === 'between')
    return { score: 45, description: 'Precio entre EMAs — zona de decisión' }

  return { score: 20, description: 'Precio en posición contraria al bias' }
}

// ─── ATR Factor ──────────────────────────────────────────────

function atrFactor(atr: number, price: number): { score: number; description: string } {
  const quality = analyzeATRQuality(atr, price)
  if (quality.score === 'high')   return { score: 85, description: quality.description }
  if (quality.score === 'medium') return { score: 60, description: quality.description }
  return { score: 30, description: quality.description }
}

// ─── Main Engine ─────────────────────────────────────────────

export function analyzeTechnical(symbol: string, candles: CandleSet): TechnicalAlignment {
  const { h4, h1, m15 } = candles

  // Trends
  const trendH4  = detectTrend(h4, 21)
  const trendH1  = detectTrend(h1, 21)
  const bias     = determineBias(trendH4, trendH1)

  // Structure
  const structM15 = analyzeStructure(m15, 30)

  // Indicators on H1 (primary execution TF)
  const h1Closes    = h1.map((c) => c.close)
  const currentPrice = h1Closes[h1Closes.length - 1] ?? 0

  const ema21 = latestEMA(h1Closes, 21)
  const ema50 = latestEMA(h1Closes, 50)
  const atr   = calculateATR(h1, 14)

  // ─── Factor Scores ──────────────────────────────────────

  const trendH4Score = trendScore(trendH4, bias === 'short' ? 'short' : 'long')
  const trendH1Score = trendScore(trendH1, bias === 'short' ? 'short' : 'long')

  const structScore = (() => {
    if (bias === 'long'  && structM15.structure === 'bullish')  return 90
    if (bias === 'short' && structM15.structure === 'bearish')  return 90
    if (structM15.structure === 'ranging')                      return 45
    return 15 // opposing structure
  })()

  const ema21f = ema21FactorScore(currentPrice, ema21, bias)
  const ema50f = ema50FactorScore(currentPrice, ema50, bias)
  const locf   = priceLocationFactor(currentPrice, ema21, ema50, bias)
  const atrf   = atrFactor(atr, currentPrice)

  // ─── Aggregate Score ────────────────────────────────────

  const factors = [
    { score: trendH4Score, weight: WEIGHTS.trendH4 },
    { score: trendH1Score, weight: WEIGHTS.trendH1 },
    { score: structScore,  weight: WEIGHTS.structureM15 },
    { score: ema21f.score, weight: WEIGHTS.ema21 },
    { score: ema50f.score, weight: WEIGHTS.ema50 },
    { score: locf.score,   weight: WEIGHTS.priceLocation },
    { score: atrf.score,   weight: WEIGHTS.atr },
  ]

  const technicalScore = clamp(Math.round(weightedScore(factors)))
  const rating         = scoreToRating(technicalScore)

  // ─── Build Breakdown ────────────────────────────────────

  const breakdown: TechnicalBreakdown = {
    trendH4: {
      name:        'Tendencia H4',
      score:       trendH4Score,
      weight:      WEIGHTS.trendH4,
      description: `H4 en ${trendH4} — peso ${WEIGHTS.trendH4}%`,
    },
    trendH1: {
      name:        'Tendencia H1',
      score:       trendH1Score,
      weight:      WEIGHTS.trendH1,
      description: `H1 en ${trendH1} — peso ${WEIGHTS.trendH1}%`,
    },
    structureM15: {
      name:        'Estructura M15',
      score:       structScore,
      weight:      WEIGHTS.structureM15,
      description: `Estructura ${structM15.structure} en M15`,
    },
    ema21: {
      name:        'EMA 21',
      score:       ema21f.score,
      weight:      WEIGHTS.ema21,
      description: ema21f.description,
    },
    ema50: {
      name:        'EMA 50',
      score:       ema50f.score,
      weight:      WEIGHTS.ema50,
      description: ema50f.description,
    },
    priceLocation: {
      name:        'Ubicación del Precio',
      score:       locf.score,
      weight:      WEIGHTS.priceLocation,
      description: locf.description,
    },
    atr: {
      name:        'ATR / Volatilidad',
      score:       atrf.score,
      weight:      WEIGHTS.atr,
      description: atrf.description,
    },
  }

  return {
    symbol,
    technicalScore,
    bias,
    rating,
    trend:      trendH4, // dominant trend = H4
    breakdown,
    indicators: { ema21, ema50, atr, currentPrice },
    updatedAt:  new Date().toISOString(),
  }
}
