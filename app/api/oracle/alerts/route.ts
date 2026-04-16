import { NextResponse } from 'next/server'
import type { AlertsResponse } from '@/lib/oracle/types'
import { buildOracleState } from '@/lib/oracle/live-state'

export async function GET(): Promise<NextResponse<AlertsResponse>> {
  try {
    const state = await buildOracleState()
    return NextResponse.json({ success: true, data: state.alerts })
  } catch (error) {
    console.error('[/api/oracle/alerts] Error:', error)
    return NextResponse.json(
      { success: false, data: [], error: 'Internal server error' },
      { status: 500 },
    )
  }
}
