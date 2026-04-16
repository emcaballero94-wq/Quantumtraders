import { NextResponse } from 'next/server'
import { fetchMarketHistory } from '@/lib/market-data'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const symbol = (searchParams.get('symbol') ?? 'XAUUSD').toUpperCase().replace('/', '')
  const interval = searchParams.get('interval') ?? '1h'
  const outputsize = Number.parseInt(searchParams.get('outputsize') ?? '200', 10)

  try {
    const candles = await fetchMarketHistory(symbol, { interval, range: '1mo' })
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
