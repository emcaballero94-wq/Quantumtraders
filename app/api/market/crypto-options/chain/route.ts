import { NextResponse } from 'next/server'
import { fetchCryptoOptionChain } from '@/lib/deribit-data'
import { rejectIfRateLimited } from '@/lib/server/endpoint-guards'

export async function GET(request: Request) {
  const blocked = rejectIfRateLimited(request, {
    routeKey: 'market-crypto-options-chain',
    limit: 60,
    windowMs: 60_000,
  })
  if (blocked) return blocked

  const { searchParams } = new URL(request.url)
  const currency = searchParams.get('currency')?.trim().toUpperCase()
  const expiration = searchParams.get('expiration')?.trim()
  if (currency !== 'BTC' && currency !== 'ETH') {
    return NextResponse.json({ success: false, error: 'currency must be BTC or ETH', contracts: [] }, { status: 400 })
  }
  if (!expiration) {
    return NextResponse.json({ success: false, error: 'expiration is required', contracts: [] }, { status: 400 })
  }

  try {
    const { contracts, underlyingPrice } = await fetchCryptoOptionChain(currency, expiration)
    return NextResponse.json({ success: true, contracts, underlyingPrice })
  } catch (error) {
    console.error('[/api/market/crypto-options/chain] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch option chain', contracts: [], underlyingPrice: null },
      { status: 502 },
    )
  }
}
