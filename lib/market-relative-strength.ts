import { fetchMarketHistory } from '@/lib/market-data'

export interface SeriesPoint {
  date: string
  value: number
}

export interface RelativeStrengthRow {
  symbol: string
  change20d: number | null
  change60d: number | null
  change90d: number | null
  score: number
  series: SeriesPoint[]
}

export interface DrawdownRow {
  symbol: string
  maxDrawdownPct: number | null
  series: SeriesPoint[]
}

export interface RelativeStrengthResult {
  base: string
  relativeStrength: RelativeStrengthRow[]
  drawdown: DrawdownRow[]
}

function toDailyCloseMap(candles: { timestamp: number; close: number }[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const candle of candles) {
    if (!Number.isFinite(candle.close)) continue
    const date = new Date(candle.timestamp).toISOString().slice(0, 10)
    map.set(date, candle.close)
  }
  return map
}

function pctChangeOverLastN(series: SeriesPoint[], n: number): number | null {
  if (series.length < 2) return null
  const endIndex = series.length - 1
  const startIndex = Math.max(0, endIndex - n)
  if (startIndex === endIndex) return null
  const startValue = series[startIndex].value
  const endValue = series[endIndex].value
  if (!Number.isFinite(startValue) || startValue === 0) return null
  return ((endValue - startValue) / startValue) * 100
}

export async function computeRelativeStrengthAndDrawdown(
  symbols: string[],
  baseSymbol: string,
): Promise<RelativeStrengthResult> {
  const uniqueSymbols = Array.from(new Set([...symbols, baseSymbol]))
  const historyBySymbol = new Map<string, Map<string, number>>()

  await Promise.all(
    uniqueSymbols.map(async (symbol) => {
      try {
        const candles = await fetchMarketHistory(symbol, { interval: '1d', range: '6mo' })
        historyBySymbol.set(symbol, toDailyCloseMap(candles))
      } catch {
        historyBySymbol.set(symbol, new Map())
      }
    }),
  )

  const baseCloses = historyBySymbol.get(baseSymbol) ?? new Map()

  const relativeStrength: RelativeStrengthRow[] = symbols
    .filter((symbol) => symbol !== baseSymbol)
    .map((symbol) => {
      const closes = historyBySymbol.get(symbol) ?? new Map()
      const commonDates = [...closes.keys()].filter((date) => baseCloses.has(date)).sort()

      if (commonDates.length < 2) {
        return { symbol, change20d: null, change60d: null, change90d: null, score: 0, series: [] }
      }

      const firstRatio = closes.get(commonDates[0])! / baseCloses.get(commonDates[0])!
      const series: SeriesPoint[] = commonDates.map((date) => {
        const ratio = closes.get(date)! / baseCloses.get(date)!
        return { date, value: (ratio / firstRatio) * 100 }
      })

      const change20d = pctChangeOverLastN(series, 20)
      const change60d = pctChangeOverLastN(series, 60)
      const change90d = pctChangeOverLastN(series, 90)
      const score = [change20d, change60d, change90d].filter((v) => v !== null && v > 0).length

      return { symbol, change20d, change60d, change90d, score, series }
    })

  const drawdown: DrawdownRow[] = symbols.map((symbol) => {
    const closes = historyBySymbol.get(symbol) ?? new Map()
    const dates = [...closes.keys()].sort()
    if (dates.length === 0) return { symbol, maxDrawdownPct: null, series: [] }

    let peak = -Infinity
    let maxDrawdown = 0
    const series: SeriesPoint[] = dates.map((date) => {
      const close = closes.get(date)!
      peak = Math.max(peak, close)
      const drawdownPct = peak > 0 ? ((close - peak) / peak) * 100 : 0
      maxDrawdown = Math.min(maxDrawdown, drawdownPct)
      return { date, value: drawdownPct }
    })

    return { symbol, maxDrawdownPct: maxDrawdown, series }
  })

  return { base: baseSymbol, relativeStrength, drawdown }
}
