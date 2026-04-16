'use client'

import { useEffect, useMemo, useState } from 'react'
import { rankAssets } from '@/lib/oracle/score-engine'
import type { OracleState } from '@/lib/oracle/types'
import { DailyBrief } from '@/components/oracle/DailyBrief'
import { TopOpportunity } from '@/components/oracle/TopOpportunity'
import { RadarTable } from '@/components/oracle/RadarTable'
import { MarketContext } from '@/components/oracle/MarketContext'
import { DepthPanel } from '@/components/oracle/DepthPanel'
import { SectionTitle } from '@/components/ui/SectionTitle'

interface OracleStateResponse {
  success: boolean
  data: OracleState | null
  error?: string
}

export default function OraclePage() {
  const [state, setState] = useState<OracleState | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    const fetchState = async () => {
      try {
        const response = await fetch('/api/oracle/state')
        const json = (await response.json()) as OracleStateResponse
        if (!response.ok || !json.success || !json.data) {
          throw new Error(json.error ?? 'No se pudo cargar el estado Oracle')
        }
        if (!mounted) return
        setState(json.data)
        setError(null)
      } catch (err: any) {
        if (!mounted) return
        setError(err?.message ?? 'No se pudo cargar el estado Oracle')
      } finally {
        if (mounted) setLoading(false)
      }
    }

    fetchState()
    const timer = setInterval(fetchState, 60_000)
    return () => {
      mounted = false
      clearInterval(timer)
    }
  }, [])

  const rankedAssets = useMemo(() => (state ? rankAssets(state.radar) : []), [state])

  if (loading) {
    return <div className="p-5 text-ink-muted font-mono text-sm">Cargando Oracle en tiempo real...</div>
  }

  if (error || !state) {
    return (
      <div className="p-5 text-bear font-mono text-sm">
        {error ?? 'No fue posible cargar Oracle.'}
      </div>
    )
  }

  return (
    <div className="space-y-5 animate-slide-up max-w-[1400px]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-mono font-bold text-ink-primary tracking-tight">ORACULO v3</h1>
          <p className="text-xs font-mono text-ink-muted mt-0.5">
            Centro de decision diaria · Actualizado {new Date(state.lastUpdated).toLocaleTimeString('es-ES', {
              hour: '2-digit', minute: '2-digit', timeZone: 'UTC',
            })} UTC
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-atlas/10 border border-atlas/30 rounded-lg">
            <span className="w-1.5 h-1.5 bg-atlas rounded-full animate-pulse-slow" />
            <span className="text-2xs font-mono text-atlas">SISTEMA ACTIVO</span>
          </div>
        </div>
      </div>

      <DailyBrief />

      <div className="grid grid-cols-1 xl:grid-cols-[380px_1fr] gap-5">
        {state.topOpportunity && (
          <div className="space-y-4">
            <TopOpportunity asset={state.topOpportunity} />
            <div className="rounded-xl border border-bg-border bg-bg-card p-4 space-y-3">
              <SectionTitle label="Quick Actions" accent="oracle" />
              <div className="space-y-2">
                {[
                  { label: 'Nuevo analisis tecnico', href: '/dashboard/atlas', color: 'text-atlas' },
                  { label: 'Ver correlaciones NEXUS', href: '/dashboard/nexus', color: 'text-nexus' },
                  { label: 'Monitor de alertas PULSE', href: '/dashboard/pulse', color: 'text-pulse' },
                ].map((action) => (
                  <a
                    key={action.label}
                    href={action.href}
                    className={`flex items-center justify-between px-3 py-2 bg-bg-elevated hover:bg-bg-border rounded-lg border border-bg-border transition-colors ${action.color}`}
                  >
                    <span className="text-xs font-mono">{action.label}</span>
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </a>
                ))}
              </div>
            </div>
          </div>
        )}

        <RadarTable assets={rankedAssets} />
      </div>

      <div>
        <SectionTitle
          label="Contexto operativo"
          sublabel="Sesiones · Alertas · Calendario"
          accent="pulse"
          className="mb-4"
        />
        <MarketContext
          sessions={state.sessions}
          killZones={state.killZones}
          alerts={state.alerts}
          calendar={state.calendar}
        />
      </div>

      <DepthPanel
        centralBanks={state.centralBanks}
        currencyStrength={state.currencyStrength}
        calendar={state.calendar}
      />
    </div>
  )
}
