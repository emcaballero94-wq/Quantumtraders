'use client'

import dynamic from 'next/dynamic'
import { useEffect, useRef, useState } from 'react'
import { clsx } from 'clsx'
import { AgentInspector } from './AgentInspector'
import { QuantumCityLite } from './QuantumCityLite'
import { EventLog } from './EventLog'
import { ReplayPanel } from './ReplayPanel'
import { useQuantumCityLiveState } from './use-live-state'
import { useQuantumCityEvents } from './use-events'
import type { StationDef } from './stations'
import type { CityEvent } from '@/lib/quantum-city/types'
import type { ReplayTrigger } from './QuantumCityScene'

// The 3D scene (three.js + @react-three/fiber) is only imported when we've
// confirmed we're on a desktop-sized viewport — this keeps the whole 3D
// bundle out of every other page, and out of mobile entirely (brief §29/§30).
const QuantumCityScene = dynamic(() => import('./QuantumCityScene').then((m) => m.QuantumCityScene), {
  ssr: false,
  loading: () => <SceneLoading />,
})

const DESKTOP_QUERY = '(min-width: 1024px)'

export function QuantumCityRoot() {
  const [isDesktop, setIsDesktop] = useState<boolean | null>(null)
  const [selected, setSelected] = useState<StationDef | null>(null)
  const [mode, setMode] = useState<'live' | 'replay'>('live')
  const [replayTrigger, setReplayTrigger] = useState<ReplayTrigger | null>(null)
  const replayNonce = useRef(0)
  const liveStations = useQuantumCityLiveState()
  const { events, freshIds } = useQuantumCityEvents()

  useEffect(() => {
    const mql = window.matchMedia(DESKTOP_QUERY)
    setIsDesktop(mql.matches)
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [])

  const handleReplayStep = (event: CityEvent) => {
    replayNonce.current += 1
    setReplayTrigger({ event, nonce: replayNonce.current })
  }

  if (isDesktop === null) return <SceneLoading />
  if (!isDesktop) return <QuantumCityLite liveStations={liveStations} />

  return (
    <div className="relative w-full h-[calc(100vh-7.5rem)] rounded-xl border border-bg-border overflow-hidden bg-bg-deep">
      <QuantumCityScene
        selectedId={selected?.id ?? null}
        onSelect={(station) => setSelected(station)}
        liveStations={liveStations}
        events={events}
        freshEventIds={freshIds}
        replayTrigger={replayTrigger}
      />
      {selected && (
        <AgentInspector
          station={selected}
          live={liveStations[selected.id as keyof typeof liveStations] ?? null}
          onClose={() => setSelected(null)}
        />
      )}

      <div className="absolute top-4 left-4 flex rounded-md border border-bg-border bg-bg-card/80 backdrop-blur overflow-hidden text-[10px] font-mono uppercase tracking-wider">
        <button
          type="button"
          onClick={() => setMode('live')}
          className={clsx('px-3 py-1.5 transition-colors', mode === 'live' ? 'bg-pulse/15 text-pulse' : 'text-ink-secondary hover:text-ink-primary')}
        >
          Live
        </button>
        <button
          type="button"
          onClick={() => setMode('replay')}
          className={clsx('px-3 py-1.5 transition-colors', mode === 'replay' ? 'bg-pulse/15 text-pulse' : 'text-ink-secondary hover:text-ink-primary')}
        >
          Replay
        </button>
      </div>

      {mode === 'live' ? <EventLog events={events} /> : <ReplayPanel onStep={handleReplayStep} />}
    </div>
  )
}

function SceneLoading() {
  return (
    <div className="w-full h-[calc(100vh-7.5rem)] rounded-xl border border-bg-border flex items-center justify-center bg-bg-deep">
      <div className="flex flex-col items-center gap-3">
        <div className="w-7 h-7 border-2 border-ink-muted border-t-transparent rounded-full animate-spin" />
        <span className="text-[10px] font-mono text-ink-secondary uppercase tracking-[0.2em]">Cargando Quantum City…</span>
      </div>
    </div>
  )
}
