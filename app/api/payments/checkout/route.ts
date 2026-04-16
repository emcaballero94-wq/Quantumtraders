import { NextResponse } from 'next/server'
import { getPaymentPlanById } from '@/lib/payments/plans'
import { createCryptoCheckoutSession } from '@/lib/payments/provider'
import { createPaymentChargeRecord } from '@/lib/payments/persistence'
import { rejectIfRateLimited } from '@/lib/server/endpoint-guards'

type CheckoutBody = {
  planId?: string
  customerEmail?: string
}

function normalizeEmail(input?: string): string | undefined {
  if (!input) return undefined
  const value = input.trim().toLowerCase()
  if (!value.includes('@') || value.length > 256) return undefined
  return value
}

export async function POST(request: Request) {
  const blocked = rejectIfRateLimited(request, {
    routeKey: 'payments-checkout-post',
    limit: 30,
    windowMs: 60_000,
  })
  if (blocked) return blocked

  try {
    const body = (await request.json()) as CheckoutBody
    const planId = body.planId?.trim()
    if (!planId) {
      return NextResponse.json({ success: false, error: 'Missing required field: planId' }, { status: 400 })
    }

    const plan = getPaymentPlanById(planId)
    if (!plan) {
      return NextResponse.json({ success: false, error: `Unknown payment plan: ${planId}` }, { status: 404 })
    }

    const session = await createCryptoCheckoutSession({
      plan,
      customerEmail: normalizeEmail(body.customerEmail),
    })

    const record = await createPaymentChargeRecord({
      provider: session.provider,
      planId: plan.id,
      planName: plan.name,
      requestedCurrency: plan.currency,
      customerEmail: normalizeEmail(body.customerEmail),
      metadata: {
        interval: plan.interval,
      },
      session,
    })

    return NextResponse.json({
      success: true,
      data: {
        checkoutUrl: session.hostedUrl,
        provider: session.provider,
        providerChargeId: session.providerChargeId,
        expiresAt: session.expiresAt,
        amount: session.pricingAmount,
        currency: session.pricingCurrency,
        recordId: record?.id ?? null,
      },
    })
  } catch (error) {
    console.error('[/api/payments/checkout] Error:', error)
    return NextResponse.json({ success: false, error: 'Failed to create crypto checkout session' }, { status: 502 })
  }
}
