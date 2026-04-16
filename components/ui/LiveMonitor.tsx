'use client'

import { useEffect, useMemo, useState } from 'react'
import { useTVQuote } from '@/hooks/useTVQuote'

interface MonitorEvent {
  time: string
  type: 'SYSTEM' | 'ATLAS' | 'NEXUS' | 'PULSE'
  message: string
}

const SYMBOLS = ['XAUUSD', 'EURUSD', 'GBPUSD', 'USDJPY', 'BTCUSD']

function nowLabel(): string {
  return new Date().toLocaleTimeString('es-ES', { hour12: false })
}

export function LiveMonitor() {
  const [events, setEvents] = useState<MonitorEvent[]>([])
  const { quotes } = useTVQuote(SYMBOLS, 3000)

  const topMover = useMemo(() => {
    const values = Object.values(quotes).filter((quote) => quote.changePct !== null)
    if (values.length === 0) return null
    return values.sort((a, b) => Math.abs(b.changePct ?? 0) - Math.abs(a.changePct ?? 0))[0] ?? null
  }, [quotes])

  useEffect(() => {
    if (!topMover) return
    const changePct = topMover.changePct ?? 0
    const type: MonitorEvent['type'] = Math.abs(changePct) > 0.8 ? 'PULSE' : Math.abs(changePct) > 0.4 ? 'ATLAS' : 'NEXUS'
    const message = `${topMover.symbol} ${changePct >= 0 ? 'sube' : 'cae'} ${Math.abs(changePct).toFixed(2)}% | precio ${topMover.price?.toFixed(topMover.symbol.includes('JPY') ? 3 : topMover.symbol === 'XAUUSD' ? 2 : 5)}`
    const nextEvent: MonitorEvent = { time: nowLabel(), type, message }
    setEvents((previous) => [nextEvent, ...previous].slice(0, 8))
  }, [topMover?.timestamp])

  useEffect(() => {
    const timer = setInterval(() => {
      const heartbeat: MonitorEvent = { time: nowLabel(), type: 'SYSTEM', message: 'Heartbeat de mercado activo' }
      setEvents((previous) => [heartbeat, ...previous].slice(0, 8))
    }, 20_000)

    return () => clearInterval(timer)
  }, [])

  return (
    <div className="rounded-xl border border-bg-border bg-bg-deep overflow-hidden flex flex-col h-[200px]">
      <div className="px-4 py-2 border-b border-bg-border bg-bg-card flex items-center justify-between">
        <h3 className="text-[10px] font-mono font-bold text-ink-secondary tracking-widest uppercase">Sistema en Vivo</h3>
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 bg-atlas rounded-full animate-pulse" />
          <span className="text-[9px] font-mono text-atlas">FEED ACTIVO</span>
        </div>
      </div>
      <div className="flex-1 p-3 font-mono text-[10px] space-y-1.5 overflow-hidden">
        {events.length === 0 && (
          <div className="text-ink-dim">Esperando ticks de mercado...</div>
        )}
        {events.map((event, index) => (
          <div key={`${event.time}-${index}`} className="flex gap-3 animate-fade-in">
            <span className="text-ink-dim shrink-0">[{event.time}]</span>
            <span className={event.type === 'SYSTEM' ? 'text-ink-muted' : 'text-oracle'}>{event.type}</span>
            <span className="text-ink-secondary truncate">{event.message}</span>
          </div>
        ))}
        <div className="text-oracle animate-pulse-slow">_</div>
      </div>
    </div>
  )
}
