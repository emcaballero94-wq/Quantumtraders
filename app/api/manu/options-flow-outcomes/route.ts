import { NextResponse } from 'next/server'
import { rejectIfRateLimited } from '@/lib/server/endpoint-guards'
import { computeAccuracySummary } from '@/lib/manu-options-flow/outcome-persistence'

const ENGINE = 'options_flow'

export async function GET(request: Request) {
  const blocked = rejectIfRateLimited(request, {
    routeKey: 'manu-options-flow-outcomes',
    limit: 30,
    windowMs: 60_000,
  })
  if (blocked) return blocked

  const { searchParams } = new URL(request.url)
  const currency = searchParams.get('currency')?.trim().toUpperCase()
  if (currency !== 'BTC' && currency !== 'ETH') {
    return NextResponse.json({ success: false, error: 'currency must be BTC or ETH' }, { status: 400 })
  }

  const summary = await computeAccuracySummary(ENGINE, currency)
  return NextResponse.json({ success: true, data: summary })
}
