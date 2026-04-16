import type { Candle, CurrencyStrength, Trend } from '@/lib/oracle/types'

export interface MarketQuote {
  symbol: string
  providerSymbol: string
  price: number | null
  change: number | null
  changePct: number | null
  open: number | null
  high: number | null
  low: number | null
  prevClose: number | null
  volume: number | null
  currency: string | null
  description: string
  timestamp: number
}

export interface CorrelationPair {
  a: string
  b: string
  value: number
}

export interface CorrelationResult {
  symbols: string[]
  matrix: number[][]
  sampleSize: number
  strongestPositive: CorrelationPair | null
  strongestNegative: CorrelationPair | null
}

export const MARKET_SYMBOL_MAP: Record<string, string> = {
  XAUUSD: 'GC=F',
  XAGUSD: 'SI=F',
  EURUSD: 'EURUSD=X',
  GBPUSD: 'GBPUSD=X',
  AUDUSD: 'AUDUSD=X',
  NZDUSD: 'NZDUSD=X',
  USDJPY: 'USDJPY=X',
  USDCHF: 'USDCHF=X',
  USDCAD: 'USDCAD=X',
  EURCAD: 'EURCAD=X',
  GBPJPY: 'GBPJPY=X',
  EURJPY: 'EURJPY=X',
  BTCUSD: 'BTC-USD',
  ETHUSD: 'ETH-USD',
  DXY: 'DX-Y.NYB',
  SP500: '^GSPC',
  NASDAQ: '^IXIC',
  VIX: '^VIX',
}

const REVERSE_MARKET_SYMBOL_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(MARKET_SYMBOL_MAP).map(([symbol, providerSymbol]) => [providerSymbol, symbol]),
)

const PRICE_HISTORY_PAIRS = [
  'EURUSD',
  'GBPUSD',
  'AUDUSD',
  'NZDUSD',
  'USDJPY',
  'USDCHF',
  'USDCAD',
  'EURJPY',
  'GBPJPY',
]

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function safeNumber(value: unknown): number | null {
  if (typeof value !== 'number') return null
  if (!Number.isFinite(value)) return null
  return value
}

function parsePair(symbol: string): { base: string; quote: string } {
  const clean = symbol.replace('/', '').toUpperCase()
  if (clean.length < 6) return { base: clean.slice(0, 3), quote: clean.slice(3, 6) }
  return { base: clean.slice(0, 3), quote: clean.slice(3, 6) }
}

function calculateChangePct(current: number, previous: number): number {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous === 0) return 0
  return ((current - previous) / previous) * 100
}

function normalizeCurrencyScore(rawScore: number): number {
  return clamp(Math.round(rawScore * 25), -100, 100)
}

function deriveCurrencyTrend(change4h: number): CurrencyStrength['trend'] {
  if (change4h > 0.05) return 'strengthening'
  if (change4h < -0.05) return 'weakening'
  return 'stable'
}

export function symbolToProviderSymbol(symbol: string): string | null {
  return MARKET_SYMBOL_MAP[symbol.toUpperCase()] ?? null
}

