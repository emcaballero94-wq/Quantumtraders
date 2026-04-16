export type CryptoPaymentProvider = 'coinbase-commerce'

export type PaymentPlan = {
  id: string
  name: string
  description: string
  amount: number
  currency: 'USDC' | 'USDT' | 'USD'
  interval: 'month' | 'year' | 'one-time'
  features: string[]
}

export type CheckoutRequest = {
  plan: PaymentPlan
  customerEmail?: string
  successUrl?: string
  cancelUrl?: string
}

export type CheckoutSession = {
  provider: CryptoPaymentProvider
  providerChargeId: string
  hostedUrl: string
  expiresAt: string | null
  pricingAmount: number
  pricingCurrency: string
}

export type PaymentStatus = 'pending' | 'confirmed' | 'failed' | 'expired' | 'delayed'

export type ProviderChargeSnapshot = {
  providerChargeId: string
  status: PaymentStatus
  timelineStatus: string
  pricingAmount: number
  pricingCurrency: string
  hostedUrl: string
  expiresAt: string | null
  updatedAt: string
  raw: unknown
}

export type ProviderWebhookEvent = {
  provider: CryptoPaymentProvider
  providerEventId: string | null
  providerEventType: string
  providerChargeId: string
  chargeStatus: PaymentStatus
  timelineStatus: string
  payload: unknown
}
