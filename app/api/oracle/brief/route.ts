import { NextResponse } from 'next/server'
import { buildOracleState } from '@/lib/oracle/live-state'

export async function GET() {
  try {
    const state = await buildOracleState()
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
