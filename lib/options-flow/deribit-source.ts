// Normalizes Deribit's public option-trade feed into the provider-agnostic
// OptionTrade type so the rest of lib/options-flow/ can run unchanged against
// crypto flow, same as it would against a future equities source.
//
// Deribit trade data differs from US equities in ways that matter here:
//  - `direction` ('buy'/'sell') is the taker's own side, reported by the
//    exchange — no AT_BID/AT_ASK heuristic needed like with equities quotes.
//  - Premium ("price") is denominated in the underlying coin, not USD.
//    `index_price` on the same trade is the coin/USD rate at that instant,
//    so premiumUsd = contracts * priceInCoin * indexPrice.
//  - Strike is already USD-denominated (e.g. BTC-27JUN25-70000-C means a
//    $70,000 strike), so notional = strike * contracts needs no conversion.
//  - One option contract = 1 unit of the underlying coin (no 100x multiplier
//    like equities).
//
// These field names/semantics come from Deribit's long-stable public API v2
// docs, not from a live response captured in this environment — this
// sandbox's network egress blocks deribit.com the same way it blocked
// Polygon earlier, so unlike the Polygon client this hasn't been verified
// against a real payload yet. Parsing is defensive (never throws, skips
// anything that doesn't match) so a wrong field name degrades to an empty
// result rather than invented data — confirm against a real deploy before
// trusting the numbers.

import type { CryptoCurrency } from '@/lib/manu/crypto-symbol-mapping'
import type { OptionTrade, OptionType, TradeSide, ExecutionSide } from './types'

const DERIBIT_BASE_URL = 'https://www.deribit.com/api/v2'

const MONTH_ABBREVIATIONS: Record<string, string> = {
  JAN: '01', FEB: '02', MAR: '03', APR: '04', MAY: '05', JUN: '06',
  JUL: '07', AUG: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12',
}

// Matches Deribit's option instrument naming convention, e.g.
// "BTC-27JUN25-70000-C" or "ETH-3OCT25-2600-P".
const INSTRUMENT_NAME_PATTERN = /^([A-Z]+)-(\d{1,2})([A-Z]{3})(\d{2})-(\d+(?:\.\d+)?)-([CP])$/

interface ParsedInstrument {
  strike: number
  optionType: OptionType
  expiration: string
}

function parseInstrumentName(instrumentName: string): ParsedInstrument | null {
  const match = INSTRUMENT_NAME_PATTERN.exec(instrumentName)
  if (!match) return null

  const [, , day, monthAbbr, yearTwoDigits, strikeStr, typeLetter] = match
  const month = MONTH_ABBREVIATIONS[monthAbbr]
  if (!month) return null

  const strike = Number(strikeStr)
  if (!Number.isFinite(strike)) return null

  const year = `20${yearTwoDigits}`
  const dayPadded = day.padStart(2, '0')

  return {
    strike,
    optionType: typeLetter === 'C' ? 'CALL' : 'PUT',
    expiration: `${year}-${month}-${dayPadded}`,
  }
}

// Same end-of-day-UTC convention as lib/gex/expiry.ts, for consistency
// across the codebase's handling of Deribit expirations.
function daysToExpiry(expiration: string, now: number): number {
  const expiryMs = new Date(`${expiration}T23:59:59Z`).getTime()
  return Math.max(Math.ceil((expiryMs - now) / 86_400_000), 0)
}

function safeNumber(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return value
}

interface DeribitTradeRaw {
  trade_id?: string
  timestamp?: number
  price?: number
  amount?: number
  direction?: string
  instrument_name?: string
  index_price?: number
  iv?: number
}

function normalizeTrade(raw: DeribitTradeRaw, currency: CryptoCurrency): OptionTrade | null {
  const instrumentName = raw.instrument_name
  if (typeof instrumentName !== 'string') return null

  const parsed = parseInstrumentName(instrumentName)
  if (!parsed) return null

  const timestamp = safeNumber(raw.timestamp)
  const priceCoin = safeNumber(raw.price)
  const amount = safeNumber(raw.amount)
  const indexPrice = safeNumber(raw.index_price)
  if (timestamp === null || amount === null) return null

  const side: TradeSide = raw.direction === 'buy' ? 'BUY' : raw.direction === 'sell' ? 'SELL' : 'UNKNOWN'
  const executionSide: ExecutionSide = raw.direction === 'buy' ? 'AT_ASK' : raw.direction === 'sell' ? 'AT_BID' : 'UNKNOWN'

  const premium = priceCoin !== null && indexPrice !== null ? amount * priceCoin * indexPrice : null
  const notional = amount * parsed.strike

  return {
    symbol: instrumentName,
    underlying: currency,
    timestamp,
    optionType: parsed.optionType,
    side,
    strike: parsed.strike,
    expiration: parsed.expiration,
    dte: daysToExpiry(parsed.expiration, timestamp),
    contracts: amount,
    premium,
    notional,
    bid: null,
    ask: null,
    price: priceCoin,
    executionSide,
    impliedVolatility: safeNumber(raw.iv),
    delta: null,
    gamma: null,
    theta: null,
    vega: null,
    openInterest: null,
    volume: null,
    source: 'deribit',
  }
}

export interface FetchDeribitTradesOptions {
  /** Max trades to request from Deribit (capped at 1000 by the API itself). */
  count?: number
}

// Returns the most recent option trades for a currency — a single page, not
// a full historical window (see count cap above). Never throws: a network
// failure, malformed payload, or an instrument name that doesn't match the
// expected format each degrade to an empty/skipped result instead of
// invented data.
export async function fetchRecentDeribitOptionTrades(
  currency: CryptoCurrency,
  options: FetchDeribitTradesOptions = {},
): Promise<OptionTrade[]> {
  const count = Math.min(options.count ?? 1000, 1000)
  const url = `${DERIBIT_BASE_URL}/public/get_last_trades_by_currency?currency=${currency}&kind=option&count=${count}&include_old=true`

  let response: Response
  try {
    response = await fetch(url, { headers: { Accept: 'application/json' }, next: { revalidate: 0 } })
  } catch (error) {
    console.error(`[fetchRecentDeribitOptionTrades] Network error for ${currency}:`, error)
    return []
  }

  if (!response.ok) {
    console.error(`[fetchRecentDeribitOptionTrades] ${currency} responded with status ${response.status}`)
    return []
  }

  let payload: { result?: { trades?: unknown } }
  try {
    payload = (await response.json()) as { result?: { trades?: unknown } }
  } catch (error) {
    console.error(`[fetchRecentDeribitOptionTrades] Failed to parse response for ${currency}:`, error)
    return []
  }

  const rawTrades = payload?.result?.trades
  if (!Array.isArray(rawTrades)) return []

  const trades: OptionTrade[] = []
  for (const raw of rawTrades) {
    const normalized = normalizeTrade(raw as DeribitTradeRaw, currency)
    if (normalized) trades.push(normalized)
  }

  // Oldest-first, matching the convention filterByWindow/change-engine expect.
  trades.sort((a, b) => a.timestamp - b.timestamp)
  return trades
}
