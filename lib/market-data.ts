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

const BINANCE_SYMBOL_MAP: Record<string, string> = {
  BTCUSD: 'BTCUSDT',
  ETHUSD: 'ETHUSDT',
}

const REVERSE_BINANCE_SYMBOL_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(BINANCE_SYMBOL_MAP).map(([symbol, providerSymbol]) => [providerSymbol, symbol]),
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

function symbolToBinanceSymbol(symbol: string): string | null {
  return BINANCE_SYMBOL_MAP[symbol.toUpperCase()] ?? null
}

function getBinanceApiBaseUrl(): string {
  return process.env.BINANCE_API_URL ?? 'https://api.binance.com'
}

function parseBinanceNumeric(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value !== 'string') return null
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : null
}

async function fetchYahooQuotes(symbols: string[]): Promise<MarketQuote[]> {
  if (symbols.length === 0) return []

  const providerSymbols = symbols
    .map((symbol) => MARKET_SYMBOL_MAP[symbol])
    .filter((value): value is string => Boolean(value))
    .join(',')

  if (!providerSymbols) return []

  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(providerSymbols)}`
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    },
    next: { revalidate: 0 },
  })

  if (!response.ok) {
    return fetchYahooSnapshotQuotes(symbols)
  }

  const json = await response.json()
  const results = Array.isArray(json?.quoteResponse?.result) ? json.quoteResponse.result : []
  if (results.length === 0) return fetchYahooSnapshotQuotes(symbols)

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

async function fetchYahooSnapshotQuote(symbol: string): Promise<MarketQuote | null> {
  const providerSymbol = MARKET_SYMBOL_MAP[symbol]
  if (!providerSymbol) return null

  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(providerSymbol)}?interval=1h&range=2d&includePrePost=false`
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    },
    next: { revalidate: 0 },
  })
  if (!response.ok) return null

  const json = await response.json()
  const result = json?.chart?.result?.[0]
  const timestamps = Array.isArray(result?.timestamp) ? result.timestamp : []
  const quote = result?.indicators?.quote?.[0] ?? {}
  const opens = Array.isArray(quote?.open) ? quote.open : []
  const highs = Array.isArray(quote?.high) ? quote.high : []
  const lows = Array.isArray(quote?.low) ? quote.low : []
  const closes = Array.isArray(quote?.close) ? quote.close : []
  const volumes = Array.isArray(quote?.volume) ? quote.volume : []

  const points: Array<{
    timestamp: number
    open: number
    high: number
    low: number
    close: number
    volume: number | null
  }> = []

  for (let index = 0; index < timestamps.length; index += 1) {
    const timestamp = Number(timestamps[index])
    const open = safeNumber(opens[index])
    const high = safeNumber(highs[index])
    const low = safeNumber(lows[index])
    const close = safeNumber(closes[index])
    const volume = safeNumber(volumes[index])
    if (!Number.isFinite(timestamp) || open === null || high === null || low === null || close === null) continue
    points.push({ timestamp, open, high, low, close, volume })
  }

  if (points.length === 0) return null
  const last = points[points.length - 1]
  const prev = points.length > 1 ? points[points.length - 2] : null
  const prevClose = prev?.close ?? last.open
  const change = last.close - prevClose
  const changePct = prevClose === 0 ? 0 : (change / prevClose) * 100

  return {
    symbol,
    providerSymbol,
    price: last.close,
    change,
    changePct,
    open: last.open,
    high: last.high,
    low: last.low,
    prevClose,
    volume: last.volume,
    currency: typeof result?.meta?.currency === 'string' ? result.meta.currency : null,
    description: typeof result?.meta?.shortName === 'string' ? result.meta.shortName : symbol,
    timestamp: last.timestamp * 1000,
  }
}

async function fetchYahooSnapshotQuotes(symbols: string[]): Promise<MarketQuote[]> {
  if (symbols.length === 0) return []
  const snapshots = await Promise.all(symbols.map((symbol) => fetchYahooSnapshotQuote(symbol).catch(() => null)))
  return snapshots.filter((quote): quote is MarketQuote => Boolean(quote))
}

