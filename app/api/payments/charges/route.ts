import { NextResponse } from 'next/server'
import { listPaymentCharges } from '@/lib/payments/persistence'
import { rejectIfRateLimited } from '@/lib/server/endpoint-guards'
import { withApiCache } from '@/lib/server/api-cache'

export async function GET(request: Request) {
  const blocked = rejectIfRateLimited(request, {
    routeKey: 'payments-charges-get',
    limit: 120,
    windowMs: 60_000,
  })
  if (blocked) return blocked

  const { searchParams } = new URL(request.url)
  const limit = Number.parseInt(searchParams.get('limit') ?? '50', 10)
  const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(limit, 200) : 50

  try {
    const charges = await withApiCache(`payments-charges:${safeLimit}`, 10_000, async () => listPaymentCharges(safeLimit))
    return NextResponse.json({ success: true, data: charges })
  } catch (error) {
    console.error('[/api/payments/charges] Error:', error)
    return NextResponse.json({ success: false, error: 'Failed to load payment charges' }, { status: 500 })
  }
}
