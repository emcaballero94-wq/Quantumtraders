export type CryptoOptionCurrency = 'BTC' | 'ETH'

export interface CryptoOptionGreeks {
  delta: number | null
  gamma: number | null
  theta: number | null
  vega: number | null
  impliedVolatility: number | null
}

export interface CryptoOptionContract {
  symbol: string
  underlying: CryptoOptionCurrency
  expirationDate: string
  strike: number
  optionType: 'call' | 'put'
  /** Bid/ask/last are denominated in the underlying coin (BTC or ETH), not USD — Deribit options are coin-settled. */
  bid: number | null
  ask: number | null
  last: number | null
  volume: number | null
  openInterest: number | null
  greeks: CryptoOptionGreeks | null
}

const DERIBIT_BASE_URL = 'https://www.deribit.com/api/v2'

function safeNumber(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return value
}

// Deribit's public market-data endpoints need no API key — unlike Tradier's
// equity options, this is free and unauthenticated for anyone.
async function deribitGet(path: string): Promise<unknown> {
  let response: Response
  try {
    response = await fetch(`${DERIBIT_BASE_URL}${path}`, {
      headers: { Accept: 'application/json' },
      next: { revalidate: 0 },
    })
  } catch (error) {
    console.error(`[deribitGet] Network error for ${path}:`, error)
    return null
  }

  if (!response.ok) {
    console.error(`[deribitGet] ${path} responded with status ${response.status}`)
    return null
  }

  try {
    const payload = (await response.json()) as { result?: unknown }
    return payload?.result ?? null
  } catch (error) {
    console.error(`[deribitGet] Failed to parse response for ${path}:`, error)
    return null
  }
}

interface DeribitInstrument {
  instrument_name: string
  expiration_timestamp: number
  strike: number
  option_type: 'call' | 'put'
}

function formatExpirationDate(timestampMs: number): string {
  return new Date(timestampMs).toISOString().slice(0, 10)
}

async function fetchActiveInstruments(currency: CryptoOptionCurrency): Promise<DeribitInstrument[]> {
  const result = await deribitGet(`/public/get_instruments?currency=${currency}&kind=option&expired=false`)
  if (!Array.isArray(result)) return []

  return result.filter((row): row is DeribitInstrument => {
    const r = row as Record<string, unknown>
    return (
      typeof r?.instrument_name === 'string' &&
      typeof r?.expiration_timestamp === 'number' &&
      typeof r?.strike === 'number' &&
      (r?.option_type === 'call' || r?.option_type === 'put')
    )
  })
}

// Never throws — returns [] on any failure (network, non-2xx, malformed
// payload, or a currency with no listed options), same contract as Tradier's
// fetchOptionExpirations.
export async function fetchCryptoOptionExpirations(currency: CryptoOptionCurrency): Promise<string[]> {
  const instruments = await fetchActiveInstruments(currency)
  const dates = new Set(instruments.map((i) => formatExpirationDate(i.expiration_timestamp)))
  return Array.from(dates).sort()
}

interface DeribitTicker {
  best_bid_price?: number
  best_ask_price?: number
  last_price?: number
  open_interest?: number
  underlying_price?: number
  index_price?: number
  mark_iv?: number
  stats?: { volume?: number }
  greeks?: { delta?: number; gamma?: number; theta?: number; vega?: number }
}

// Never throws — returns an empty chain on any failure, same contract as
// Tradier's fetchOptionChain.
export async function fetchCryptoOptionChain(
  currency: CryptoOptionCurrency,
  expirationDate: string,
): Promise<{ contracts: CryptoOptionContract[]; underlyingPrice: number | null }> {
  const instruments = await fetchActiveInstruments(currency)
  const matching = instruments.filter((i) => formatExpirationDate(i.expiration_timestamp) === expirationDate)
  if (matching.length === 0) return { contracts: [], underlyingPrice: null }

  // One ticker call per contract for this single expiration (typically a few
  // dozen strikes) — bounded and parallelized, unlike re-fetching the whole
  // instrument list per strike.
  const tickers = await Promise.all(
    matching.map(async (instrument) => ({
      instrument,
      ticker: (await deribitGet(`/public/ticker?instrument_name=${encodeURIComponent(instrument.instrument_name)}`)) as DeribitTicker | null,
    })),
  )

  let underlyingPrice: number | null = null
  const contracts: CryptoOptionContract[] = []

  for (const { instrument, ticker } of tickers) {
    if (underlyingPrice === null && ticker) {
      underlyingPrice = safeNumber(ticker.underlying_price) ?? safeNumber(ticker.index_price)
    }

    contracts.push({
      symbol: instrument.instrument_name,
      underlying: currency,
      expirationDate,
      strike: instrument.strike,
      optionType: instrument.option_type,
      bid: safeNumber(ticker?.best_bid_price),
      ask: safeNumber(ticker?.best_ask_price),
      last: safeNumber(ticker?.last_price),
      volume: safeNumber(ticker?.stats?.volume),
      openInterest: safeNumber(ticker?.open_interest),
      greeks: ticker?.greeks
        ? {
            delta: safeNumber(ticker.greeks.delta),
            gamma: safeNumber(ticker.greeks.gamma),
            theta: safeNumber(ticker.greeks.theta),
            vega: safeNumber(ticker.greeks.vega),
            impliedVolatility: safeNumber(ticker.mark_iv),
          }
        : null,
    })
  }

  contracts.sort((a, b) => a.strike - b.strike)
  return { contracts, underlyingPrice }
}
