import { NextResponse } from 'next/server'
import { fetchCoinbaseChargeSnapshot, parseCoinbaseWebhookEvent, verifyCoinbaseWebhookSignature } from '@/lib/payments/providers/coinbase-commerce'
import { insertPaymentWebhookEvent, syncPaymentChargeSnapshot } from '@/lib/payments/persistence'
import { rejectIfRateLimited } from '@/lib/server/endpoint-guards'

export async function POST(request: Request) {
  const blocked = rejectIfRateLimited(request, {
    routeKey: 'payments-webhook-coinbase',
    limit: 600,
    windowMs: 60_000,
  })
  if (blocked) return blocked

  const rawBody = await request.text()
  const signature = request.headers.get('x-cc-webhook-signature')

  if (!verifyCoinbaseWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ success: false, error: 'Invalid webhook signature' }, { status: 401 })
  }

  try {
    const payload = JSON.parse(rawBody) as unknown
    const event = parseCoinbaseWebhookEvent(payload)
    if (!event) {
      return NextResponse.json({ success: false, error: 'Invalid webhook payload' }, { status: 400 })
    }

    await insertPaymentWebhookEvent(event)

    const snapshot = await fetchCoinbaseChargeSnapshot(event.providerChargeId)
    await syncPaymentChargeSnapshot({
      providerChargeId: event.providerChargeId,
      snapshot,
      eventType: event.providerEventType,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[/api/payments/webhook/coinbase] Error:', error)
    return NextResponse.json({ success: false, error: 'Webhook handling failed' }, { status: 500 })
  }
}
