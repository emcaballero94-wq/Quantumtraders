import { NextResponse } from 'next/server'
import { computeCorrelationMatrix } from '@/lib/market-data'

const DEFAULT_SYMBOLS = ['EURUSD', 'GBPUSD', 'USDJPY', 'XAUUSD', 'DXY', 'SP500']

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const symbolsParam = searchParams.get('symbols')
  const interval = searchParams.get('interval') ?? '1h'
  const range = searchParams.get('range') ?? '1mo'

  const symbols = symbolsParam
    ? symbolsParam.split(',').map((symbol) => symbol.trim().toUpperCase()).filter(Boolean)
    : DEFAULT_SYMBOLS

  try {
    const result = await computeCorrelationMatrix(symbols, { interval, range })
    return NextResponse.json({
      ...result,
      interval,
      range,
      updatedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[/api/market/correlations] Error:', error)
    return NextResponse.json(
      {
        symbols,
        matrix: [],
        sampleSize: 0,
        strongestPositive: null,
        strongestNegative: null,
        interval,
        range,
        updatedAt: new Date().toISOString(),
        error: 'Failed to compute correlations',
      },
      { status: 502 },
    )
  }
}
