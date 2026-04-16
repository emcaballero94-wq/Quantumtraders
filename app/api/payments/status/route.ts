import { NextResponse } from 'next/server'
import { fetchProviderChargeStatus } from '@/lib/payments/provider'
import { findPaymentChargeByProviderChargeId, syncPaymentChargeSnapshot } from '@/lib/payments/persistence'
import { rejectIfRateLimited } from '@/lib/server/endpoint-guards'

export async function GET(request: Request) {
  const blocked = rejectIfRateLimited(request, {
    routeKey: 'payments-status-get',
    limit: 120,
    windowMs: 60_000,
  })
  if (blocked) return blocked

  const { searchParams } = new URL(request.url)
  const providerChargeId = searchParams.get('providerChargeId')?.trim()
  const shouldSync = searchParams.get('sync') !== 'false'

  if (!providerChargeId) {
    return NextResponse.json({ success: false, error: 'Missing required query param: providerChargeId' }, { status: 400 })
  }

  try {
    const existing = await findPaymentChargeByProviderChargeId(providerChargeId)

    if (!shouldSync) {
      return NextResponse.json({ success: true, data: existing })
    }

    const snapshot = await fetchProviderChargeStatus(providerChargeId)
    await syncPaymentChargeSnapshot({
      providerChargeId,
      snapshot,
      eventType: 'status-sync',
    })

    return NextResponse.json({
      success: true,
      data: {
        ...existing,
        status: snapshot.status,
        timelineStatus: snapshot.timelineStatus,
        pricingAmount: snapshot.pricingAmount,
        pricingCurrency: snapshot.pricingCurrency,
        hostedUrl: snapshot.hostedUrl,
        expiresAt: snapshot.expiresAt,
        updatedAt: snapshot.updatedAt,
      },
    })
  } catch (error) {
    console.error('[/api/payments/status] Error:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch payment status' }, { status: 502 })
  }
}
