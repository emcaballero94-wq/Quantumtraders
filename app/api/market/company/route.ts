import { NextResponse } from 'next/server'
import { fetchCompanyProfile } from '@/lib/market-fundamentals'
import { rejectIfRateLimited } from '@/lib/server/endpoint-guards'

export async function GET(request: Request) {
  const blocked = rejectIfRateLimited(request, {
    routeKey: 'market-company',
    limit: 60,
    windowMs: 60_000,
  })
  if (blocked) return blocked

  const { searchParams } = new URL(request.url)
  const symbol = (searchParams.get('symbol') ?? '').trim().toUpperCase()
  if (!symbol) {
    return NextResponse.json({ success: false, error: 'symbol is required' }, { status: 400 })
  }

  try {
    const profile = await fetchCompanyProfile(symbol)
    if (!profile) {
      return NextResponse.json({ success: false, error: 'No se encontró información fundamental para este símbolo' }, { status: 404 })
    }
    return NextResponse.json({ success: true, data: profile })
  } catch (error) {
    console.error('[/api/market/company] Error:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch company profile' }, { status: 502 })
  }
}