async function fetchBinanceQuotes(symbols: string[]): Promise<MarketQuote[]> {
  if (symbols.length === 0) return []

  const providerSymbols = symbols
    .map((symbol) => symbolToBinanceSymbol(symbol))
    .filter((value): value is string => Boolean(value))

  if (providerSymbols.length === 0) return []

  const url = `${getBinanceApiBaseUrl()}/api/v3/ticker/24hr?symbols=${encodeURIComponent(JSON.stringify(providerSymbols))}`
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'QuantumTraders/1.0',
    },
    next: { revalidate: 0 },
  })

  if (!response.ok) {
    throw new Error(`Binance quote provider responded with status ${response.status}`)
  }

  const payload = await response.json()
  const rows = Array.isArray(payload) ? payload : []

  const quotes: MarketQuote[] = []
  for (const row of rows) {
    const providerSymbol = String(row?.symbol ?? '')
    const internalSymbol = REVERSE_BINANCE_SYMBOL_MAP[providerSymbol] ?? providerSymbol
    if (!internalSymbol || !MARKET_SYMBOL_MAP[internalSymbol]) continue

    quotes.push({
      symbol: internalSymbol,
      providerSymbol,
      price: parseBinanceNumeric(row?.lastPrice),
      change: parseBinanceNumeric(row?.priceChange),
      changePct: parseBinanceNumeric(row?.priceChangePercent),
      open: parseBinanceNumeric(row?.openPrice),
      high: parseBinanceNumeric(row?.highPrice),
      low: parseBinanceNumeric(row?.lowPrice),
      prevClose: parseBinanceNumeric(row?.prevClosePrice),
      volume: parseBinanceNumeric(row?.volume),
      currency: 'USDT',
      description: internalSymbol,
      timestamp: Number.parseInt(String(row?.closeTime ?? Date.now()), 10) || Date.now(),
    })
  }

  return quotes
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

  const cryptoSymbols = normalizedSymbols.filter((symbol) => Boolean(symbolToBinanceSymbol(symbol)))
  const nonCryptoSymbols = normalizedSymbols.filter((symbol) => !symbolToBinanceSymbol(symbol))

  let binanceQuotes: MarketQuote[] = []
  try {
    binanceQuotes = await fetchBinanceQuotes(cryptoSymbols)
  } catch {
    binanceQuotes = []
  }

  const resolvedSymbols = new Set(binanceQuotes.map((quote) => quote.symbol))
  const yahooSymbols = [...nonCryptoSymbols, ...cryptoSymbols.filter((symbol) => !resolvedSymbols.has(symbol))]
  const yahooQuotes = await fetchYahooQuotes(yahooSymbols)
  const merged = new Map<string, MarketQuote>()
  for (const quote of binanceQuotes) merged.set(quote.symbol, quote)
  for (const quote of yahooQuotes) {
    if (!merged.has(quote.symbol)) merged.set(quote.symbol, quote)
  }

  const unresolved = normalizedSymbols.filter((symbol) => !merged.has(symbol))
  if (unresolved.length > 0) {
    const fallbackSnapshots = await fetchYahooSnapshotQuotes(unresolved)
    for (const quote of fallbackSnapshots) {
      if (!merged.has(quote.symbol)) merged.set(quote.symbol, quote)
    }
  }

  return normalizedSymbols
    .map((symbol) => merged.get(symbol))
    .filter((quote): quote is MarketQuote => Boolean(quote))
}

function mapHistoryIntervalToBinance(interval: string): string {
  switch (interval) {
    case '15m':
      return '15m'
    case '1h':
      return '1h'
    case '4h':
      return '4h'
    case '1d':
      return '1d'
    default:
      return '1h'
  }
}

function mapRangeToApproxHours(range: string): number {
  switch (range) {
    case '1d':
      return 24
    case '5d':
      return 24 * 5
    case '1mo':
      return 24 * 30
    case '3mo':
      return 24 * 90
    case '6mo':
      return 24 * 180
    case '1y':
      return 24 * 365
    default:
      return 24 * 30
  }
}

function estimateBinanceLimit(interval: string, range: string): number {
  const intervalHours = interval === '15m' ? 0.25 : interval === '4h' ? 4 : interval === '1d' ? 24 : 1
  const approxHours = mapRangeToApproxHours(range)
  const estimated = Math.ceil(approxHours / intervalHours)
  return clamp(estimated, 50, 1000)
}

async function fetchBinanceHistory(symbol: string, options?: { interval?: string; range?: string }): Promise<Candle[]> {
  const providerSymbol = symbolToBinanceSymbol(symbol)
  if (!providerSymbol) return []

  const interval = mapHistoryIntervalToBinance(options?.interval ?? '1h')
  const range = options?.range ?? '1mo'
  const limit = estimateBinanceLimit(interval, range)
  const url = `${getBinanceApiBaseUrl()}/api/v3/klines?symbol=${encodeURIComponent(providerSymbol)}&interval=${encodeURIComponent(interval)}&limit=${limit}`

  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'QuantumTraders/1.0',
    },
    next: { revalidate: 0 },
  })

  if (!response.ok) {
    throw new Error(`Binance history provider responded with status ${response.status}`)
  }

  const payload = await response.json()
  if (!Array.isArray(payload)) return []

  const candles: Candle[] = []
  for (const row of payload) {
    if (!Array.isArray(row)) continue

    const openTime = Number(row[0])
    const open = parseBinanceNumeric(row[1])
    const high = parseBinanceNumeric(row[2])
    const low = parseBinanceNumeric(row[3])
    const close = parseBinanceNumeric(row[4])
    const volume = parseBinanceNumeric(row[5])

    if (!Number.isFinite(openTime) || open === null || high === null || low === null || close === null) {
      continue
    }

    candles.push({
      timestamp: openTime,
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

export async function fetchMarketHistory(
  symbol: string,
  options?: { interval?: string; range?: string },
): Promise<Candle[]> {
  const normalizedSymbol = symbol.toUpperCase().trim()

  if (symbolToBinanceSymbol(normalizedSymbol)) {
    try {
      const binanceCandles = await fetchBinanceHistory(normalizedSymbol, options)
      if (binanceCandles.length > 0) return binanceCandles
    } catch {
      // Fallback to Yahoo below
    }
  }

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
