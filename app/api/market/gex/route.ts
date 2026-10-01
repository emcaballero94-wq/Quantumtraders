import { NextResponse } from 'next/server'
import { fetchOptionChain, fetchUnderlyingLastPrice, isTradierConfigured } from '@/lib/tradier-data'
import { fetchCryptoOptionChain, type CryptoOptionCurrency } from '@/lib/deribit-data'
import { computeGex, type GexContract } from '@/lib/gex/compute'
import { yearsToExpiry } from '@/lib/gex/expiry'
import { rejectIfRateLimited } from '@/lib/server/endpoint-guards'

export async function GET(request: Request) {
  const blocked = rejectIfRateLimited(request, {
    routeKey: 'market-gex',
    limit: 30,
    windowMs: 60_000,
  })
  if (blocked) return blocked

  const { searchParams } = new URL(request.url)
  const assetClass = searchParams.get('assetClass') === 'crypto' ? 'crypto' : 'equity'
  const expiration = searchParams.get('expiration')?.trim()
  if (!expiration) {
    return NextResponse.json({ success: false, error: 'expiration is required' }, { status: 400 })
  }

  const yearsLeft = yearsToExpiry(expiration, new Date())
  if (yearsLeft <= 0) {
    return NextResponse.json({ success: false, error: 'Esa fecha de vencimiento ya pasó.' }, { status: 400 })
  }

  try {
    if (assetClass === 'equity') {
      if (!isTradierConfigured()) {
        return NextResponse.json(
          { success: false, error: 'TRADIER_API_TOKEN no está configurada. GEX no está disponible para acciones.' },
          { status: 200 },
        )
      }

      const symbol = searchParams.get('symbol')?.trim().toUpperCase()
      if (!symbol) return NextResponse.json({ success: false, error: 'symbol is required' }, { status: 400 })

      const [contracts, underlyingPrice] = await Promise.all([
        fetchOptionChain(symbol, expiration),
        fetchUnderlyingLastPrice(symbol),
      ])

      if (underlyingPrice === null) {
        return NextResponse.json({ success: false, error: `No se pudo obtener el precio de ${symbol}.` }, { status: 200 })
      }

      const gexContracts: GexContract[] = contracts.map((c) => ({
        strike: c.strike,
        optionType: c.optionType,
        openInterest: c.openInterest ?? 0,
        gamma: c.greeks?.gamma ?? null,
        iv: c.greeks?.impliedVolatility ?? null,
        last: c.last,
      }))

      const result = computeGex(gexContracts, underlyingPrice, yearsLeft)
      return NextResponse.json({ success: true, underlyingPrice, expiration, assetClass, symbol, ...result })
    }

    const currency = searchParams.get('currency')?.trim().toUpperCase()
    if (currency !== 'BTC' && currency !== 'ETH') {
      return NextResponse.json({ success: false, error: 'currency must be BTC or ETH' }, { status: 400 })
    }

    const { contracts, underlyingPrice } = await fetchCryptoOptionChain(currency as CryptoOptionCurrency, expiration)
    if (underlyingPrice === null) {
      return NextResponse.json({ success: false, error: `No se pudo obtener el precio de ${currency}.` }, { status: 200 })
    }

    const gexContracts: GexContract[] = contracts.map((c) => ({
      strike: c.strike,
      optionType: c.optionType,
      openInterest: c.openInterest ?? 0,
      gamma: c.greeks?.gamma ?? null,
      iv: c.greeks?.impliedVolatility ?? null,
      last: c.last,
    }))

    const result = computeGex(gexContracts, underlyingPrice, yearsLeft)
    return NextResponse.json({ success: true, underlyingPrice, expiration, assetClass, currency, ...result })
  } catch (error) {
    console.error('[/api/market/gex] Error:', error)
    return NextResponse.json({ success: false, error: 'Failed to compute GEX' }, { status: 502 })
  }
}
