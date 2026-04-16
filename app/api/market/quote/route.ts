import { NextResponse } from 'next/server'
import { fetchMarketQuotes } from '@/lib/market-data'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const symbolsParam = searchParams.get('symbols') ?? 'XAUUSD'
  const symbols = symbolsParam
    .split(',')
    .map((symbol) => symbol.trim().toUpperCase())
    .filter(Boolean)

  try {
    const quotes = await fetchMarketQuotes(symbols)
    return NextResponse.json({ quotes })
  } catch (error) {
    console.error('[/api/market/quote] Error:', error)
    return NextResponse.json({ error: 'Failed to fetch market quotes', quotes: [] }, { status: 502 })
  }
}
