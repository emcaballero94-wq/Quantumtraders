'use client'

import { useEffect, useState } from 'react'

interface UsageTotal {
  callCount: number
  inputTokens: number
  outputTokens: number
  costUsd: number
}

interface UsageByRoute extends UsageTotal {
  route: string
}

interface UsageWindow {
  total: UsageTotal
  byRoute: UsageByRoute[]
}

interface AiUsageData {
  today: UsageWindow
  last7d: UsageWindow
  last30d: UsageWindow
}

const ROUTE_LABELS: Record<string, string> = {
  'oracle-chat': 'Chat M.A.N.U.',
  'oracle-orderflow-brief': 'Order Flow · Brief',
  'oracle-orderflow-memory': 'Order Flow · Memoria',
  'oracle-orderflow-backtest': 'Order Flow · Backtest',
  'manu-analyze': 'M.A.N.U. Order Flow',
  'manu-gex-analyze': 'M.A.N.U. GEX & Options',
  'manu-options-flow-analyze': 'M.A.N.U. Options Flow',
  'market-brief': 'Market State · Brief',
  'market-pulse-brief': 'Pulse · Brief',
  'oracle-parse-trade-voice': 'Trade Audit · Voz',
}

function formatCost(usd: number): string {
  if (usd === 0) return '$0.00'
  if (usd < 0.01) return '< $0.01'
  return `$${usd.toFixed(2)}`
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return `${n}`
}

export default function AiUsageCard() {
  const [data, setData] = useState<AiUsageData | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')

  useEffect(() => {
    let cancelled = false
    fetch('/api/ai-usage')
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return
        if (json?.success) {
          setData(json.data)
          setStatus('ready')
        } else {
          setStatus('error')
        }
      })
      .catch(() => {
        if (!cancelled) setStatus('error')
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="rounded-xl border border-bg-border bg-bg-card p-6 glass-card space-y-6">
      <div className="space-y-1">
        <h3 className="text-sm font-mono font-bold text-ink-primary uppercase italic">Uso de IA (M.A.N.U.)</h3>
        <p className="text-xs font-mono text-ink-muted leading-tight max-w-[500px]">
          Tokens y costo estimado de la API de Claude, por módulo. Útil para ver qué está consumiendo crédito
          — por ejemplo si dejaste Order Flow abierto generando briefs toda la noche.
        </p>
      </div>

      {status === 'loading' && <p className="text-xs font-mono text-ink-muted">Cargando…</p>}
      {status === 'error' && (
        <p className="text-xs font-mono text-bear">No se pudo cargar el uso de IA. Intentá de nuevo más tarde.</p>
      )}

      {status === 'ready' && data && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {([
              ['Hoy', data.today.total],
              ['Últimos 7 días', data.last7d.total],
              ['Últimos 30 días', data.last30d.total],
            ] as const).map(([label, total]) => (
              <div key={label} className="rounded-lg border border-bg-border bg-bg-deep p-4 space-y-1">
                <p className="text-[10px] font-mono text-ink-muted uppercase tracking-wider">{label}</p>
                <p className="text-xl font-mono font-bold text-oracle">{formatCost(total.costUsd)}</p>
                <p className="text-2xs font-mono text-ink-muted">
                  {total.callCount} llamadas · {formatTokens(total.inputTokens + total.outputTokens)} tokens
                </p>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <p className="text-[10px] font-mono text-ink-muted uppercase tracking-wider">Por módulo (últimos 7 días)</p>
            {data.last7d.byRoute.length === 0 ? (
              <p className="text-2xs font-mono text-ink-muted">Sin llamadas registradas todavía.</p>
            ) : (
              <div className="space-y-1.5">
                {data.last7d.byRoute.map((r) => (
                  <div
                    key={r.route}
                    className="flex items-center justify-between rounded-lg border border-bg-border bg-bg-deep px-4 py-2.5"
                  >
                    <span className="text-xs font-mono text-ink-primary">{ROUTE_LABELS[r.route] ?? r.route}</span>
                    <span className="text-xs font-mono text-ink-secondary">
                      {formatCost(r.costUsd)} · {r.callCount} llamadas · {formatTokens(r.inputTokens + r.outputTokens)} tok
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <p className="text-2xs font-mono text-ink-muted leading-tight">
            Estimado a partir del precio público de Claude Haiku 4.5 ($1 / $5 por millón de tokens de entrada/salida). Para el
            consumo real y el crédito restante de tu cuenta, revisá{' '}
            <a
              href="https://platform.claude.com/settings/usage"
              target="_blank"
              rel="noreferrer"
              className="text-oracle hover:underline"
            >
              platform.claude.com/settings/usage
            </a>
            .
          </p>
        </div>
      )}
    </div>
  )
}
