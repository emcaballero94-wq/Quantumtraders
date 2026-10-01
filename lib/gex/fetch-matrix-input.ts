import { fetchOptionChain, fetchOptionExpirations, fetchUnderlyingLastPrice, isTradierConfigured } from '@/lib/tradier-data'
import { fetchCryptoOptionChain, fetchCryptoOptionExpirations, type CryptoOptionCurrency } from '@/lib/deribit-data'
import { yearsToExpiry } from './expiry'
import type { GexContract } from './compute'
import type { GexMatrixExpiryInput } from './matrix'

export type GexAssetClass = 'equity' | 'crypto'

export interface GexMatrixFetchResult {
  underlyingPrice: number | null
  perExpiration: GexMatrixExpiryInput[]
}

interface RawContract {
  strike: number
  optionType: 'call' | 'put'
  openInterest: number | null
  greeks: { gamma: number | null; impliedVolatility: number | null } | null
  last: number | null
}

function toGexContracts(contracts: RawContract[]): GexContract[] {
  return contracts.map((c) => ({
    strike: c.strike,
    optionType: c.optionType,
    openInterest: c.openInterest ?? 0,
    gamma: c.greeks?.gamma ?? null,
    iv: c.greeks?.impliedVolatility ?? null,
    last: c.last,
  }))
}

// Fetches the nearest `maxExpirations` future expirations for a symbol and
// builds the per-expiration contract lists a GEX matrix needs — shared by the
// live matrix endpoint and the daily snapshot cron job so both pick
// expirations and map contracts the same way. Never throws: a chain that
// fails to fetch is just dropped from the matrix, same defensive contract as
// the underlying Tradier/Deribit clients.
export async function fetchGexMatrixInput(
  assetClass: GexAssetClass,
  symbolOrCurrency: string,
  maxExpirations: number,
  now = new Date(),
): Promise<GexMatrixFetchResult> {
  if (assetClass === 'equity') {
    if (!isTradierConfigured()) return { underlyingPrice: null, perExpiration: [] }

    const symbol = symbolOrCurrency.toUpperCase()
    const [allExpirations, underlyingPrice] = await Promise.all([
      fetchOptionExpirations(symbol),
      fetchUnderlyingLastPrice(symbol),
    ])
    if (underlyingPrice === null) return { underlyingPrice: null, perExpiration: [] }

    const expirations = allExpirations
      .filter((e) => yearsToExpiry(e, now) > 0)
      .sort()
      .slice(0, maxExpirations)

    const perExpiration = await Promise.all(
      expirations.map(async (expiration) => ({
        expiration,
        yearsToExpiry: yearsToExpiry(expiration, now),
        contracts: toGexContracts(await fetchOptionChain(symbol, expiration)),
      })),
    )

    return { underlyingPrice, perExpiration: perExpiration.filter((e) => e.contracts.length > 0) }
  }

  const currency = symbolOrCurrency.toUpperCase() as CryptoOptionCurrency
  if (currency !== 'BTC' && currency !== 'ETH') return { underlyingPrice: null, perExpiration: [] }

  const allExpirations = await fetchCryptoOptionExpirations(currency)
  const expirations = allExpirations
    .filter((e) => yearsToExpiry(e, now) > 0)
    .sort()
    .slice(0, maxExpirations)

  // Sequential, not Promise.all: fetchCryptoOptionChain already fires one
  // ticker request per strike in parallel for a single expiration — stacking
  // that across every expiration too would multiply concurrent requests to
  // Deribit's public API well beyond what a background job needs to risk.
  let underlyingPrice: number | null = null
  const perExpiration: GexMatrixExpiryInput[] = []
  for (const expiration of expirations) {
    const { contracts, underlyingPrice: price } = await fetchCryptoOptionChain(currency, expiration)
    if (price !== null) underlyingPrice = price
    if (contracts.length > 0) {
      perExpiration.push({ expiration, yearsToExpiry: yearsToExpiry(expiration, now), contracts: toGexContracts(contracts) })
    }
  }

  return { underlyingPrice, perExpiration }
}
