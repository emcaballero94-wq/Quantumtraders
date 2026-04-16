import { createAdminClient } from '@/lib/supabase/admin'
import type { CheckoutSession, CryptoPaymentProvider, PaymentStatus, ProviderChargeSnapshot, ProviderWebhookEvent } from '@/lib/payments/types'

type PaymentChargeRow = {
  id: string
  provider: CryptoPaymentProvider
  provider_charge_id: string
  plan_id: string
  plan_name: string
  pricing_amount: number
  pricing_currency: string
  requested_currency: string
  status: PaymentStatus
  timeline_status: string
  hosted_url: string
  customer_email: string | null
  expires_at: string | null
  last_event_type: string | null
  metadata: Record<string, unknown> | null
  created_at: string
  updated_at: string
  confirmed_at: string | null
}

export type PaymentCharge = {
  id: string
  provider: CryptoPaymentProvider
  providerChargeId: string
  planId: string
  planName: string
  pricingAmount: number
  pricingCurrency: string
  requestedCurrency: string
  status: PaymentStatus
  timelineStatus: string
  hostedUrl: string
  customerEmail: string | null
  expiresAt: string | null
  lastEventType: string | null
  metadata: Record<string, unknown> | null
  createdAt: string
  updatedAt: string
  confirmedAt: string | null
}

function mapChargeRow(row: PaymentChargeRow): PaymentCharge {
  return {
    id: row.id,
    provider: row.provider,
    providerChargeId: row.provider_charge_id,
    planId: row.plan_id,
    planName: row.plan_name,
    pricingAmount: row.pricing_amount,
    pricingCurrency: row.pricing_currency,
    requestedCurrency: row.requested_currency,
    status: row.status,
    timelineStatus: row.timeline_status,
    hostedUrl: row.hosted_url,
    customerEmail: row.customer_email,
    expiresAt: row.expires_at,
    lastEventType: row.last_event_type,
    metadata: row.metadata,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    confirmedAt: row.confirmed_at,
  }
}

export async function createPaymentChargeRecord(input: {
  provider: CryptoPaymentProvider
  planId: string
  planName: string
  requestedCurrency: string
  customerEmail?: string
  metadata?: Record<string, unknown>
  session: CheckoutSession
}): Promise<PaymentCharge | null> {
  const admin = createAdminClient()
  if (!admin) return null

  const payload = {
    provider: input.provider,
    provider_charge_id: input.session.providerChargeId,
    plan_id: input.planId,
    plan_name: input.planName,
    pricing_amount: input.session.pricingAmount,
    pricing_currency: input.session.pricingCurrency,
    requested_currency: input.requestedCurrency,
    status: 'pending',
    timeline_status: 'NEW',
    hosted_url: input.session.hostedUrl,
    customer_email: input.customerEmail ?? null,
    expires_at: input.session.expiresAt,
    metadata: input.metadata ?? null,
  }

  const { data, error } = await admin.from('crypto_payment_charges').upsert(payload, { onConflict: 'provider_charge_id' }).select('*').single()
  if (error || !data) return null
  return mapChargeRow(data as PaymentChargeRow)
}

export async function findPaymentChargeByProviderChargeId(providerChargeId: string): Promise<PaymentCharge | null> {
  const admin = createAdminClient()
  if (!admin) return null

  const { data, error } = await admin
    .from('crypto_payment_charges')
    .select('*')
    .eq('provider_charge_id', providerChargeId)
    .maybeSingle()

  if (error || !data) return null
  return mapChargeRow(data as PaymentChargeRow)
}

export async function listPaymentCharges(limit = 50): Promise<PaymentCharge[]> {
  const admin = createAdminClient()
  if (!admin) return []

  const { data, error } = await admin
    .from('crypto_payment_charges')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error || !data) return []
  return (data as PaymentChargeRow[]).map(mapChargeRow)
}

export async function syncPaymentChargeSnapshot(input: {
  providerChargeId: string
  snapshot: ProviderChargeSnapshot
  eventType?: string | null
}): Promise<void> {
  const admin = createAdminClient()
  if (!admin) return

  const updatePayload: Record<string, unknown> = {
    status: input.snapshot.status,
    timeline_status: input.snapshot.timelineStatus,
    pricing_amount: input.snapshot.pricingAmount,
    pricing_currency: input.snapshot.pricingCurrency,
    hosted_url: input.snapshot.hostedUrl,
    expires_at: input.snapshot.expiresAt,
    updated_at: new Date().toISOString(),
    last_event_type: input.eventType ?? null,
  }
  if (input.snapshot.status === 'confirmed') updatePayload.confirmed_at = new Date().toISOString()

  await admin.from('crypto_payment_charges').update(updatePayload).eq('provider_charge_id', input.providerChargeId)
}

export async function insertPaymentWebhookEvent(event: ProviderWebhookEvent): Promise<void> {
  const admin = createAdminClient()
  if (!admin) return

  const payload = {
    provider: event.provider,
    provider_event_id: event.providerEventId,
    provider_event_type: event.providerEventType,
    provider_charge_id: event.providerChargeId,
    charge_status: event.chargeStatus,
    timeline_status: event.timelineStatus,
    payload: event.payload,
  }

  await admin.from('crypto_payment_events').upsert(payload, { onConflict: 'provider,provider_event_id' })
}
