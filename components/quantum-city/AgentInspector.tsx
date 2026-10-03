'use client'

import Link from 'next/link'
import type { StationDef } from './stations'

export function AgentInspector({ station, onClose }: { station: StationDef; onClose: () => void }) {
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
        <Row label="Status" value={station.implemented ? 'IDLE' : 'NOT IMPLEMENTED'} />
        <Row label="Data" value={station.implemented ? 'Not wired yet' : 'No backend exists'} />
        <p className="text-[11px] font-mono leading-relaxed text-ink-dim">
          {station.implemented
            ? "Quantum City Phase 1 is the visual shell only — this station isn't reading live state yet. That comes in Phase 2."
            : 'There is no Strategy/Risk/Execution/Review engine in Quantum Traders today — this station is a placeholder for the roadmap, not a working feature. See docs/quantum-city-architecture.md §2.'}
        </p>
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
    <div className="flex items-center justify-between text-[11px] font-mono">
      <span className="text-ink-secondary">{label}</span>
      <span className="text-ink-primary">{value}</span>
    </div>
  )
}
