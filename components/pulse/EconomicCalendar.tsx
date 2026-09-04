'use client'

import { useMemo, useState } from 'react'
import { clsx } from 'clsx'
import type { EconomicEvent, EventImpact } from '@/lib/oracle/types'

export interface DayPnl {
  date: string // YYYY-MM-DD
  pnl: number
  trades: number
}

interface EconomicCalendarProps {
  events: EconomicEvent[]
  dailyPnl?: DayPnl[]
}

const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

const IMPACT_BG: Record<EventImpact, string> = {
  high: 'bg-bear',
  medium: 'bg-pulse',
  low: 'bg-oracle',
}
const IMPACT_BORDER: Record<EventImpact, string> = {
  high: 'border-bear/40',
  medium: 'border-pulse/40',
  low: 'border-oracle/40',
}

export function EconomicCalendar({ events, dailyPnl = [] }: EconomicCalendarProps) {
  const [tab, setTab] = useState<'events' | 'pnl'>('events')
  const [cursor, setCursor] = useState(() => new Date())

  const year = cursor.getFullYear()
  const month = cursor.getMonth()
  const startWeekday = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const eventsByDay = useMemo(() => {
    const map = new Map<number, EconomicEvent[]>()
    for (const ev of events) {
      const d = new Date(ev.datetime)
      if (d.getFullYear() === year && d.getMonth() === month) {
        map.set(d.getDate(), [...(map.get(d.getDate()) ?? []), ev])
      }
    }
    return map
  }, [events, year, month])

  const pnlByDay = useMemo(() => {
    const map = new Map<number, DayPnl>()
    for (const p of dailyPnl) {
      const d = new Date(p.date)
      if (d.getFullYear() === year && d.getMonth() === month) map.set(d.getDate(), p)
    }
    return map
  }, [dailyPnl, year, month])

  const cells: (number | null)[] = [
    ...Array.from({ length: startWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]

  const monthLabel = cursor.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
  const eventsThisMonth = [...eventsByDay.values()].flat().sort((a, b) => a.datetime.localeCompare(b.datetime))

  return (
    <div className="rounded-xl border border-bg-border bg-bg-card glass-card p-5 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h3 className="text-sm font-mono font-bold text-ink-primary">Economic Calendar</h3>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setTab('pnl')}
            className={clsx('px-3 py-1 rounded-md text-[10px] font-mono font-bold uppercase transition-colors',
              tab === 'pnl' ? 'bg-atlas/15 text-atlas border border-atlas/30' : 'bg-bg-elevated/40 text-ink-muted border border-bg-border')}
          >
            PNL
          </button>
          <button
            type="button"
            onClick={() => setTab('events')}
            className={clsx('px-3 py-1 rounded-md text-[10px] font-mono font-bold uppercase transition-colors',
              tab === 'events' ? 'bg-atlas/15 text-atlas border border-atlas/30' : 'bg-bg-elevated/40 text-ink-muted border border-bg-border')}
          >
            Events
          </button>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <button
            type="button"
            aria-label="Previous month"
            onClick={() => setCursor(new Date(year, month - 1, 1))}
            className="w-7 h-7 flex items-center justify-center rounded-md border border-bg-border bg-bg-elevated/40 text-ink-muted hover:text-ink-primary transition-colors"
          >
            ←
          </button>
          <span className="text-xs font-mono text-ink-primary font-bold capitalize w-32 text-center">{monthLabel}</span>
          <button
            type="button"
            aria-label="Next month"
            onClick={() => setCursor(new Date(year, month + 1, 1))}
            className="w-7 h-7 flex items-center justify-center rounded-md border border-bg-border bg-bg-elevated/40 text-ink-muted hover:text-ink-primary transition-colors"
          >
            →
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {WEEKDAYS.map((w) => (
          <div key={w} className="text-center text-[9px] font-mono text-ink-dim uppercase py-1">{w}</div>
        ))}

        {cells.map((day, i) => {
          if (day === null) return <div key={i} className="min-h-[92px] rounded-lg bg-transparent" />

          if (tab === 'events') {
            const dayEvents = eventsByDay.get(day) ?? []
            const counts: Record<EventImpact, number> = { high: 0, medium: 0, low: 0 }
            for (const e of dayEvents) counts[e.impact]++
            const border = counts.high > 0 ? IMPACT_BORDER.high : counts.medium > 0 ? IMPACT_BORDER.medium : counts.low > 0 ? IMPACT_BORDER.low : 'border-bg-border'

            return (
              <div key={i} className={clsx('min-h-[92px] rounded-lg border bg-bg-elevated/20 p-2 space-y-1 overflow-hidden', border)}>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono font-bold text-ink-primary">{day}</span>
                  <div className="flex gap-0.5">
                    {(['high', 'medium', 'low'] as EventImpact[]).map((impact) => counts[impact] > 0 && (
                      <span key={impact} className={clsx('w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-mono font-bold text-bg-base', IMPACT_BG[impact])}>
                        {counts[impact]}
                      </span>
                    ))}
                  </div>
                </div>
                {dayEvents.slice(0, 2).map((ev) => (
                  <p key={ev.id} className="text-[8.5px] font-mono text-ink-muted truncate">{ev.currency}: {ev.title}</p>
                ))}
                {dayEvents.length > 2 && (
                  <p className="text-[8px] font-mono text-ink-dim italic">+{dayEvents.length - 2} more</p>
                )}
              </div>
            )
          }

          const dayPnl = pnlByDay.get(day)
          const hasTrades = dayPnl && dayPnl.trades > 0
          const bg = !hasTrades ? 'bg-bg-elevated/10 border-bg-border' : dayPnl!.pnl >= 0 ? 'bg-atlas/8 border-atlas/30' : 'bg-bear/8 border-bear/30'

          return (
            <div key={i} className={clsx('min-h-[92px] rounded-lg border p-2 flex flex-col justify-between', bg)}>
              <span className="text-[11px] font-mono font-bold text-ink-primary">{day}</span>
              {hasTrades && (
                <div>
                  <p className={clsx('text-xs font-mono font-bold', dayPnl!.pnl >= 0 ? 'text-atlas' : 'text-bear')}>
                    {dayPnl!.pnl >= 0 ? '+' : ''}${dayPnl!.pnl.toFixed(0)}
                  </p>
                  <p className="text-[8px] font-mono text-ink-dim">{dayPnl!.trades} trade{dayPnl!.trades > 1 ? 's' : ''}</p>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {tab === 'events' && (
        <div className="flex items-center gap-4 text-[9px] font-mono text-ink-dim uppercase pt-1">
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-bear" /> High Impact</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-pulse" /> Medium Impact</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-oracle" /> Low Impact</span>
        </div>
      )}

      {tab === 'events' && (
        <div className="border-t border-bg-border pt-4 space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-mono font-bold text-ink-primary">Economic Events</h4>
            <span className="text-[10px] font-mono text-ink-dim px-2 py-0.5 rounded-full bg-bg-elevated">{eventsThisMonth.length} events</span>
          </div>
          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            {eventsThisMonth.length === 0 && (
              <p className="text-[10px] font-mono text-ink-dim">No events this month.</p>
            )}
            {eventsThisMonth.map((ev) => (
              <div key={ev.id} className="flex items-center justify-between px-3 py-2 rounded-lg border border-bg-border bg-bg-elevated/20">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={clsx('w-1.5 h-1.5 rounded-full shrink-0', IMPACT_BG[ev.impact])} />
                  <span className="text-[10px] font-mono text-ink-dim shrink-0">{ev.currency}</span>
                  <span className="text-[11px] font-mono text-ink-secondary truncate">{ev.title}</span>
                </div>
                <span className="text-[10px] font-mono text-ink-dim shrink-0 ml-2">
                  {new Date(ev.datetime).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
