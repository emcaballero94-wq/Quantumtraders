import type { PaymentPlan } from '@/lib/payments/types'

const PAYMENT_PLANS: PaymentPlan[] = [
  {
    id: 'pro-monthly',
    name: 'Pro Monthly',
    description: 'Acceso completo a Oracle + Atlas + Nexus con señales live.',
    amount: 79,
    currency: 'USDC',
    interval: 'month',
    features: ['Señales en tiempo real', 'Correlaciones inter-mercado', 'Alertas macro de alto impacto'],
  },
  {
    id: 'pro-yearly',
    name: 'Pro Yearly',
    description: 'Plan anual con prioridad de soporte y menor costo por mes.',
    amount: 790,
    currency: 'USDC',
    interval: 'year',
    features: ['Todo lo del plan mensual', 'Soporte prioritario', '2 meses bonificados'],
  },
]

export function listPaymentPlans(): PaymentPlan[] {
  return PAYMENT_PLANS
}

export function getPaymentPlanById(planId: string): PaymentPlan | null {
  return PAYMENT_PLANS.find((plan) => plan.id === planId) ?? null
}
