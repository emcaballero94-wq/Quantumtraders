import { NextResponse } from 'next/server'
import { rejectIfRateLimited } from '@/lib/server/endpoint-guards'
import { listMarketEventsSince } from '@/lib/oracle/market-events-persistence'

const DEFAULT_LOOKBACK_MS = 4 * 60 * 60_000

export async function GET(request: Request) {
  const blocked = rejectIfRateLimited(request, {
    routeKey: 'manu-events',
    limit: 30,
    windowMs: 60_000,
  })
  if (blocked) return blocked

  const { searchParams } = new URL(request.url)
  const symbol = searchParams.get('symbol')?.trim().toUpperCase()
  if (!symbol) {
    return NextResponse.json({ success: false, error: 'symbol is required' }, { status: 400 })
  }

  const sinceParam = searchParams.get('since')
  const since = sinceParam ? new Date(sinceParam) : new Date(Date.now() - DEFAULT_LOOKBACK_MS)
  if (Number.isNaN(since.getTime())) {
    return NextResponse.json({ success: false, error: 'invalid since parameter' }, { status: 400 })
  }

  const events = await listMarketEventsSince(symbol, since.toISOString(), 500)

  return NextResponse.json({
    success: true,
    data: {
      symbol,
      since: since.toISOString(),
      count: events.length,
      events,
    },
  })
}
