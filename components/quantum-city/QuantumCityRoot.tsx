'use client'

import dynamic from 'next/dynamic'
import { useEffect, useMemo, useState } from 'react'
import { AgentInspector } from './AgentInspector'
import { QuantumCityLite } from './QuantumCityLite'
import { EventLog } from './EventLog'
import { useQuantumCityLiveState } from './use-live-state'
import { useQuantumCityEvents } from './use-events'
import type { StationDef } from './stations'
import { onManuSignal, type ManuSource } from '@/lib/quantum-city/manu-bus'
import type { CityEvent } from '@/lib/quantum-city/types'

/** How long a station stays lit after M.A.N.U. read its data. */
const CONSULT_GLOW_MS = 10_000
/** Safety net in case the chat never reports back. */
const THINKING_TIMEOUT_MS = 90_000

const SOURCE_NAMES: Record<ManuSource, string> = { scanner: 'Radar', atlas: 'Atlas', gex: 'GEX', orderflow: 'Flow' }

export interface ManuFloorState {
  /** The question M.A.N.U. is answering right now, or null. */
  thinking: string | null
  /** The last answer's real sources; `id` changes once per answer so the scene spawns couriers once. */
  consultation: { id: number; sources: ManuSource[] } | null
}

// The 3D scene (three.js + @react-three/fiber) is only imported when we've
// confirmed we're on a desktop-sized viewport — this keeps the whole 3D
// bundle out of every other page, and out of mobile entirely (brief §29/§30).
const QuantumCityScene = dynamic(() => import('./QuantumCityScene').then((m) => m.QuantumCityScene), {
  ssr: false,
  loading: () => <SceneLoading height="h-[540px]" />,
})

const DESKTOP_QUERY = '(min-width: 1024px)'

const HEIGHT = {
  page: 'h-[calc(100vh-7.5rem)]',
  hero: 'h-[540px] 2xl:h-[620px]',
} as const

/**
 * `page` fills /dashboard/city; `hero` is the shorter version at the top of
 * /dashboard, which also orbits slowly and starts with the event log closed.
 */
export function QuantumCityRoot({ variant = 'page' }: { variant?: keyof typeof HEIGHT }) {
  const [isDesktop, setIsDesktop] = useState<boolean | null>(null)
  const [reduceMotion, setReduceMotion] = useState(false)
  const [selected, setSelected] = useState<StationDef | null>(null)
  const liveStations = useQuantumCityLiveState()
  const { events, freshIds } = useQuantumCityEvents()
  const [manu, setManu] = useState<ManuFloorState>({ thinking: null, consultation: null })
  const [manuLog, setManuLog] = useState<CityEvent[]>([])

  // Questions asked in the M.A.N.U. chat (components/layout/QuantumAI).
  useEffect(() => {
    let thinkingTimer: ReturnType<typeof setTimeout> | undefined
    let glowTimer: ReturnType<typeof setTimeout> | undefined
    const off = onManuSignal((signal) => {
      clearTimeout(thinkingTimer)
      if (signal.phase === 'thinking') {
        setManu((prev) => ({ ...prev, thinking: signal.question }))
        thinkingTimer = setTimeout(() => setManu((prev) => ({ ...prev, thinking: null })), THINKING_TIMEOUT_MS)
        return
      }
      if (signal.phase === 'failed') {
        setManu((prev) => ({ ...prev, thinking: null }))
        return
      }
      setManu({ thinking: null, consultation: { id: Date.now(), sources: signal.sources } })
      clearTimeout(glowTimer)
      glowTimer = setTimeout(() => setManu((prev) => ({ ...prev, consultation: null })), CONSULT_GLOW_MS)
      const used = signal.sources.map((src) => SOURCE_NAMES[src]).join(', ')
      setManuLog((prev) =>
        [
          {
            id: `manu-${Date.now()}`,
            station: 'mando' as const,
            timestamp: new Date().toISOString(),
            label: used
              ? `M.A.N.U. respondió${signal.symbol ? ` sobre ${signal.symbol}` : ''} con datos de ${used}`
              : 'M.A.N.U. respondió sin datos en vivo de otros motores',
            severity: 'low' as const,
          },
          ...prev,
        ].slice(0, 10),
      )
    })
    return () => {
      off()
      clearTimeout(thinkingTimer)
      clearTimeout(glowTimer)
    }
  }, [])

  const logEvents = useMemo(
    () => [...manuLog, ...events].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
    [manuLog, events],
  )

  useEffect(() => {
    const mql = window.matchMedia(DESKTOP_QUERY)
    setIsDesktop(mql.matches)
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches)
    mql.addEventListener('change', handler)
    setReduceMotion(window.matchMedia('(prefers-reduced-motion: reduce)').matches)
    return () => mql.removeEventListener('change', handler)
  }, [])

  const height = HEIGHT[variant]
  if (isDesktop === null) return <SceneLoading height={height} />
  if (!isDesktop) return <QuantumCityLite liveStations={liveStations} />

  return (
    <div className={`relative w-full ${height} rounded-xl border border-bg-border overflow-hidden bg-bg-deep`}>
      <QuantumCityScene
        selectedId={selected?.id ?? null}
        onSelect={(station) => setSelected(station)}
        liveStations={liveStations}
        events={events}
        freshEventIds={freshIds}
        autoRotate={variant === 'hero' && !reduceMotion}
        manu={manu}
      />
      {selected && (
        <AgentInspector
          station={selected}
          live={liveStations[selected.id as keyof typeof liveStations] ?? null}
          onClose={() => setSelected(null)}
        />
      )}
      <EventLog events={logEvents} defaultOpen={variant === 'page'} />
    </div>
  )
}

function SceneLoading({ height = HEIGHT.page }: { height?: string }) {
  return (
    <div className={`w-full ${height} rounded-xl border border-bg-border flex items-center justify-center bg-bg-deep`}>
      <div className="flex flex-col items-center gap-3">
        <div className="w-7 h-7 border-2 border-ink-muted border-t-transparent rounded-full animate-spin" />
        <span className="text-[10px] font-mono text-ink-secondary uppercase tracking-[0.2em]">Cargando Quantum City…</span>
      </div>
    </div>
  )
}
