import { NextResponse } from 'next/server'
import { fetchOptionChain, fetchUnderlyingLastPrice, isTradierConfigured } from '@/lib/tradier-data'
import { rejectIfRateLimited } from '@/lib/server/endpoint-guards'

export async function GET(request: Request) {
  const blocked = rejectIfRateLimited(request, {
    routeKey: 'market-options-chain',
    limit: 60,
    windowMs: 60_000,
  })
  if (blocked) return blocked

  if (!isTradierConfigured()) {
    return NextResponse.json(
      {
        success: false,
        error: 'TRADIER_API_TOKEN no está configurada. La cadena de opciones no está disponible.',
        contracts: [],
        underlyingPrice: null,
      },
      { status: 200 },
    )
  }

  const { searchParams } = new URL(request.url)
  const symbol = searchParams.get('symbol')?.trim().toUpperCase()
  const expiration = searchParams.get('expiration')?.trim()
  if (!symbol || !expiration) {
    return NextResponse.json(
      { success: false, error: 'symbol and expiration are required', contracts: [] },
      { status: 400 },
    )
  }

  try {
    const [contracts, underlyingPrice] = await Promise.all([
      fetchOptionChain(symbol, expiration),
      fetchUnderlyingLastPrice(symbol),
    ])
    return NextResponse.json({ success: true, contracts, underlyingPrice })
  } catch (error) {
    console.error('[/api/market/options/chain] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch option chain', contracts: [], underlyingPrice: null },
      { status: 502 },
    )
  }
}
