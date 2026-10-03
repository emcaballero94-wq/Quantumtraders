'use client'

import { useEffect, useRef, useState } from 'react'
import { clsx } from 'clsx'
import type { CityEvent, QuantumCityReplayResponse } from '@/lib/quantum-city/types'

const STEP_MS = 900

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

function timeShort(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

const SEVERITY_DOT: Record<CityEvent['severity'], string> = {
  low: 'bg-ink-muted',
  medium: 'bg-pulse',
  high: 'bg-bear',
  critical: 'bg-bear',
}

interface ReplayPanelProps {
  onStep: (event: CityEvent) => void
}

// Phase 5 — historical replay, scoped to Journal (trades) and Review (outcome
// grading), per docs/quantum-city-architecture.md's §34 replay requirement:
// "esto NO debe inventarse — debe reproducir eventos históricos existentes."
// Every event here comes from app/api/quantum-city/replay, which queries the
// real persisted rows for the picked day — nothing is reconstructed or
// guessed for days that have no data.
export function ReplayPanel({ onStep }: ReplayPanelProps) {
  const [date, setDate] = useState(todayIso())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [events, setEvents] = useState<CityEvent[]>([])
  const [counts, setCounts] = useState({ trades: 0, outcomes: 0 })
  const [cursor, setCursor] = useState(-1)
  const [playing, setPlaying] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    setPlaying(false)
    setCursor(-1)
    try {
      const res = await fetch(`/api/quantum-city/replay?date=${date}`)
      const payload = (await res.json()) as QuantumCityReplayResponse
      if (!payload.success) {
        setError(payload.error)
        setEvents([])
        return
      }
      setEvents(payload.data.events)
      setCounts({ trades: payload.data.tradesCount, outcomes: payload.data.outcomesCount })
    } catch {
      setError('No se pudo cargar ese día')
      setEvents([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!playing) {
      if (timerRef.current) clearInterval(timerRef.current)
      return
    }
    timerRef.current = setInterval(() => {
      setCursor((prev) => {
        const next = prev + 1
        if (next >= events.length) {
          setPlaying(false)
          return prev
        }
        onStep(events[next])
        return next
      })
    }, STEP_MS)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, events])

  const handlePlay = () => {
    if (events.length === 0) return
    if (cursor >= events.length - 1) {
      setCursor(-1)
    }
    setPlaying(true)
  }

  return (
    <div className="absolute bottom-4 right-4 w-[300px] max-h-[52vh] rounded-xl border border-bg-border bg-bg-card/95 backdrop-blur shadow-xl glass-card overflow-hidden flex flex-col">
      <div className="px-4 py-2.5 border-b border-bg-border space-y-2 shrink-0">
        <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-ink-primary">Replay · Journal &amp; Review</span>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={date}
            max={todayIso()}
            onChange={(e) => setDate(e.target.value)}
            className="flex-1 bg-bg-deep border border-bg-border rounded-md px-2 py-1 text-[11px] font-mono text-ink-primary focus:outline-none focus:border-ink-muted"
          />
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="px-2.5 py-1 rounded-md border border-bg-border text-[10px] font-mono uppercase tracking-wider text-ink-secondary hover:text-ink-primary hover:border-ink-muted transition-colors disabled:opacity-50"
          >
            {loading ? '…' : 'Cargar'}
          </button>
        </div>
        {events.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={playing ? () => setPlaying(false) : handlePlay}
              className="px-2.5 py-1 rounded-md border border-pulse/40 bg-pulse/10 text-[10px] font-mono uppercase tracking-wider text-pulse hover:bg-pulse/20 transition-colors"
            >
              {playing ? '⏸ Pausa' : '▶ Reproducir'}
            </button>
            <button
              type="button"
              onClick={() => {
                setPlaying(false)
                setCursor(-1)
              }}
              className="px-2.5 py-1 rounded-md border border-bg-border text-[10px] font-mono uppercase tracking-wider text-ink-dim hover:text-ink-secondary transition-colors"
            >
              Reset
            </button>
            <span className="text-[10px] font-mono text-ink-dim ml-auto">
              {Math.max(cursor + 1, 0)}/{events.length}
            </span>
          </div>
        )}
      </div>

      <div className="overflow-y-auto px-4 py-2.5 space-y-2">
        {error && <p className="text-[11px] font-mono text-bear py-2">{error}</p>}
        {!error && events.length === 0 && !loading && (
          <p className="text-[11px] font-mono text-ink-dim py-2">Elegí una fecha y tocá Cargar.</p>
        )}
        {events.length > 0 && (
          <p className="text-[10px] font-mono text-ink-dim">
            {counts.trades} trade(s) · {counts.outcomes} outcome(s) evaluado(s)
          </p>
        )}
        {events.map((e, i) => (
          <div
            key={e.id}
            className={clsx(
              'flex items-start gap-2 text-[10.5px] font-mono leading-snug rounded px-1 -mx-1',
              i === cursor && 'bg-pulse/10',
            )}
          >
            <span className={clsx('w-1.5 h-1.5 rounded-full shrink-0 mt-1', SEVERITY_DOT[e.severity])} />
            <div className="min-w-0">
              <p className="text-ink-dim">{timeShort(e.timestamp)} · {e.station.toUpperCase()}</p>
              <p className="text-ink-secondary truncate">{e.label}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
