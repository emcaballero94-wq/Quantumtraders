'use client'

import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'
import { AgentInspector } from './AgentInspector'
import { QuantumCityLite } from './QuantumCityLite'
import { EventLog } from './EventLog'
import { useQuantumCityLiveState } from './use-live-state'
import { useQuantumCityEvents } from './use-events'
import type { StationDef } from './stations'

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
  const liveStations = useQuantumCityLiveState()
  const { events, freshIds } = useQuantumCityEvents()

  useEffect(() => {
    const mql = window.matchMedia(DESKTOP_QUERY)
    setIsDesktop(mql.matches)
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [])

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
      />
      {selected && (
        <AgentInspector
          station={selected}
          live={liveStations[selected.id as keyof typeof liveStations] ?? null}
          onClose={() => setSelected(null)}
        />
      )}
      <EventLog events={events} />
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
