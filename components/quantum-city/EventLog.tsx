'use client'

import { useState } from 'react'
import { clsx } from 'clsx'
import type { CityEvent } from '@/lib/quantum-city/types'

function timeShort(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

const SEVERITY_DOT: Record<CityEvent['severity'], string> = {
  low: 'bg-ink-muted',
  medium: 'bg-pulse',
  high: 'bg-bear',
  critical: 'bg-bear',
}

export function EventLog({ events, defaultOpen = true }: { events: CityEvent[]; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="absolute bottom-4 right-4 w-[300px] max-h-[48vh] rounded-xl border border-bg-border bg-bg-card/95 backdrop-blur shadow-xl glass-card overflow-hidden flex flex-col">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="px-4 py-2.5 border-b border-bg-border flex items-center justify-between shrink-0"
      >
        <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-ink-primary">Event log</span>
        <span className="text-[10px] font-mono text-ink-dim">{open ? '▾' : '▸'} {events.length}</span>
      </button>

      {open && (
        <div className="overflow-y-auto px-4 py-2.5 space-y-2">
          {events.length === 0 && <p className="text-[11px] font-mono text-ink-dim py-2">Sin eventos en las últimas 24h.</p>}
          {events.map((e) => (
            <div key={e.id} className="flex items-start gap-2 text-[10.5px] font-mono leading-snug">
              <span className={clsx('w-1.5 h-1.5 rounded-full shrink-0 mt-1', SEVERITY_DOT[e.severity])} />
              <div className="min-w-0">
                <p className="text-ink-dim">{timeShort(e.timestamp)} · {e.station.toUpperCase()}</p>
                <p className="text-ink-secondary truncate">{e.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
