import { NextResponse } from 'next/server'
import { buildOracleState } from '@/lib/oracle/live-state'
import { withApiCache } from '@/lib/server/api-cache'
import { rejectIfRateLimited } from '@/lib/server/endpoint-guards'

export async function GET(request: Request) {
  const blocked = rejectIfRateLimited(request, {
    routeKey: 'oracle-state',
    limit: 90,
    windowMs: 60_000,
  })
  if (blocked) return blocked

  const { searchParams } = new URL(request.url)
  const forceRefresh = searchParams.get('refresh') === '1'

  try {
    const cacheKey = 'oracle-state'
    const state = forceRefresh
      ? await buildOracleState({ forceRefresh: true })
      : await withApiCache(cacheKey, 20_000, async () => buildOracleState({ forceRefresh: false }))
    return NextResponse.json({ success: true, data: state })
  } catch (error) {
    console.error('[/api/oracle/state] Error:', error)
    return NextResponse.json({ success: false, data: null, error: 'Failed to build oracle state' }, { status: 500 })
  }
}
