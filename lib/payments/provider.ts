import { createCoinbaseCheckoutSession, fetchCoinbaseChargeSnapshot } from '@/lib/payments/providers/coinbase-commerce'
import type { CheckoutRequest, CheckoutSession, CryptoPaymentProvider, ProviderChargeSnapshot } from '@/lib/payments/types'

export function getCryptoPaymentProvider(): CryptoPaymentProvider {
  const configured = (process.env.CRYPTO_PAYMENT_PROVIDER ?? 'coinbase-commerce').trim().toLowerCase()
  if (configured === 'coinbase-commerce') return 'coinbase-commerce'
  throw new Error(`Unsupported CRYPTO_PAYMENT_PROVIDER: ${configured}`)
}

export async function createCryptoCheckoutSession(input: CheckoutRequest): Promise<CheckoutSession> {
  const provider = getCryptoPaymentProvider()
  if (provider === 'coinbase-commerce') return createCoinbaseCheckoutSession(input)
  throw new Error(`Unsupported crypto payment provider: ${provider}`)
}

export async function fetchProviderChargeStatus(providerChargeId: string): Promise<ProviderChargeSnapshot> {
  const provider = getCryptoPaymentProvider()
  if (provider === 'coinbase-commerce') return fetchCoinbaseChargeSnapshot(providerChargeId)
  throw new Error(`Unsupported crypto payment provider: ${provider}`)
}
