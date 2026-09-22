import { NextResponse } from 'next/server'
import { computeRelativeStrengthAndDrawdown } from '@/lib/market-relative-strength'
import { rejectIfRateLimited } from '@/lib/server/endpoint-guards'
import { withApiCache } from '@/lib/server/api-cache'

export async function GET(request: Request) {
  const blocked = rejectIfRateLimited(request, {
    routeKey: 'market-relative-strength',
    limit: 30,
    windowMs: 60_000,
  })
  if (blocked) return blocked

  const { searchParams } = new URL(request.url)
  const symbolsParam = searchParams.get('symbols') ?? 'SPX500,NAS100,US30,BTCUSD'
  const base = (searchParams.get('base') ?? 'XAUUSD').toUpperCase()
  const symbols = symbolsParam.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean)

  try {
    const data = await withApiCache(
      `market-relative-strength:${symbols.join(',')}:${base}`,
      300_000,
      async () => computeRelativeStrengthAndDrawdown(symbols, base),
    )
    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('[/api/market/relative-strength] Error:', error)
    return NextResponse.json({ success: false, error: 'Failed to compute relative strength' }, { status: 502 })
  }
}
