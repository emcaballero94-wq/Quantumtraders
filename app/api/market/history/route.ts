import { NextResponse } from 'next/server'
import { fetchMarketHistory } from '@/lib/market-data'
import { rejectIfRateLimited } from '@/lib/server/endpoint-guards'
import { withApiCache } from '@/lib/server/api-cache'

export async function GET(request: Request) {
  const blocked = rejectIfRateLimited(request, {
    routeKey: 'market-history',
    limit: 120,
    windowMs: 60_000,
  })
  if (blocked) return blocked

  const { searchParams } = new URL(request.url)
  const symbol = (searchParams.get('symbol') ?? 'XAUUSD').toUpperCase().replace('/', '')
  const interval = searchParams.get('interval') ?? '1h'
  const outputsize = Number.parseInt(searchParams.get('outputsize') ?? '200', 10)

  try {
    const candles = await withApiCache(
      `market-history:${symbol}:${interval}`,
      30_000,
      async () => fetchMarketHistory(symbol, { interval, range: '1mo' }),
    )
    const sliceSize = Number.isFinite(outputsize) && outputsize > 0 ? outputsize : 200
    const formattedData = candles.slice(-sliceSize).map((candle) => ({
      time: new Date(candle.timestamp).toISOString(),
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
    }))

    return NextResponse.json(formattedData)
  } catch (error) {
    console.error('[/api/market/history] Error:', error)
    return NextResponse.json({ error: 'Failed to fetch market history' }, { status: 502 })
  }
}
