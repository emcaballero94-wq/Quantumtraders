'use client'

import { useEffect, useMemo, useState } from 'react'
import { QuantumCore } from '@/components/ui/QuantumCore'
import { LiveMonitor } from '@/components/ui/LiveMonitor'
import { AgentCard } from '@/components/ui/AgentCard'
import { DailyBiasBoard } from '@/components/dashboard/DailyBiasBoard'
import { MacroVolatilityPanel } from '@/components/dashboard/MacroVolatilityPanel'
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
  const [isListening, setIsListening] = useState(false)
  const [state, setState] = useState<OracleState | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsActive(true)
    }, 1000)
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

  return (
    <div className="relative min-h-[calc(100vh-80px)] flex flex-col items-center justify-center overflow-hidden">
      <div className={clsx('absolute inset-0 pointer-events-none transition-opacity duration-1000', isActive ? 'opacity-100' : 'opacity-0')}>
        <div className="absolute top-0 left-0 w-32 h-32 border-t-2 border-l-2 border-oracle/20 rounded-tl-3xl m-4" />
        <div className="absolute top-0 right-0 w-32 h-32 border-t-2 border-r-2 border-oracle/20 rounded-tr-3xl m-4" />
        <div className="absolute bottom-0 left-0 w-32 h-32 border-b-2 border-l-2 border-oracle/20 rounded-bl-3xl m-4" />
        <div className="absolute bottom-0 right-0 w-32 h-32 border-b-2 border-r-2 border-oracle/20 rounded-br-3xl m-4" />
      </div>

      <div className="relative z-10 flex flex-col items-center">
        <div className="cursor-pointer group" onClick={() => setIsListening((value) => !value)}>
          <QuantumCore isListening={isListening} />
          <div className="absolute -bottom-20 w-full text-center">
            <p className="text-[10px] font-mono text-ink-dim uppercase tracking-[0.2em] group-hover:text-oracle transition-colors">
              {isListening ? 'Interaccion de voz habilitada' : 'Haz clic para activar comando de voz'}
            </p>
          </div>
        </div>
      </div>

      <div className={clsx('grid grid-cols-12 gap-6 w-full mt-24 transition-all duration-1000', isActive ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0')}>
        <div className="col-span-12 lg:col-span-3 space-y-6">
          <HudStatBox label="Sesiones activas" value={`${activeSessions}`} accent="oracle" />
          <HudStatBox label="Alertas criticas" value={`${criticalAlerts}`} accent={criticalAlerts > 0 ? 'bear' : 'atlas'} />
          <HudStatBox label="Top score radar" value={`${topScore}`} accent="atlas" />
        </div>

        <div className="col-span-12 lg:col-span-6">
          <div className="rounded-2xl border border-bg-border bg-bg-card/30 backdrop-blur-md p-1 glass-card">
            <div className="flex items-center gap-2 px-4 py-2 border-b border-bg-border">
              <div className="w-2 h-2 rounded-full bg-atlas animate-pulse" />
              <span className="text-[10px] font-mono text-ink-dim uppercase">Stream de monitorizacion</span>
            </div>
            <LiveMonitor />
          </div>
        </div>

        <div className="col-span-12 lg:col-span-3 space-y-4">
          {agents.map((agent) => (
            <div key={agent.id} className="scale-90 opacity-80 hover:scale-100 hover:opacity-100 transition-all">
              <AgentCard agent={agent} />
            </div>
          ))}
        </div>
      </div>

      {state && (
        <div className={clsx('grid grid-cols-12 gap-6 w-full mt-6 transition-all duration-1000', isActive ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0')}>
          <div className="col-span-12 lg:col-span-6">
            <DailyBiasBoard assets={state.radar} />
          </div>
          <div className="col-span-12 lg:col-span-6">
            <MacroVolatilityPanel calendar={state.calendar} killZones={state.killZones} />
          </div>
        </div>
      )}
    </div>
  )
}

function HudStatBox({ label, value, accent }: { label: string; value: string; accent: 'oracle' | 'bear' | 'atlas' }) {
  const colors = {
    oracle: 'text-oracle border-oracle/20 bg-oracle/5',
    bear: 'text-bear border-bear/20 bg-bear/5',
    atlas: 'text-atlas border-atlas/20 bg-atlas/5',
  }
  return (
    <div className={clsx('p-4 border-l-2 rounded-r-xl glass-card', colors[accent])}>
      <p className="text-[9px] font-mono uppercase opacity-50 mb-1">{label}</p>
      <p className="text-xl font-mono font-bold tabular-nums">{value}</p>
    </div>
  )
}
