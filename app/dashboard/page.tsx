'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { ScoreOrb } from '@/components/ui/ScoreOrb'
import { LiveMonitor } from '@/components/ui/LiveMonitor'
import { AgentCard } from '@/components/ui/AgentCard'
import { DailyBiasBoard } from '@/components/dashboard/DailyBiasBoard'
import { MacroVolatilityPanel } from '@/components/dashboard/MacroVolatilityPanel'
import { useLerp } from '@/hooks/useLerp'
import type { OracleState } from '@/lib/oracle/types'
import { clsx } from 'clsx'

interface OracleStateResponse {
  success: boolean
  data: OracleState | null
}

interface RuntimeAgent {
  id: string
  name: string
  specialty: string
  status: string
  score: number
  mind: string
}

function buildAgents(state: OracleState | null): RuntimeAgent[] {
  if (!state) {
    return [
      { id: 'atlas', name: 'ATLAS', specialty: 'Analisis tecnico', status: 'Sin feed', score: 0, mind: 'En espera' },
      { id: 'nexus', name: 'NEXUS', specialty: 'Correlaciones', status: 'Sin feed', score: 0, mind: 'En espera' },
      { id: 'pulse', name: 'PULSE', specialty: 'Sentimiento', status: 'Sin feed', score: 0, mind: 'En espera' },
    ]
  }

  const technicalAverage = state.radar.length > 0
    ? Math.round(state.radar.reduce((sum, asset) => sum + asset.technicalScore, 0) / state.radar.length)
    : 0
  const macroAverage = state.radar.length > 0
    ? Math.round(state.radar.reduce((sum, asset) => sum + asset.macroScore, 0) / state.radar.length)
    : 0
  const pulseScore = Math.min(100, Math.max(0, 100 - state.alerts.filter((alert) => alert.severity === 'critical').length * 10))

  return [
    { id: 'atlas', name: 'ATLAS', specialty: 'Analisis tecnico', status: 'Activo', score: technicalAverage, mind: 'Escaneando' },
    { id: 'nexus', name: 'NEXUS', specialty: 'Correlaciones', status: 'Activo', score: macroAverage, mind: 'Alineando' },
    { id: 'pulse', name: 'PULSE', specialty: 'Regimen', status: 'Activo', score: pulseScore, mind: 'Monitoreando' },
  ]
}

export default function DashboardPage() {
  const [isActive, setIsActive] = useState(false)
  const [state, setState] = useState<OracleState | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => setIsActive(true), 150)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    let mounted = true
    const fetchState = async () => {
      try {
        const response = await fetch('/api/oracle/state')
        const payload = (await response.json()) as OracleStateResponse
        if (!mounted || !payload.success || !payload.data) return
        setState(payload.data)
      } catch {
        if (!mounted) return
      }
    }

    fetchState()
    const timer = setInterval(fetchState, 60_000)
    return () => {
      mounted = false
      clearInterval(timer)
    }
  }, [])

  const agents = useMemo(() => buildAgents(state), [state])
  const activeSessions = state?.sessions.filter((session) => session.isActive).length ?? 0
  const criticalAlerts = state?.alerts.filter((alert) => alert.severity === 'critical').length ?? 0
  const topScore = state?.topOpportunity?.totalScore ?? 0
  const topSymbol = state?.topOpportunity?.symbol

  const lerpedSessions = useLerp(activeSessions)
  const lerpedAlerts = useLerp(criticalAlerts)
  const lerpedScore = useLerp(topScore)

  return (
    <div className="space-y-5">

      {/* ── Focus row: score + live stats + regime, all above the fold ── */}
      <div
        className={clsx(
          'grid grid-cols-1 lg:grid-cols-[auto_1fr] gap-5 transition-all duration-700',
          isActive ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0',
        )}
      >
        <div className="rounded-2xl border border-bg-border bg-bg-card glass-card p-5 flex items-center gap-5">
          <ScoreOrb score={Math.round(lerpedScore)} label="Top Opportunity" />
          <div className="hidden md:block">
            <p className="text-[10px] font-mono text-ink-dim uppercase tracking-[0.2em]">Highest-scoring setup right now</p>
            <p className="text-lg font-mono font-bold text-ink-primary mt-1">{topSymbol ?? '—'}</p>
            <Link href="/dashboard/scanner" className="group inline-flex items-center gap-1 mt-3">
              <p className="text-[10px] font-mono text-oracle uppercase tracking-[0.15em] group-hover:underline">
                Open in Scanner →
              </p>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <HudStatBox label="Active sessions" value={Math.round(lerpedSessions)} accent="oracle" />
          <HudStatBox label="Critical alerts" value={Math.round(lerpedAlerts)} accent={criticalAlerts > 0 ? 'bear' : 'atlas'} />
          <HudStatBox label="Top radar score" value={Math.round(lerpedScore)} accent="atlas" />

          <div className="col-span-3 rounded-xl border border-bg-border bg-bg-card glass-card overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2 border-b border-bg-border">
              <div className="w-1.5 h-1.5 rounded-full bg-atlas animate-pulse" />
              <span className="text-[10px] font-mono text-ink-dim uppercase tracking-wider">Live monitoring stream</span>
            </div>
            <LiveMonitor />
          </div>
        </div>
      </div>

      {/* ── Agent status row ── */}
      <div
        className={clsx(
          'grid grid-cols-1 sm:grid-cols-3 gap-3 transition-all duration-700 delay-100',
          isActive ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0',
        )}
      >
        {agents.map((agent) => (
          <AgentCard key={agent.id} agent={agent} />
        ))}
      </div>

      {/* ── Market intelligence row ── */}
      {state && (
        <div
          className={clsx(
            'grid grid-cols-1 lg:grid-cols-12 gap-5 transition-all duration-700 delay-150',
            isActive ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0',
          )}
        >
          <div className="lg:col-span-7">
            <DailyBiasBoard assets={state.radar} />
          </div>
          <div className="lg:col-span-5">
            <MacroVolatilityPanel calendar={state.calendar} killZones={state.killZones} />
          </div>
        </div>
      )}
    </div>
  )
}

function HudStatBox({ label, value, accent }: { label: string; value: number; accent: 'oracle' | 'bear' | 'atlas' }) {
  const colors = {
    oracle: 'text-oracle border-oracle/20 bg-oracle/5',
    bear: 'text-bear border-bear/20 bg-bear/5',
    atlas: 'text-atlas border-atlas/20 bg-atlas/5',
  }
  return (
    <div className={clsx('p-3.5 border-l-2 rounded-r-xl glass-card', colors[accent])}>
      <p className="text-[9px] font-mono uppercase opacity-50 mb-1 truncate">{label}</p>
      <p className="text-xl font-mono font-bold tabular-nums">{value}</p>
    </div>
  )
}