export async function fetchMarketQuotes(symbols: string[]): Promise<MarketQuote[]> {
  const normalizedSymbols = Array.from(
    new Set(
      symbols
        .map((symbol) => symbol.toUpperCase().trim())
        .filter((symbol) => Boolean(MARKET_SYMBOL_MAP[symbol])),
    ),
  )

  if (normalizedSymbols.length === 0) return []

  const providerSymbols = normalizedSymbols
    .map((symbol) => MARKET_SYMBOL_MAP[symbol])
    .filter((value): value is string => Boolean(value))
    .join(',')

  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(providerSymbols)}`
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    },
    next: { revalidate: 0 },
  })

  if (!response.ok) {
    throw new Error(`Quote provider responded with status ${response.status}`)
  }

  const json = await response.json()
  const results = Array.isArray(json?.quoteResponse?.result) ? json.quoteResponse.result : []

  return results.map((row: any) => {
    const providerSymbol = String(row?.symbol ?? '')
    const internalSymbol = REVERSE_MARKET_SYMBOL_MAP[providerSymbol] ?? providerSymbol
    return {
      symbol: internalSymbol,
      providerSymbol,
      price: safeNumber(row?.regularMarketPrice),
      change: safeNumber(row?.regularMarketChange),
      changePct: safeNumber(row?.regularMarketChangePercent),
      open: safeNumber(row?.regularMarketOpen),
      high: safeNumber(row?.regularMarketDayHigh),
      low: safeNumber(row?.regularMarketDayLow),
      prevClose: safeNumber(row?.regularMarketPreviousClose),
      volume: safeNumber(row?.regularMarketVolume),
      currency: typeof row?.currency === 'string' ? row.currency : null,
      description: typeof row?.shortName === 'string' ? row.shortName : internalSymbol,
      timestamp: Date.now(),
    } satisfies MarketQuote
  })
}

export async function fetchMarketHistory(
  symbol: string,
  options?: { interval?: string; range?: string },
): Promise<Candle[]> {
  const providerSymbol = symbolToProviderSymbol(symbol)
  if (!providerSymbol) return []

  const interval = options?.interval ?? '1h'
  const range = options?.range ?? '1mo'

  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(providerSymbol)}?interval=${encodeURIComponent(interval)}&range=${encodeURIComponent(range)}&includePrePost=false`

  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    },
    next: { revalidate: 0 },
  })

  if (!response.ok) {
    throw new Error(`History provider responded with status ${response.status}`)
  }

  const json = await response.json()
  const result = json?.chart?.result?.[0]
  const timestamps = Array.isArray(result?.timestamp) ? result.timestamp : []
  const quote = result?.indicators?.quote?.[0] ?? {}
  const opens = Array.isArray(quote?.open) ? quote.open : []
  const highs = Array.isArray(quote?.high) ? quote.high : []
  const lows = Array.isArray(quote?.low) ? quote.low : []
  const closes = Array.isArray(quote?.close) ? quote.close : []
  const volumes = Array.isArray(quote?.volume) ? quote.volume : []

  const candles: Candle[] = []
  for (let index = 0; index < timestamps.length; index += 1) {
    const timestamp = Number(timestamps[index])
    const open = safeNumber(opens[index])
    const high = safeNumber(highs[index])
    const low = safeNumber(lows[index])
    const close = safeNumber(closes[index])
    const volume = safeNumber(volumes[index])

    if (open === null || high === null || low === null || close === null) continue

    candles.push({
      timestamp: timestamp * 1000,
      open,
      high,
      low,
      close,
      volume: volume ?? undefined,
    })
  }

  candles.sort((a, b) => a.timestamp - b.timestamp)
  return candles
}

export function resampleCandles(candles: Candle[], chunkSize: number): Candle[] {
  if (chunkSize <= 1) return [...candles]
  const output: Candle[] = []

  for (let index = 0; index + chunkSize <= candles.length; index += chunkSize) {
    const chunk = candles.slice(index, index + chunkSize)
    const first = chunk[0]
    const last = chunk[chunk.length - 1]
    if (!first || !last) continue

    const high = Math.max(...chunk.map((item) => item.high))
    const low = Math.min(...chunk.map((item) => item.low))
    const volume = chunk.reduce((total, item) => total + (item.volume ?? 0), 0)

    output.push({
      timestamp: last.timestamp,
      open: first.open,
      high,
      low,
      close: last.close,
      volume,
    })
  }

  return output
}

export function detectTrendFromCandles(candles: Candle[]): Trend {
  if (candles.length < 20) return 'sideways'
  const current = candles[candles.length - 1]?.close ?? 0
  const past = candles[candles.length - 20]?.close ?? current
  const changePct = calculateChangePct(current, past)
  if (changePct > 0.25) return 'uptrend'
  if (changePct < -0.25) return 'downtrend'
  return 'sideways'
}

function computeReturns(closes: number[]): number[] {
  const returns: number[] = []
  for (let index = 1; index < closes.length; index += 1) {
    const current = closes[index]
    const previous = closes[index - 1]
    if (!Number.isFinite(current) || !Number.isFinite(previous) || previous === 0) continue
    returns.push((current - previous) / previous)
  }
  return returns
}

function pearsonCorrelation(seriesA: number[], seriesB: number[]): number {
  const size = Math.min(seriesA.length, seriesB.length)
  if (size < 3) return 0

  const a = seriesA.slice(seriesA.length - size)
  const b = seriesB.slice(seriesB.length - size)
  const meanA = a.reduce((sum, value) => sum + value, 0) / size
  const meanB = b.reduce((sum, value) => sum + value, 0) / size

  let numerator = 0
  let varianceA = 0
  let varianceB = 0

  for (let index = 0; index < size; index += 1) {
    const diffA = a[index] - meanA
    const diffB = b[index] - meanB
    numerator += diffA * diffB
    varianceA += diffA * diffA
    varianceB += diffB * diffB
  }

  const denominator = Math.sqrt(varianceA * varianceB)
  if (denominator === 0) return 0
  return clamp(numerator / denominator, -1, 1)
}

