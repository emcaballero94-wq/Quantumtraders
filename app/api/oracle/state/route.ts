import { NextResponse } from 'next/server'
import { buildOracleState } from '@/lib/oracle/live-state'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const forceRefresh = searchParams.get('refresh') === '1'

  try {
    const state = await buildOracleState({ forceRefresh })
    return NextResponse.json({ success: true, data: state })
  } catch (error) {
    console.error('[/api/oracle/state] Error:', error)
    return NextResponse.json({ success: false, data: null, error: 'Failed to build oracle state' }, { status: 500 })
  }
}
