'use client'

import { useEffect, useMemo, useState } from 'react'
import { CorrelationMatrix } from '@/components/nexus/CorrelationMatrix'
import { SectionTitle } from '@/components/ui/SectionTitle'
import { clsx } from 'clsx'
import type { CurrencyStrength } from '@/lib/oracle/types'

interface CorrelationResponse {
  symbols: string[]
  matrix: number[][]
  sampleSize: number
  strongestPositive: { a: string; b: string; value: number } | null
  strongestNegative: { a: string; b: string; value: number } | null
}

interface OracleStateResponse {
  success: boolean
  data?: {
    currencyStrength: CurrencyStrength[]
  }
}

export default function NexusPage() {
  const [correlations, setCorrelations] = useState<CorrelationResponse | null>(null)
  const [currencyStrength, setCurrencyStrength] = useState<CurrencyStrength[]>([])

  useEffect(() => {
    let mounted = true
    const load = async () => {
      try {
        const [correlationResponse, stateResponse] = await Promise.all([
          fetch('/api/market/correlations').then((response) => response.json()),
          fetch('/api/oracle/state').then((response) => response.json() as Promise<OracleStateResponse>),
        ])

        if (!mounted) return
        setCorrelations(correlationResponse)
        setCurrencyStrength(stateResponse?.data?.currencyStrength ?? [])
      } catch {
        if (!mounted) return
        setCorrelations(null)
        setCurrencyStrength([])
      }
    }

    load()
    const timer = setInterval(load, 60_000)
    return () => {
      mounted = false
      clearInterval(timer)
    }
  }, [])

  const topStrength = useMemo(() => [...currencyStrength].slice(0, 4), [currencyStrength])
  const topFlow = topStrength.slice(0, 2)
  const weakestFlow = [...currencyStrength].slice(-2).reverse()
  const strongestPositive = correlations?.strongestPositive
  const strongestNegative = correlations?.strongestNegative

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between border-b border-bg-border pb-6">
        <div>
          <h1 className="text-xl font-mono font-bold text-ink-primary tracking-tight uppercase">NEXUS · Correlation & Flow</h1>
          <p className="text-xs font-mono text-ink-muted mt-0.5 tracking-wider uppercase">Intermarket Analysis en tiempo real</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-8 space-y-6">
          <CorrelationMatrix />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="rounded-xl border border-bg-border bg-bg-card p-5 space-y-4">
              <SectionTitle label="Divergencias en vivo" accent="nexus" />
              <div className="space-y-3">
                <DivergenceItem
                  pair={strongestNegative ? `${strongestNegative.a} / ${strongestNegative.b}` : 'Sin datos'}
                  status={strongestNegative ? `Correlacion ${strongestNegative.value.toFixed(2)}` : 'Esperando datos'}
                  type="bearish"
                />
                <DivergenceItem
                  pair={strongestPositive ? `${strongestPositive.a} / ${strongestPositive.b}` : 'Sin datos'}
                  status={strongestPositive ? `Correlacion ${strongestPositive.value.toFixed(2)}` : 'Esperando datos'}
                  type="bullish"
                />
              </div>
            </div>

            <div className="rounded-xl border border-bg-border bg-bg-card p-5 space-y-4">
              <SectionTitle label="Flujos de liquidez" accent="oracle" />
              <div className="space-y-3 font-mono text-xs">
                {topFlow.map((item) => (
                  <FlowItem key={`top-${item.currency}`} code={item.currency} value={item.change4h} positive />
                ))}
                {weakestFlow.map((item) => (
                  <FlowItem key={`weak-${item.currency}`} code={item.currency} value={item.change4h} positive={false} />
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="xl:col-span-4 space-y-6">
          <div className="rounded-xl border border-bg-border bg-bg-card p-6 space-y-6">
            <SectionTitle label="Momentum por divisa" accent="nexus" />
            <div className="space-y-6">
              {topStrength.map((item) => {
                const buy = Math.max(0, Math.min(100, 50 + item.score / 2))
                const sell = 100 - buy
                return (
                  <SentimentBar
                    key={item.currency}
                    asset={item.currency}
                    long={Number(buy.toFixed(0))}
                    short={Number(sell.toFixed(0))}
                  />
                )
              })}
            </div>
          </div>

          <div className="rounded-xl border border-bg-high-contrast bg-bg-card p-5 border-l-4 border-l-nexus">
            <p className="text-2xs font-mono text-nexus uppercase font-bold mb-2">Insight Maestro</p>
            <p className="text-xs font-mono text-ink-primary leading-relaxed">
              {strongestNegative
                ? `La correlacion mas negativa ahora es ${strongestNegative.a}/${strongestNegative.b} (${strongestNegative.value.toFixed(2)}), util para coberturas y confirmaciones inversas.`
                : 'Esperando suficiente historial para generar insight de correlacion.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function DivergenceItem({ pair, status, type }: { pair: string; status: string; type: 'bullish' | 'bearish' | 'neutral' }) {
  const colors = {
    bullish: 'text-atlas',
    bearish: 'text-bear',
    neutral: 'text-ink-secondary',
  }
  return (
    <div className="flex items-center justify-between py-2 border-b border-bg-border last:border-0">
      <div className="space-y-0.5">
        <p className="text-[10px] font-mono text-ink-muted uppercase">{pair}</p>
        <p className={`text-xs font-mono font-bold ${colors[type]}`}>{status}</p>
      </div>
      <div className={clsx('w-2 h-2 rounded-full', type === 'bullish' ? 'bg-atlas' : type === 'bearish' ? 'bg-bear' : 'bg-ink-dim')} />
    </div>
  )
}

function SentimentBar({ asset, long, short }: { asset: string; long: number; short: number }) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center text-[10px] font-mono uppercase">
        <span className="text-ink-primary font-bold">{asset}</span>
        <div className="space-x-4">
          <span className="text-atlas">{long}% BUY</span>
          <span className="text-bear">{short}% SELL</span>
        </div>
      </div>
      <div className="h-1.5 w-full flex rounded-full overflow-hidden">
        <div className="bg-atlas" style={{ width: `${long}%` }} />
        <div className="bg-bear" style={{ width: `${short}%` }} />
      </div>
    </div>
  )
}

function FlowItem({ code, value, positive }: { code: string; value: number; positive: boolean }) {
  return (
    <div className="flex justify-between items-center bg-bg-deep p-2 border border-bg-border rounded">
      <span className="text-ink-dim uppercase">{code}</span>
      <span className={positive ? 'text-atlas font-bold' : 'text-bear font-bold'}>
        {value >= 0 ? '+' : ''}
        {value.toFixed(2)}%
      </span>
    </div>
  )
}
