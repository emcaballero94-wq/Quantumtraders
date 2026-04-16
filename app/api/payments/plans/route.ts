import { NextResponse } from 'next/server'
import { listPaymentPlans } from '@/lib/payments/plans'
import { rejectIfRateLimited } from '@/lib/server/endpoint-guards'
import { withApiCache } from '@/lib/server/api-cache'

export async function GET(request: Request) {
  const blocked = rejectIfRateLimited(request, {
    routeKey: 'payments-plans-get',
    limit: 180,
    windowMs: 60_000,
  })
  if (blocked) return blocked

  const plans = await withApiCache('payments-plans', 60_000, async () => listPaymentPlans())
  return NextResponse.json({ success: true, data: plans })
}
