import { clsx } from 'clsx'
import type { MarketSession, KillZone, OracleAlert, EconomicEvent } from '@/lib/oracle/types'
import { SessionBadge, AlertBadge } from '@/components/ui/StatusBadge'
import { SectionTitle } from '@/components/ui/SectionTitle'

interface MarketContextProps {
  sessions:  MarketSession[]
  killZones: KillZone[]
  alerts:    OracleAlert[]
  calendar:  EconomicEvent[]
}

function formatRelativeTime(isoString: string): string {
  const diff = new Date(isoString).getTime() - Date.now()
  const abs  = Math.abs(diff)
  const mins = Math.floor(abs / 60000)
  const hrs  = Math.floor(abs / 3600000)

  if (diff < 0) return 'Publicado'
  if (mins < 60) return `en ${mins}m`
  return `en ${hrs}h ${mins % 60}m`
}

const IMPACT_STYLES: Record<string, string> = {
  high:   'text-bear bg-bear/10 border-bear/30',
  medium: 'text-pulse bg-pulse/10 border-pulse/30',
  low:    'text-ink-muted bg-bg-elevated border-bg-border',
}

export function MarketContext({ sessions, killZones, alerts, calendar }: MarketContextProps) {
  const pendingEvents  = calendar.filter((e) => e.pending).slice(0, 3)
  const unreadAlerts   = alerts.filter((a) => !a.read)
  const activeKillZone = killZones.find((kz) => kz.isActive)
  const nextSession    = sessions.find((s) => !s.isActive)

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

      {/* Sessions block */}
      <div className="rounded-xl border border-bg-border bg-bg-card p-4 space-y-3">
        <SectionTitle label="Sesiones" accent="oracle" />

        <div className="space-y-2">
          {sessions.map((s) => (
            <div
              key={s.name}
              className={clsx(
                'flex items-center justify-between px-3 py-2 rounded-lg',
                s.isActive ? 'bg-bg-elevated border border-atlas/20' : 'bg-bg-base',
              )}
            >
              <div className="flex items-center gap-2">
                <span className={clsx(
                  'w-1.5 h-1.5 rounded-full',
                  s.isActive ? 'bg-atlas animate-pulse-slow' : 'bg-ink-dim',
                )} />
                <span className="text-xs font-mono text-ink-secondary">{s.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-2xs font-mono text-ink-muted">
                  {s.openUTC}–{s.closeUTC}
                </span>
                {s.isActive && s.killZone && (
                  <span className="text-2xs font-mono text-pulse bg-pulse/10 border border-pulse/30 px-1.5 py-0.5 rounded">KZ</span>
                )}
              </div>
            </div>
          ))}
        </div>

        {activeKillZone && (
          <div className="flex items-start gap-2 px-3 py-2 bg-pulse/10 border border-pulse/30 rounded-lg">
            <span className="w-1.5 h-1.5 mt-1 rounded-full bg-pulse animate-pulse-slow shrink-0" />
            <div>
              <p className="text-2xs font-mono font-semibold text-pulse">{activeKillZone.name}</p>
              <p className="text-2xs font-mono text-ink-muted mt-0.5">
                {activeKillZone.startUTC} – {activeKillZone.endUTC} UTC
              </p>
            </div>
          </div>
        )}

        {nextSession && !sessions.find((s) => s.isActive) && (
          <div className="flex items-center gap-2 px-3 py-2 bg-bg-elevated rounded-lg border border-bg-border">
            <span className="text-2xs font-mono text-ink-muted">Próxima sesión:</span>
            <span className="text-2xs font-mono text-ink-secondary font-semibold">{nextSession.name} — {nextSession.openUTC} UTC</span>
          </div>
        )}
      </div>

      {/* Alerts block */}
      <div className="rounded-xl border border-bg-border bg-bg-card p-4 space-y-3">
        <SectionTitle
          label="Alertas"
          accent="pulse"
          right={
            unreadAlerts.length > 0
              ? <span className="text-2xs font-mono text-pulse bg-pulse/10 border border-pulse/30 px-1.5 py-0.5 rounded">{unreadAlerts.length}</span>
              : undefined
          }
        />

        <div className="space-y-2">
          {unreadAlerts.length === 0 && (
            <p className="text-xs font-mono text-ink-muted text-center py-4">Sin alertas activas</p>
          )}
          {unreadAlerts.map((alert) => (
            <div key={alert.id} className={clsx(
              'p-3 rounded-lg border space-y-1.5',
              alert.severity === 'critical' ? 'bg-bear/5 border-bear/20'
              : alert.severity === 'warning' ? 'bg-pulse/5 border-pulse/20'
              : 'bg-bg-elevated border-bg-border',
            )}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-mono font-semibold text-ink-primary">{alert.title}</span>
                <AlertBadge severity={alert.severity} />
              </div>
              <p className="text-2xs font-mono text-ink-muted leading-relaxed">{alert.message}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Calendar block */}
      <div className="rounded-xl border border-bg-border bg-bg-card p-4 space-y-3">
        <SectionTitle label="Calendario" sublabel="Próximos eventos" accent="nexus" />

        <div className="space-y-2">
          {pendingEvents.length === 0 && (
            <p className="text-xs font-mono text-ink-muted text-center py-4">Sin eventos pendientes</p>
          )}
          {pendingEvents.map((ev) => (
            <div key={ev.id} className="flex items-start gap-3 px-3 py-2.5 bg-bg-elevated rounded-lg border border-bg-border">
              <div className="flex flex-col items-center gap-1 shrink-0">
                <span className={clsx(
                  'text-2xs font-mono font-semibold px-1.5 py-0.5 rounded border',
                  IMPACT_STYLES[ev.impact],
                )}>
                  {ev.impact.toUpperCase()}
                </span>
                <span className="text-2xs font-mono text-ink-muted">{ev.currency}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-mono text-ink-primary font-semibold truncate">{ev.title}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-2xs font-mono text-oracle">{formatRelativeTime(ev.datetime)}</span>
                  {ev.forecast && (
                    <span className="text-2xs font-mono text-ink-muted">Prev: {ev.previous ?? '—'} · Est: {ev.forecast}</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}
