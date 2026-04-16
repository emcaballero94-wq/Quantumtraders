'use client'

import { useEffect, useMemo, useState } from 'react'
import type { PaymentPlan } from '@/lib/payments/types'

type PaymentCharge = {
  id: string
  provider: string
  providerChargeId: string
  planId: string
  planName: string
  pricingAmount: number
  pricingCurrency: string
  requestedCurrency: string
  status: 'pending' | 'confirmed' | 'failed' | 'expired' | 'delayed'
  timelineStatus: string
  hostedUrl: string
  createdAt: string
  updatedAt: string
}

const STATUS_STYLES: Record<PaymentCharge['status'], string> = {
  pending: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
  confirmed: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
  failed: 'text-red-400 bg-red-500/10 border-red-500/30',
  expired: 'text-zinc-400 bg-zinc-500/10 border-zinc-500/30',
  delayed: 'text-orange-400 bg-orange-500/10 border-orange-500/30',
}

export default function BillingPage() {
  const [plans, setPlans] = useState<PaymentPlan[]>([])
  const [charges, setCharges] = useState<PaymentCharge[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [processingPlan, setProcessingPlan] = useState<string | null>(null)
  const [email, setEmail] = useState('')

  useEffect(() => {
    let mounted = true

    const loadData = async () => {
      try {
        const [plansRes, chargesRes] = await Promise.all([
          fetch('/api/payments/plans'),
          fetch('/api/payments/charges?limit=20'),
        ])

        const plansJson = await plansRes.json()
        const chargesJson = await chargesRes.json()
        if (!mounted) return

        setPlans((plansJson?.data ?? []) as PaymentPlan[])
        setCharges((chargesJson?.data ?? []) as PaymentCharge[])
      } catch {
        if (!mounted) return
        setError('No pudimos cargar la configuración de pagos.')
      } finally {
        if (mounted) setLoading(false)
      }
    }

    loadData()
    return () => {
      mounted = false
    }
  }, [])

  const hasConfiguredProvider = useMemo(
    () => plans.length > 0,
    [plans],
  )

  const createCheckout = async (planId: string) => {
    setProcessingPlan(planId)
    setError(null)
    try {
      const response = await fetch('/api/payments/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId,
          customerEmail: email || undefined,
        }),
      })

      const payload = await response.json()
      if (!response.ok || !payload?.data?.checkoutUrl) {
        throw new Error(payload?.error ?? 'Failed to create checkout')
      }

      const checkoutUrl = payload.data.checkoutUrl as string
      window.open(checkoutUrl, '_blank', 'noopener,noreferrer')
      const chargesRes = await fetch('/api/payments/charges?limit=20')
      const chargesJson = await chargesRes.json()
      setCharges((chargesJson?.data ?? []) as PaymentCharge[])
    } catch (checkoutError) {
      const message = checkoutError instanceof Error ? checkoutError.message : 'Error inesperado al crear el checkout.'
      setError(message)
    } finally {
      setProcessingPlan(null)
    }
  }

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      <div className="flex items-center justify-between border-b border-bg-border pb-6">
        <div>
          <h1 className="text-xl font-mono font-bold text-ink-primary tracking-tight uppercase">CRYPTO BILLING</h1>
          <p className="text-xs font-mono text-ink-muted mt-0.5 tracking-wider uppercase">Checkout cripto + Webhook + Persistencia</p>
        </div>
        <span className="text-[10px] font-mono text-nexus uppercase tracking-widest px-3 py-1 bg-nexus/10 border border-nexus/30 rounded-lg">
          Coinbase Commerce
        </span>
      </div>

      <div className="rounded-xl border border-bg-border bg-bg-card p-5 glass-card space-y-4">
        <h2 className="text-sm font-mono font-bold text-ink-primary uppercase">Contacto de facturación (opcional)</h2>
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="billing@tuempresa.com"
          className="w-full bg-bg-deep border border-bg-border rounded-lg px-4 py-2.5 text-xs font-mono text-ink-primary focus:outline-none focus:border-nexus/50"
        />
        <p className="text-[10px] font-mono text-ink-dim">
          Usamos este email en metadata del checkout para reconciliación y soporte.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-xs font-mono text-red-300">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="space-y-4">
          <h2 className="text-xs font-mono text-ink-muted tracking-[0.2em] uppercase">Planes disponibles</h2>
          {loading && (
            <div className="rounded-xl border border-bg-border bg-bg-card p-5 text-xs font-mono text-ink-dim">
              Cargando planes de pago...
            </div>
          )}
          {!loading && !hasConfiguredProvider && (
            <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-5 text-xs font-mono text-amber-300">
              No hay planes configurados. Revisa el backend de pagos.
            </div>
          )}
          {plans.map((plan) => (
            <div key={plan.id} className="rounded-xl border border-bg-border bg-bg-card p-5 glass-card space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-mono font-bold text-ink-primary uppercase">{plan.name}</h3>
                  <p className="text-xs font-mono text-ink-muted mt-1">{plan.description}</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-mono font-bold text-nexus">
                    {plan.amount} {plan.currency}
                  </p>
                  <p className="text-[10px] font-mono text-ink-dim uppercase">{plan.interval}</p>
                </div>
              </div>
              <ul className="space-y-1">
                {plan.features.map((feature) => (
                  <li key={feature} className="text-[10px] font-mono text-ink-secondary">
                    • {feature}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => createCheckout(plan.id)}
                disabled={processingPlan === plan.id}
                className="w-full px-4 py-2.5 rounded-lg border border-nexus/40 bg-nexus/10 text-nexus text-[10px] font-mono font-bold tracking-[0.18em] uppercase hover:bg-nexus/20 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {processingPlan === plan.id ? 'GENERANDO CHECKOUT...' : 'PAGAR EN CRIPTO'}
              </button>
            </div>
          ))}
        </div>

        <div className="space-y-4">
          <h2 className="text-xs font-mono text-ink-muted tracking-[0.2em] uppercase">Transacciones recientes</h2>
          <div className="rounded-xl border border-bg-border bg-bg-card p-4 glass-card">
            {charges.length === 0 && (
              <p className="text-xs font-mono text-ink-dim">Todavía no hay transacciones registradas.</p>
            )}
            <div className="space-y-3">
              {charges.map((charge) => (
                <div key={charge.id} className="rounded-lg border border-bg-border bg-bg-elevated/30 p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] font-mono text-ink-primary">{charge.planName}</p>
                    <span className={`text-[9px] font-mono uppercase tracking-wider px-2 py-1 rounded border ${STATUS_STYLES[charge.status]}`}>
                      {charge.status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 text-[10px] font-mono text-ink-muted">
                    <span>{charge.pricingAmount} {charge.pricingCurrency}</span>
                    <span>{new Date(charge.createdAt).toLocaleString('es-ES')}</span>
                  </div>
                  <a
                    href={charge.hostedUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex text-[10px] font-mono text-nexus hover:text-nexus/80 uppercase tracking-wider"
                  >
                    Abrir checkout
                  </a>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-bg-border bg-bg-card p-4 glass-card space-y-2">
            <h3 className="text-[11px] font-mono text-ink-primary uppercase tracking-wider">Webhook endpoint</h3>
            <p className="text-[10px] font-mono text-ink-muted break-all">/api/payments/webhook/coinbase</p>
          </div>
        </div>
      </div>
    </div>
  )
}
