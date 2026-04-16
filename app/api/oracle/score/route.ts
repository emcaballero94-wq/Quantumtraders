import { NextRequest, NextResponse } from 'next/server'
import { computeOracleScore } from '@/lib/oracle/score-engine'
import type { ScoreRequest, ScoreResponse } from '@/lib/oracle/types'
import { rejectIfRateLimited } from '@/lib/server/endpoint-guards'

export async function POST(req: NextRequest): Promise<NextResponse<ScoreResponse>> {
  const blocked = rejectIfRateLimited(req, {
    routeKey: 'oracle-score-post',
    limit: 120,
    windowMs: 60_000,
  })
  if (blocked) return blocked as NextResponse<ScoreResponse>

  try {
    const body = await req.json() as ScoreRequest

    if (!body.symbol || body.technicalScore === undefined) {
      return NextResponse.json(
        { success: false, data: null, error: 'Missing required fields: symbol, technicalScore' },
        { status: 400 },
      )
    }

    const result = computeOracleScore({
      symbol:         body.symbol.toUpperCase(),
      macroScore:     body.macroScore     ?? 50,
      technicalScore: body.technicalScore,
      timingScore:    body.timingScore    ?? 50,
    })

    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    console.error('[/api/oracle/score] Error:', error)
    return NextResponse.json(
      { success: false, data: null, error: 'Internal server error' },
      { status: 500 },
    )
  }
}
