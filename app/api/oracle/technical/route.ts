import { NextRequest, NextResponse } from 'next/server'
import { analyzeTechnical } from '@/lib/oracle/technical-engine'
import type { TechnicalRequest, TechnicalResponse } from '@/lib/oracle/types'
import { fetchMarketHistory, resampleCandles } from '@/lib/market-data'
import { rejectIfRateLimited } from '@/lib/server/endpoint-guards'
import { withApiCache } from '@/lib/server/api-cache'

function buildResponseError(message: string, status: number): NextResponse<TechnicalResponse> {
  return NextResponse.json(
    { success: false, data: null, error: message },
    { status },
  )
}

export async function POST(req: NextRequest): Promise<NextResponse<TechnicalResponse>> {
  const blocked = rejectIfRateLimited(req, {
    routeKey: 'oracle-technical-post',
    limit: 90,
    windowMs: 60_000,
  })
  if (blocked) return blocked as NextResponse<TechnicalResponse>

  try {
    const body = (await req.json()) as TechnicalRequest

    if (!body.symbol || !body.candles) {
      return buildResponseError('Missing required fields: symbol, candles', 400)
    }

    const { symbol, candles } = body
    if (!candles.h4?.length || !candles.h1?.length || !candles.m15?.length) {
      return buildResponseError('candles must include h4, h1, m15 arrays', 400)
    }

    if (candles.h1.length < 50) {
      return buildResponseError('Insufficient candle data - minimum 50 H1 candles required', 422)
    }

    const result = analyzeTechnical(symbol.toUpperCase(), candles)
    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    console.error('[/api/oracle/technical POST] Error:', error)
    return buildResponseError('Internal server error', 500)
  }
}

export async function GET(req: NextRequest): Promise<NextResponse<TechnicalResponse>> {
  const blocked = rejectIfRateLimited(req, {
    routeKey: 'oracle-technical-get',
    limit: 90,
    windowMs: 60_000,
  })
  if (blocked) return blocked as NextResponse<TechnicalResponse>

  try {
    const { searchParams } = new URL(req.url)
    const symbol = (searchParams.get('symbol') ?? 'EURUSD').toUpperCase()

    const [h1, m15] = await Promise.all([
      withApiCache(`oracle-technical:${symbol}:h1`, 30_000, async () =>
        fetchMarketHistory(symbol, { interval: '1h', range: '1mo' }),
      ),
      withApiCache(`oracle-technical:${symbol}:m15`, 30_000, async () =>
        fetchMarketHistory(symbol, { interval: '15m', range: '5d' }),
      ),
    ])
    const h4 = resampleCandles(h1, 4)

    if (h4.length < 30 || h1.length < 80 || m15.length < 120) {
      return buildResponseError('Insufficient live market history for technical analysis', 422)
    }

    const result = analyzeTechnical(symbol, {
      h4: h4.slice(-120),
      h1: h1.slice(-240),
      m15: m15.slice(-320),
    })

    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    console.error('[/api/oracle/technical GET] Error:', error)
    return buildResponseError('Internal server error', 500)
  }
}
