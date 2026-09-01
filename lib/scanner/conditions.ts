import type { Candle } from '@/lib/oracle/types'
import {
  calculateEMA,
  calculateATR,
  calculateRSI,
  detectTrend,
  analyzeStructure,
  analyzeATRQuality,
} from '@/lib/oracle/indicators'

export const SCANNER_ASSETS = ['EURUSD', 'GBPUSD', 'XAUUSD', 'NAS100', 'US30', 'BTCUSD'] as const
export type ScannerAsset = (typeof SCANNER_ASSETS)[number]

export const SCANNER_CONDITIONS = [
  'breakout',
  'trend',
  'reversal',
  'high_volatility',
  'low_volatility',
  'rsi_extreme',
  'ma_cross',
  'atr_expansion',
  'range_compression',
] as const
export type ScannerCondition = (typeof SCANNER_CONDITIONS)[number]

export const CONDITION_LABEL: Record<ScannerCondition, string> = {
  breakout: 'Breakout',
  trend: 'Trend',
  reversal: 'Reversal',
  high_volatility: 'High volatility',
  low_volatility: 'Low volatility',
  rsi_extreme: 'RSI extreme',
  ma_cross: 'Moving average cross',
  atr_expansion: 'ATR expansion',
  range_compression: 'Range compression',
}

export const SCANNER_TIMEFRAMES = ['M5', 'M15', 'H1', 'H4', 'D1'] as const
export type ScannerTimeframe = (typeof SCANNER_TIMEFRAMES)[number]

// Yahoo/Binance interval this timeframe fetches at, and how many of those
// bars to merge into one (H4 isn't a native Yahoo interval, so it's built
// by resampling 4 consecutive H1 bars — same technique used elsewhere for H4).
export const TIMEFRAME_SOURCE: Record<ScannerTimeframe, { interval: string; resampleChunk: number }> = {
  M5: { interval: '5m', resampleChunk: 1 },
  M15: { interval: '15m', resampleChunk: 1 },
  H1: { interval: '1h', resampleChunk: 1 },
  H4: { interval: '1h', resampleChunk: 4 },
  D1: { interval: '1d', resampleChunk: 1 },
}

export interface ScannerMatch {
  condition: ScannerCondition
  detail: string
}

export interface ScannerEvaluation {
  matches: ScannerMatch[]
  volatility: 'high' | 'medium' | 'low'
  trend: ReturnType<typeof detectTrend>
}

/**
 * Evaluates every scanner condition against a candle series using the same
 * indicator math the Oracle/Atlas engines already use — no separate
 * "scanner" math, no fabricated results.
 */
export function evaluateConditions(candles: Candle[]): ScannerEvaluation {
  const matches: ScannerMatch[] = []
  const closes = candles.map((c) => c.close)
  const price = closes[closes.length - 1] ?? 0

  const atr = calculateATR(candles)
  const atrQuality = analyzeATRQuality(atr, price)
  const trend = detectTrend(candles)
  const structure = analyzeStructure(candles)
  const rsi = calculateRSI(candles)

  // Breakout: current close beyond the last swing high/low from structure analysis
  if (price > structure.lastHigh) {
    matches.push({ condition: 'breakout', detail: `Close above swing high ${structure.lastHigh.toFixed(4)}` })
  } else if (price < structure.lastLow && structure.lastLow > 0) {
    matches.push({ condition: 'breakout', detail: `Close below swing low ${structure.lastLow.toFixed(4)}` })
  }

  // Trend: EMA-slope trend is directional (not sideways)
  if (trend !== 'sideways') {
    matches.push({ condition: 'trend', detail: trend === 'uptrend' ? 'Uptrend (EMA21 rising)' : 'Downtrend (EMA21 falling)' })
  }

  // Reversal: structure direction disagrees with the EMA trend — price
  // action is turning against the prevailing trend.
  if ((structure.structure === 'bearish' && trend === 'uptrend') || (structure.structure === 'bullish' && trend === 'downtrend')) {
    matches.push({ condition: 'reversal', detail: `Structure turning ${structure.structure} against ${trend}` })
  }

  // Volatility bucket (reuses the same ATR-as-%-of-price classification as the Oracle engine)
  if (atrQuality.score === 'high') {
    matches.push({ condition: 'high_volatility', detail: `ATR ${atrQuality.normalized.toFixed(2)}% of price` })
  } else if (atrQuality.score === 'low') {
    matches.push({ condition: 'low_volatility', detail: `ATR ${atrQuality.normalized.toFixed(2)}% of price` })
  }

  // RSI extreme
  if (rsi >= 70) {
    matches.push({ condition: 'rsi_extreme', detail: `RSI ${rsi.toFixed(1)} — overbought` })
  } else if (rsi <= 30) {
    matches.push({ condition: 'rsi_extreme', detail: `RSI ${rsi.toFixed(1)} — oversold` })
  }

  // Moving average cross: EMA21 vs EMA50 crossing on the last two bars
  const ema21Series = calculateEMA(closes, 21)
  const ema50Series = calculateEMA(closes, 50)
  if (ema21Series.length >= 2 && ema50Series.length >= 2) {
    const offset = ema21Series.length - ema50Series.length
    const e21Prev = ema21Series[ema21Series.length - 2]
    const e21Now = ema21Series[ema21Series.length - 1]
    const e50Prev = ema50Series[ema50Series.length - 2 + Math.max(0, -offset)] ?? ema50Series[ema50Series.length - 2]
    const e50Now = ema50Series[ema50Series.length - 1]
    if (Number.isFinite(e21Prev) && Number.isFinite(e50Prev)) {
      const wasAbove = e21Prev > e50Prev
      const isAbove = e21Now > e50Now
      if (wasAbove !== isAbove) {
        matches.push({ condition: 'ma_cross', detail: isAbove ? 'EMA21 crossed above EMA50' : 'EMA21 crossed below EMA50' })
      }
    }
  }

  // ATR expansion: current ATR meaningfully higher than ATR from ~10 bars ago
  if (candles.length > 24) {
    const priorAtr = calculateATR(candles.slice(0, candles.length - 10))
    if (priorAtr > 0 && atr / priorAtr >= 1.3) {
      matches.push({ condition: 'atr_expansion', detail: `ATR up ${(((atr / priorAtr) - 1) * 100).toFixed(0)}% vs 10 bars ago` })
    }
  }

  // Range compression: current ATR meaningfully lower than ATR from ~10 bars ago
  if (candles.length > 24) {
    const priorAtr = calculateATR(candles.slice(0, candles.length - 10))
    if (priorAtr > 0 && atr / priorAtr <= 0.7) {
      matches.push({ condition: 'range_compression', detail: `ATR down ${((1 - atr / priorAtr) * 100).toFixed(0)}% vs 10 bars ago` })
    }
  }

  return { matches, volatility: atrQuality.score, trend }
}