export async function computeCorrelationMatrix(
  symbols: string[],
  options?: { interval?: string; range?: string },
): Promise<CorrelationResult> {
  const normalizedSymbols = Array.from(
    new Set(symbols.map((symbol) => symbol.toUpperCase()).filter((symbol) => symbolToProviderSymbol(symbol))),
  )

  const histories = await Promise.all(
    normalizedSymbols.map(async (symbol) => ({
      symbol,
      candles: await fetchMarketHistory(symbol, options),
    })),
  )

  const returnsBySymbol: Record<string, number[]> = {}
  for (const history of histories) {
    const closes = history.candles.map((item) => item.close)
    returnsBySymbol[history.symbol] = computeReturns(closes)
  }

  const matrix = normalizedSymbols.map((rowSymbol) =>
    normalizedSymbols.map((colSymbol) => {
      if (rowSymbol === colSymbol) return 1
      return pearsonCorrelation(returnsBySymbol[rowSymbol] ?? [], returnsBySymbol[colSymbol] ?? [])
    }),
  )

  let strongestPositive: CorrelationPair | null = null
  let strongestNegative: CorrelationPair | null = null

  for (let row = 0; row < normalizedSymbols.length; row += 1) {
    for (let col = row + 1; col < normalizedSymbols.length; col += 1) {
      const value = matrix[row]?.[col] ?? 0
      const pair: CorrelationPair = {
        a: normalizedSymbols[row] ?? '',
        b: normalizedSymbols[col] ?? '',
        value,
      }
      if (!strongestPositive || pair.value > strongestPositive.value) {
        strongestPositive = pair
      }
      if (!strongestNegative || pair.value < strongestNegative.value) {
        strongestNegative = pair
      }
    }
  }

  const sampleSize = Math.min(
    ...normalizedSymbols.map((symbol) => (returnsBySymbol[symbol] ?? []).length),
  )

  return {
    symbols: normalizedSymbols,
    matrix,
    sampleSize: Number.isFinite(sampleSize) ? sampleSize : 0,
    strongestPositive,
    strongestNegative,
  }
}

interface CurrencyAccumulator {
  h1: number[]
  h4: number[]
  d1: number[]
}

function getCloseAtOffset(candles: Candle[], offset: number): number | null {
  if (candles.length === 0) return null
  const targetIndex = candles.length - 1 - offset
  if (targetIndex < 0) return null
  return candles[targetIndex]?.close ?? null
}

export async function computeCurrencyStrength(): Promise<CurrencyStrength[]> {
  const histories = await Promise.all(
    PRICE_HISTORY_PAIRS.map(async (pair) => ({
      pair,
      candles: await fetchMarketHistory(pair, { interval: '1h', range: '5d' }),
    })),
  )

  const accumulators: Record<string, CurrencyAccumulator> = {}

  for (const history of histories) {
    const candles = history.candles
    if (candles.length < 25) continue

    const lastClose = candles[candles.length - 1]?.close ?? null
    const close1h = getCloseAtOffset(candles, 1)
    const close4h = getCloseAtOffset(candles, 4)
    const close1d = getCloseAtOffset(candles, 24)
    if (lastClose === null || close1h === null || close4h === null || close1d === null) continue

    const h1 = calculateChangePct(lastClose, close1h)
    const h4 = calculateChangePct(lastClose, close4h)
    const d1 = calculateChangePct(lastClose, close1d)
    const { base, quote } = parsePair(history.pair)

    if (!accumulators[base]) accumulators[base] = { h1: [], h4: [], d1: [] }
    if (!accumulators[quote]) accumulators[quote] = { h1: [], h4: [], d1: [] }

    accumulators[base].h1.push(h1)
    accumulators[base].h4.push(h4)
    accumulators[base].d1.push(d1)
    accumulators[quote].h1.push(-h1)
    accumulators[quote].h4.push(-h4)
    accumulators[quote].d1.push(-d1)
  }

  const strengths: CurrencyStrength[] = Object.entries(accumulators).map(([currency, values]) => {
    const avg = (items: number[]) =>
      items.length > 0 ? items.reduce((sum, value) => sum + value, 0) / items.length : 0
    const change1h = avg(values.h1)
    const change4h = avg(values.h4)
    const change1d = avg(values.d1)
    const score = normalizeCurrencyScore(change1d)

    return {
      currency,
      score,
      trend: deriveCurrencyTrend(change4h),
      change1h,
      change4h,
      change1d,
    }
  })

  strengths.sort((a, b) => b.score - a.score)
  return strengths
}
