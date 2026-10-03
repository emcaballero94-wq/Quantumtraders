'use client'

import Link from 'next/link'
import type { StationDef } from './stations'
import type { StationLive } from '@/lib/quantum-city/types'

function timeAgo(iso: string | null): string {
  if (!iso) return 'sin dato'
  const ms = Date.now() - new Date(iso).getTime()
  const mins = Math.round(ms / 60_000)
  if (mins < 1) return 'justo ahora'
  if (mins < 60) return `hace ${mins}min`
  return `hace ${Math.round(mins / 60)}h`
}

export function AgentInspector({
  station,
  live,
  onClose,
}: {
  station: StationDef
  live: StationLive | null
  onClose: () => void
}) {
  return (
    <div className="absolute top-4 right-4 w-[280px] rounded-xl border border-bg-border bg-bg-card/95 backdrop-blur shadow-xl glass-card overflow-hidden">
      <div className="px-4 py-3 border-b border-bg-border flex items-center justify-between">
        <div>
          <p className="text-xs font-mono font-bold tracking-wider text-ink-primary">{station.name}</p>
          <p className="text-[10px] font-mono text-ink-dim">{station.subtitle}</p>
        </div>
        <button onClick={onClose} className="text-ink-muted hover:text-ink-primary transition-colors text-sm leading-none">
          ×
        </button>
      </div>

      <div className="px-4 py-3 space-y-2.5">
        <Row label="Status" value={!station.implemented ? 'NOT IMPLEMENTED' : live ? live.state.toUpperCase() : 'IDLE'} />
        {live ? (
          <>
            <Row label="Detail" value={live.detail} />
            <Row label="Last updated" value={timeAgo(live.lastUpdated)} />
            <p className="text-[10px] font-mono leading-relaxed text-ink-dim">
              Leído en vivo desde la última corrida real de este motor — Quantum City nunca dispara una corrida nueva ni gasta tokens de IA.
            </p>
          </>
        ) : (
          <>
            <Row label="Data" value={station.implemented ? 'Not wired yet' : 'No backend exists'} />
            <p className="text-[11px] font-mono leading-relaxed text-ink-dim">
              {station.implemented
                ? 'Esta estación todavía no lee estado en vivo — llega en una próxima iteración de Phase 2.'
                : 'There is no Strategy/Risk/Execution/Review engine in Quantum Traders today — this station is a placeholder for the roadmap, not a working feature. See docs/quantum-city-architecture.md §2.'}
            </p>
          </>
        )}
        {station.href && (
          <Link
            href={station.href}
            className="inline-flex items-center gap-1.5 text-[11px] font-mono text-pulse hover:text-pulse/80 transition-colors pt-1"
          >
            Open real page →
          </Link>
        )}
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-[11px] font-mono">
      <span className="text-ink-secondary shrink-0">{label}</span>
      <span className="text-ink-primary text-right truncate">{value}</span>
    </div>
  )
}
