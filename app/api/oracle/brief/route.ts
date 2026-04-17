import { NextResponse } from 'next/server'
import { buildOracleState } from '@/lib/oracle/live-state'
import { withApiCache } from '@/lib/server/api-cache'
import { rejectIfRateLimited } from '@/lib/server/endpoint-guards'

export async function GET(request: Request) {
  const blocked = rejectIfRateLimited(request, {
    routeKey: 'oracle-brief',
    limit: 90,
    windowMs: 60_000,
  })
  if (blocked) return blocked

  const { searchParams } = new URL(request.url)
  const forceRefresh = searchParams.get('refresh') === '1'

  try {
    const state = forceRefresh
      ? await buildOracleState({ forceRefresh: true })
      : await withApiCache('oracle-brief', 20_000, async () => buildOracleState({ forceRefresh: false }))
    return NextResponse.json(state.brief)
  } catch (error) {
    console.error('[/api/oracle/brief] Error:', error)
    return NextResponse.json(
      {
        date: new Date().toISOString(),
        marketBias: 'neutral',
        summary: 'No fue posible generar el brief en este momento.',
        topSetup: 'Sin datos',
        keyEvent: 'Sin datos',
        activeSession: 'Off',
        conditions: 'Sin datos',
        sentiment: 'mixed',
      },
      { status: 500 },
    )
  }
}
