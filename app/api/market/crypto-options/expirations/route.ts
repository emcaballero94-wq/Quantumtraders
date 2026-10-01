import { NextResponse } from 'next/server'
import { fetchCryptoOptionExpirations } from '@/lib/deribit-data'
import { rejectIfRateLimited } from '@/lib/server/endpoint-guards'

export async function GET(request: Request) {
  const blocked = rejectIfRateLimited(request, {
    routeKey: 'market-crypto-options-expirations',
    limit: 60,
    windowMs: 60_000,
  })
  if (blocked) return blocked

  const { searchParams } = new URL(request.url)
  const currency = searchParams.get('currency')?.trim().toUpperCase()
  if (currency !== 'BTC' && currency !== 'ETH') {
    return NextResponse.json({ success: false, error: 'currency must be BTC or ETH', expirations: [] }, { status: 400 })
  }

  try {
    const expirations = await fetchCryptoOptionExpirations(currency)
    return NextResponse.json({ success: true, expirations })
  } catch (error) {
    console.error('[/api/market/crypto-options/expirations] Error:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch expirations', expirations: [] }, { status: 502 })
  }
}
