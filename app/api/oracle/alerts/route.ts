import { NextResponse } from 'next/server'
import type { AlertsResponse } from '@/lib/oracle/types'
import { buildOracleState } from '@/lib/oracle/live-state'
import { listOracleAlerts, markOracleAlertRead } from '@/lib/oracle/persistence'
import { withApiCache } from '@/lib/server/api-cache'
import { rejectIfRateLimited } from '@/lib/server/endpoint-guards'

export async function GET(request: Request): Promise<NextResponse<AlertsResponse>> {
  const blocked = rejectIfRateLimited(request, {
    routeKey: 'oracle-alerts-get',
    limit: 100,
    windowMs: 60_000,
  })
  if (blocked) return blocked as NextResponse<AlertsResponse>

  try {
    const persisted = await withApiCache('oracle-alerts', 15_000, async () => listOracleAlerts(200))
    if (persisted.length > 0) {
      return NextResponse.json({ success: true, data: persisted })
    }

    const state = await buildOracleState()
    return NextResponse.json({ success: true, data: state.alerts })
  } catch (error) {
    console.error('[/api/oracle/alerts GET] Error:', error)
    return NextResponse.json(
      { success: false, data: [], error: 'Internal server error' },
      { status: 500 },
    )
  }
}

export async function PATCH(request: Request): Promise<NextResponse<{ success: boolean; error?: string }>> {
  const blocked = rejectIfRateLimited(request, {
    routeKey: 'oracle-alerts-patch',
    limit: 100,
    windowMs: 60_000,
  })
  if (blocked) return blocked as NextResponse<{ success: boolean; error?: string }>

  try {
    const body = (await request.json()) as { id?: string; read?: boolean }
    if (!body.id) {
      return NextResponse.json({ success: false, error: 'Missing alert id' }, { status: 400 })
    }

    const updated = await markOracleAlertRead(body.id, Boolean(body.read))
    if (!updated) {
      return NextResponse.json({ success: false, error: 'Failed to update alert state' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[/api/oracle/alerts PATCH] Error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
