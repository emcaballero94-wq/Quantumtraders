export interface OptionExpiration {
  date: string
}

export interface OptionGreeks {
  delta: number | null
  gamma: number | null
  theta: number | null
  vega: number | null
  impliedVolatility: number | null
}

export interface OptionContract {
  symbol: string
  underlying: string
  expirationDate: string
  strike: number
  optionType: 'call' | 'put'
  bid: number | null
  ask: number | null
  last: number | null
  volume: number | null
  openInterest: number | null
  greeks: OptionGreeks | null
}

export function isTradierConfigured(): boolean {
  return Boolean(process.env.TRADIER_API_TOKEN)
}

function getTradierBaseUrl(): string {
  return process.env.TRADIER_ENVIRONMENT === 'production'
    ? 'https://api.tradier.com/v1'
    : 'https://sandbox.tradier.com/v1'
}

async function tradierGet(path: string): Promise<unknown> {
  if (!isTradierConfigured()) return null

  const url = `${getTradierBaseUrl()}${path}`
  let response: Response
  try {
    response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${process.env.TRADIER_API_TOKEN}`,
        Accept: 'application/json',
      },
      next: { revalidate: 0 },
    })
  } catch (error) {
    console.error(`[tradierGet] Network error for ${path}:`, error)
    return null
  }

  if (!response.ok) {
    console.error(`[tradierGet] ${path} responded with status ${response.status}`)
    return null
  }

  try {
    return await response.json()
  } catch (error) {
    console.error(`[tradierGet] Failed to parse response for ${path}:`, error)
    return null
  }
}

// Never throws — returns null on any failure. Used only to highlight the
// at-the-money strike in the chain UI, so a miss just skips that highlight.
export async function fetchUnderlyingLastPrice(symbol: string): Promise<number | null> {
  const payload = await tradierGet(`/markets/quotes?symbols=${encodeURIComponent(symbol.toUpperCase())}`)
  if (!payload) return null

  const raw = (payload as { quotes?: { quote?: { last?: number } | { last?: number }[] } })?.quotes?.quote
  if (!raw) return null
  const quote = Array.isArray(raw) ? raw[0] : raw
  return safeNumber(quote?.last)
}

// Never throws — returns [] on any failure (missing credentials, network,
// non-2xx, malformed payload, or a symbol with no listed options).
export async function fetchOptionExpirations(symbol: string): Promise<string[]> {
  const payload = await tradierGet(
    `/markets/options/expirations?symbol=${encodeURIComponent(symbol.toUpperCase())}&includeAllRoots=true`,
  )
  if (!payload) return []

  const raw = (payload as { expirations?: { date?: string | string[] } })?.expirations?.date
  if (!raw) return []
  const dates = Array.isArray(raw) ? raw : [raw]
  return dates.filter((date): date is string => typeof date === 'string')
}

function safeNumber(value: unknown): number | null {
  if (typeof value !== 'number') return null
  if (!Number.isFinite(value)) return null
  return value
}

interface TradierOptionRow {
  symbol?: string
  underlying?: string
  expiration_date?: string
  strike?: number
  option_type?: string
  bid?: number
  ask?: number
  last?: number
  volume?: number
  open_interest?: number
  greeks?: {
    delta?: number
    gamma?: number
    theta?: number
    vega?: number
    mid_iv?: number
  } | null
}

// Never throws — returns [] on any failure, same contract as above.
export async function fetchOptionChain(symbol: string, expiration: string): Promise<OptionContract[]> {
  const payload = await tradierGet(
    `/markets/options/chains?symbol=${encodeURIComponent(symbol.toUpperCase())}&expiration=${encodeURIComponent(expiration)}&greeks=true`,
  )
  if (!payload) return []

  const raw = (payload as { options?: { option?: TradierOptionRow | TradierOptionRow[] } })?.options?.option
  if (!raw) return []
  const rows = Array.isArray(raw) ? raw : [raw]

  const contracts: OptionContract[] = []
  for (const row of rows) {
    const strike = safeNumber(row.strike)
    const optionType = row.option_type === 'put' ? 'put' : row.option_type === 'call' ? 'call' : null
    if (strike === null || !optionType || !row.symbol) continue

    contracts.push({
      symbol: row.symbol,
      underlying: row.underlying ?? symbol.toUpperCase(),
      expirationDate: row.expiration_date ?? expiration,
      strike,
      optionType,
      bid: safeNumber(row.bid),
      ask: safeNumber(row.ask),
      last: safeNumber(row.last),
      volume: safeNumber(row.volume),
      openInterest: safeNumber(row.open_interest),
      greeks: row.greeks
        ? {
            delta: safeNumber(row.greeks.delta),
            gamma: safeNumber(row.greeks.gamma),
            theta: safeNumber(row.greeks.theta),
            vega: safeNumber(row.greeks.vega),
            impliedVolatility: safeNumber(row.greeks.mid_iv),
          }
        : null,
    })
  }

  contracts.sort((a, b) => a.strike - b.strike)
  return contracts
}
