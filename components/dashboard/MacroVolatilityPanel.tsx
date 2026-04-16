import type { EconomicEvent, KillZone } from '@/lib/oracle/types'

interface MacroVolatilityPanelProps {
  calendar: EconomicEvent[]
  killZones: KillZone[]
}

interface VolatilityWindow {
  id: string
  label: string
  start: string
  end: string
  level: 'high' | 'medium'
}

function toUtcHourMinute(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  })
}

function relativeLabel(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now()
  const mins = Math.round(diff / 60000)
  if (mins <= 0) return 'ahora'
  if (mins < 60) return `en ${mins}m`
  const hours = Math.floor(mins / 60)
  return `en ${hours}h ${mins % 60}m`
}

function buildVolatilityWindows(events: EconomicEvent[]): VolatilityWindow[] {
  const relevant = events
    .filter((event) => event.pending && (event.impact === 'high' || event.impact === 'medium'))
    .slice(0, 6)

  return relevant.map((event) => {
    const center = new Date(event.datetime).getTime()
    const minutes = event.impact === 'high' ? 45 : 30
    const start = new Date(center - minutes * 60000).toISOString()
    const end = new Date(center + minutes * 60000).toISOString()
    return {
      id: `window-${event.id}`,
      label: `${event.currency} · ${event.title}`,
      start,
      end,
      level: event.impact === 'high' ? 'high' : 'medium',
    }
  })
}

export function MacroVolatilityPanel({ calendar, killZones }: MacroVolatilityPanelProps) {
  const relevantEvents = calendar
    .filter((event) => event.pending && (event.impact === 'high' || event.impact === 'medium'))
    .slice(0, 5)
  const volatilityWindows = buildVolatilityWindows(calendar)
  const activeKillZone = killZones.find((zone) => zone.isActive) ?? null

  return (
    <div className="rounded-xl border border-bg-border bg-bg-card p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-[10px] font-mono font-bold text-ink-primary uppercase tracking-widest">Macro + ventanas de volatilidad</h3>
        {activeKillZone && (
          <span className="text-[10px] font-mono uppercase text-pulse px-2 py-1 rounded border border-pulse/30 bg-pulse/10">
            {activeKillZone.name} activa
          </span>
        )}
      </div>

      <div className="space-y-2">
        {relevantEvents.length === 0 && (
          <div className="text-xs font-mono text-ink-dim px-3 py-2 rounded border border-bg-border bg-bg-elevated/20">
            Sin eventos macro relevantes próximos.
          </div>
        )}
        {relevantEvents.map((event) => (
          <div key={event.id} className="flex items-center justify-between px-3 py-2 rounded border border-bg-border bg-bg-elevated/20">
            <div>
              <p className="text-xs font-mono text-ink-primary">{event.currency} · {event.title}</p>
              <p className="text-[10px] font-mono text-ink-dim">{relativeLabel(event.datetime)} · {toUtcHourMinute(event.datetime)} UTC</p>
            </div>
            <span className={`text-[10px] font-mono uppercase px-2 py-1 rounded border ${event.impact === 'high' ? 'text-bear border-bear/30 bg-bear/10' : 'text-pulse border-pulse/30 bg-pulse/10'}`}>
              {event.impact}
            </span>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <p className="text-[10px] font-mono text-ink-muted uppercase tracking-wider">Ventanas operativas sugeridas</p>
        {volatilityWindows.length === 0 && (
          <p className="text-[10px] font-mono text-ink-dim">No hay ventanas de volatilidad para las próximas horas.</p>
        )}
        {volatilityWindows.map((window) => (
          <div key={window.id} className="text-[10px] font-mono text-ink-secondary px-3 py-2 rounded border border-bg-border bg-bg-elevated/20">
            <span className={window.level === 'high' ? 'text-bear' : 'text-pulse'}>{window.level.toUpperCase()}</span> · {window.label}
            <span className="text-ink-dim"> · {toUtcHourMinute(window.start)}-{toUtcHourMinute(window.end)} UTC</span>
          </div>
        ))}
      </div>
    </div>
  )
}
