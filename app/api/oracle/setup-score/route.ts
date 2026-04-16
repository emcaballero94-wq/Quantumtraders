import { NextResponse } from 'next/server'
import { buildOracleState } from '@/lib/oracle/live-state'
import { scoreSetupFromAsset } from '@/lib/oracle/setup-rules'
import { withApiCache } from '@/lib/server/api-cache'
import { rejectIfRateLimited } from '@/lib/server/endpoint-guards'

function parseOptionalNumber(raw: string | null): number | null {
  if (!raw) return null
  const value = Number.parseFloat(raw)
  return Number.isFinite(value) ? value : null
}

export async function GET(request: Request) {
  const blocked = rejectIfRateLimited(request, {
    routeKey: 'oracle-setup-score',
    limit: 120,
    windowMs: 60_000,
  })
  if (blocked) return blocked

  const { searchParams } = new URL(request.url)
  const symbol = searchParams.get('symbol')?.trim().toUpperCase()
  const entry = parseOptionalNumber(searchParams.get('entryPrice'))
  const stopLoss = parseOptionalNumber(searchParams.get('stopLoss'))
  const takeProfit = parseOptionalNumber(searchParams.get('takeProfit'))

  if (!symbol) {
    return NextResponse.json({ success: false, error: 'Missing query param: symbol' }, { status: 400 })
  }

  try {
    const state = await withApiCache('oracle-setup-score-state', 20_000, async () => buildOracleState())
    const asset = state.radar.find((item) => item.symbol === symbol)
    if (!asset) {
      return NextResponse.json({ success: false, error: `Symbol not found in radar: ${symbol}` }, { status: 404 })
    }

    const setup = scoreSetupFromAsset({
      asset,
      entry,
      stopLoss,
      takeProfit,
    })

    return NextResponse.json({
      success: true,
      data: {
        symbol: asset.symbol,
        dayBias: asset.bias === 'long' ? 'alcista' : asset.bias === 'short' ? 'bajista' : 'neutral',
        setup,
      },
    })
  } catch (error) {
    console.error('[/api/oracle/setup-score] Error:', error)
    return NextResponse.json({ success: false, error: 'Failed to compute setup score' }, { status: 500 })
  }
}
