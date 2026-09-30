import { NextResponse } from 'next/server'
import { fetchOptionExpirations, isTradierConfigured } from '@/lib/tradier-data'
import { rejectIfRateLimited } from '@/lib/server/endpoint-guards'

export async function GET(request: Request) {
  const blocked = rejectIfRateLimited(request, {
    routeKey: 'market-options-expirations',
    limit: 60,
    windowMs: 60_000,
  })
  if (blocked) return blocked

  if (!isTradierConfigured()) {
    return NextResponse.json(
      { success: false, error: 'TRADIER_API_TOKEN no está configurada. La cadena de opciones no está disponible.', expirations: [] },
      { status: 200 },
    )
  }

  const { searchParams } = new URL(request.url)
  const symbol = searchParams.get('symbol')?.trim().toUpperCase()
  if (!symbol) {
    return NextResponse.json({ success: false, error: 'symbol is required', expirations: [] }, { status: 400 })
  }

  try {
    const expirations = await fetchOptionExpirations(symbol)
    return NextResponse.json({ success: true, expirations })
  } catch (error) {
    console.error('[/api/market/options/expirations] Error:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch expirations', expirations: [] }, { status: 502 })
  }
}
