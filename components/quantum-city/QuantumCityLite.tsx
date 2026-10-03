'use client'

import Link from 'next/link'
import {
  MandoIcon,
  ScannerIcon,
  AtlasIcon,
  NexusIcon,
  OrderFlowIcon,
  OptionsIcon,
  GexIcon,
  PulseIcon,
  MindIcon,
  ToolsIcon,
} from '@/components/layout/Sidebar'
import { QUANTUM_CITY_STATIONS, type StationId } from './stations'
import type { StationLive, WiredStationId } from '@/lib/quantum-city/types'

function PlaceholderIcon({ cls }: { cls: string }) {
  return (
    <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} strokeDasharray="3 3">
      <circle cx="12" cy="12" r="8.25" />
    </svg>
  )
}

function ReviewIcon({ cls }: { cls: string }) {
  return (
    <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l1.5 1.5M21 3l-1.5 1.5" opacity="0.5" />
    </svg>
  )
}

const ICON: Record<StationId, (p: { cls: string }) => React.ReactElement> = {
  mando: MandoIcon,
  scanner: ScannerIcon,
  atlas: AtlasIcon,
  nexus: NexusIcon,
  pulse: PulseIcon,
  orderflow: OrderFlowIcon,
  gex: GexIcon,
  options: OptionsIcon,
  tools: ToolsIcon,
  mind: MindIcon,
  review: ReviewIcon,
  strategy: PlaceholderIcon,
  risk: PlaceholderIcon,
  execution: PlaceholderIcon,
}

// Mobile/tablet fallback (brief §29/§30): no 3D, no animation budget spent —
// just the same station list as plain cards. Implemented stations link to
// their real page and read IDLE; the Strategy/Risk/Execution
// placeholders (no backend — see stations.ts) are non-interactive and say so.
export function QuantumCityLite({ liveStations }: { liveStations: Partial<Record<WiredStationId, StationLive>> }) {
  return (
    <div className="space-y-4">
      <p className="text-[11px] font-mono uppercase tracking-[0.16em] text-ink-secondary">
        Quantum City · Lite — vista simplificada para este dispositivo
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {QUANTUM_CITY_STATIONS.map((station) => {
          const Icon = ICON[station.id]
          const live = liveStations[station.id as WiredStationId] ?? null
          const content = (
            <>
              <Icon cls={`w-4 h-4 ${station.implemented ? 'text-ink-secondary' : 'text-ink-dim'}`} />
              <div>
                <p className={`text-xs font-mono font-bold ${station.implemented ? 'text-ink-primary' : 'text-ink-dim'}`}>{station.name}</p>
                <p className="text-[10px] font-mono text-ink-dim">{live ? live.detail : station.subtitle}</p>
              </div>
              <span
                className={`text-[9px] font-mono uppercase tracking-wider mt-auto ${live?.state === 'alert' ? 'text-bear' : 'text-ink-muted'}`}
              >
                {!station.implemented ? 'NOT IMPLEMENTED' : live ? live.state.toUpperCase() : 'IDLE'}
              </span>
            </>
          )
          if (!station.href) {
            return (
              <div key={station.id} className="rounded-xl border border-dashed border-bg-border px-4 py-3.5 flex flex-col gap-2 opacity-60">
                {content}
              </div>
            )
          }
          return (
            <Link
              key={station.id}
              href={station.href}
              className="rounded-xl border border-bg-border bg-bg-card px-4 py-3.5 flex flex-col gap-2 hover:border-ink-muted transition-colors"
            >
              {content}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
