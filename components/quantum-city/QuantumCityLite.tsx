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

function PlaceholderIcon({ cls }: { cls: string }) {
  return (
    <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} strokeDasharray="3 3">
      <circle cx="12" cy="12" r="8.25" />
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
  strategy: PlaceholderIcon,
  risk: PlaceholderIcon,
  execution: PlaceholderIcon,
  review: PlaceholderIcon,
}

// Mobile/tablet fallback (brief §29/§30): no 3D, no animation budget spent —
// just the same station list as plain cards. Implemented stations link to
// their real page and read IDLE; the Strategy/Risk/Execution/Review
// placeholders (no backend — see stations.ts) are non-interactive and say so.
export function QuantumCityLite() {
  return (
    <div className="space-y-4">
      <p className="text-[11px] font-mono uppercase tracking-[0.16em] text-ink-secondary">
        Quantum City · Lite — vista simplificada para este dispositivo
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {QUANTUM_CITY_STATIONS.map((station) => {
          const Icon = ICON[station.id]
          const content = (
            <>
              <Icon cls={`w-4 h-4 ${station.implemented ? 'text-ink-secondary' : 'text-ink-dim'}`} />
              <div>
                <p className={`text-xs font-mono font-bold ${station.implemented ? 'text-ink-primary' : 'text-ink-dim'}`}>{station.name}</p>
                <p className="text-[10px] font-mono text-ink-dim">{station.subtitle}</p>
              </div>
              <span className="text-[9px] font-mono uppercase tracking-wider text-ink-muted mt-auto">
                {station.implemented ? 'IDLE' : 'NOT IMPLEMENTED'}
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
