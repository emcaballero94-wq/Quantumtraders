import { createHmac, timingSafeEqual } from 'crypto'
import type {
  CheckoutRequest,
  CheckoutSession,
  PaymentStatus,
  ProviderChargeSnapshot,
  ProviderWebhookEvent,
} from '@/lib/payments/types'

type CoinbaseCharge = {
  id: string
  hosted_url: string
  expires_at: string | null
  pricing?: {
    local?: { amount: string; currency: string }
  }
  timeline?: Array<{ status: string; time: string }>
}

function getCoinbaseApiBaseUrl(): string {
  return process.env.COINBASE_COMMERCE_API_URL ?? 'https://api.commerce.coinbase.com'
}

function getCoinbaseHeaders(): HeadersInit {
  const apiKey = process.env.COINBASE_COMMERCE_API_KEY
  if (!apiKey) {
    throw new Error('Coinbase Commerce API key is not configured')
  }

  return {
    'Content-Type': 'application/json',
    'X-CC-Api-Key': apiKey,
    'X-CC-Version': '2018-03-22',
  }
}

function getLatestTimelineStatus(timeline?: Array<{ status: string; time: string }>): string {
  if (!timeline || timeline.length === 0) return 'NEW'
  return timeline[timeline.length - 1]?.status ?? 'NEW'
}

function mapCoinbaseStatus(status: string): PaymentStatus {
  const normalized = status.trim().toUpperCase()

  if (normalized === 'COMPLETED' || normalized === 'CONFIRMED' || normalized === 'RESOLVED') return 'confirmed'
  if (normalized === 'EXPIRED') return 'expired'
  if (normalized === 'FAILED' || normalized === 'UNRESOLVED' || normalized === 'CANCELED') return 'failed'
  if (normalized === 'DELAYED') return 'delayed'
  return 'pending'
}

function mapChargeSnapshot(charge: CoinbaseCharge): ProviderChargeSnapshot {
  const timelineStatus = getLatestTimelineStatus(charge.timeline)
  const amountRaw = charge.pricing?.local?.amount ?? '0'
  const amount = Number.parseFloat(amountRaw)

  return {
    providerChargeId: charge.id,
    status: mapCoinbaseStatus(timelineStatus),
    timelineStatus,
    pricingAmount: Number.isFinite(amount) ? amount : 0,
    pricingCurrency: charge.pricing?.local?.currency ?? 'USD',
    hostedUrl: charge.hosted_url,
    expiresAt: charge.expires_at,
    updatedAt: new Date().toISOString(),
    raw: charge,
  }
}

export async function createCoinbaseCheckoutSession(input: CheckoutRequest): Promise<CheckoutSession> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const payload = {
    name: `Quantum Traders - ${input.plan.name}`,
    description: input.plan.description,
    pricing_type: 'fixed_price',
    local_price: {
      amount: input.plan.amount.toFixed(2),
      currency: 'USD',
    },
    metadata: {
      planId: input.plan.id,
      planInterval: input.plan.interval,
      requestedCurrency: input.plan.currency,
      customerEmail: input.customerEmail ?? '',
    },
    redirect_url: input.successUrl ?? `${appUrl}/dashboard/billing?status=success`,
    cancel_url: input.cancelUrl ?? `${appUrl}/dashboard/billing?status=cancel`,
  }

  const response = await fetch(`${getCoinbaseApiBaseUrl()}/charges`, {
    method: 'POST',
    headers: getCoinbaseHeaders(),
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const message = await response.text()
    throw new Error(`Coinbase charge creation failed: ${response.status} ${message}`)
  }

  const json = (await response.json()) as { data?: CoinbaseCharge }
  const charge = json.data
  if (!charge?.id || !charge.hosted_url) {
    throw new Error('Coinbase charge response is missing required fields')
  }

  const amount = Number.parseFloat(charge.pricing?.local?.amount ?? '0')

  return {
    provider: 'coinbase-commerce',
    providerChargeId: charge.id,
    hostedUrl: charge.hosted_url,
    expiresAt: charge.expires_at,
    pricingAmount: Number.isFinite(amount) ? amount : input.plan.amount,
    pricingCurrency: charge.pricing?.local?.currency ?? 'USD',
  }
}

export async function fetchCoinbaseChargeSnapshot(providerChargeId: string): Promise<ProviderChargeSnapshot> {
  const response = await fetch(`${getCoinbaseApiBaseUrl()}/charges/${encodeURIComponent(providerChargeId)}`, {
    method: 'GET',
    headers: getCoinbaseHeaders(),
    cache: 'no-store',
  })

  if (!response.ok) {
    const message = await response.text()
    throw new Error(`Coinbase charge fetch failed: ${response.status} ${message}`)
  }

  const json = (await response.json()) as { data?: CoinbaseCharge }
  if (!json.data?.id) throw new Error('Coinbase charge fetch returned empty data')
  return mapChargeSnapshot(json.data)
}

export function verifyCoinbaseWebhookSignature(rawBody: string, signatureHeader: string | null): boolean {
  const secret = process.env.COINBASE_COMMERCE_WEBHOOK_SECRET
  if (!secret || !signatureHeader) return false

  try {
    const computed = createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex')
    const left = Buffer.from(computed, 'hex')
    const right = Buffer.from(signatureHeader, 'hex')
    if (left.length !== right.length) return false
    return timingSafeEqual(left, right)
  } catch {
    return false
  }
}

export function parseCoinbaseWebhookEvent(payload: unknown): ProviderWebhookEvent | null {
  const root = payload as {
    event?: {
      id?: string
      type?: string
      created_at?: string
      data?: CoinbaseCharge
    }
  }

  const event = root?.event
  const charge = event?.data
  if (!event?.type || !charge?.id) return null

  const timelineStatus = getLatestTimelineStatus(charge.timeline)

  return {
    provider: 'coinbase-commerce',
    providerEventId: event.id ?? `${event.type}:${charge.id}:${event.created_at ?? 'unknown'}`,
    providerEventType: event.type,
    providerChargeId: charge.id,
    chargeStatus: mapCoinbaseStatus(timelineStatus),
    timelineStatus,
    payload,
  }
}
