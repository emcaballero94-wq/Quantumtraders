'use client'

import { clsx } from 'clsx'
import type { CentralBankRate, CurrencyStrength, EconomicEvent } from '@/lib/oracle/types'
import { CollapsePanel } from '@/components/ui/CollapsePanel'
import { SectionTitle } from '@/components/ui/SectionTitle'

interface DepthPanelProps {
  centralBanks:     CentralBankRate[]
  currencyStrength: CurrencyStrength[]
  calendar:         EconomicEvent[]
}

export function DepthPanel({ centralBanks, currencyStrength, calendar }: DepthPanelProps) {
  return (
    <CollapsePanel title="Profundidad — Contexto Macro" defaultOpen={false}>
      <div className="p-4 space-y-4">

        {/* Central Banks */}
        <div className="space-y-3">
          <SectionTitle label="Tasas de Bancos Centrales" accent="nexus" />
          {centralBanks.length === 0 ? (
            <div className="px-3 py-2.5 bg-bg-elevated rounded-lg border border-bg-border">
              <p className="text-2xs font-mono text-ink-muted">Sin feed de tasas en tiempo real para esta seccion.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {centralBanks.map((bank) => (
                <div
                  key={bank.currency}
                  className="px-3 py-2.5 bg-bg-elevated rounded-lg border border-bg-border space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-ink-primary">{bank.currency}</span>
                    <span className={clsx(
                      'text-2xs font-mono font-semibold px-1.5 py-0.5 rounded border',
                      bank.bias === 'hawkish' ? 'text-atlas bg-atlas/10 border-atlas/30'
                      : bank.bias === 'dovish' ? 'text-bear bg-bear/10 border-bear/30'
                      : 'text-ink-muted bg-bg-card border-bg-border',
                    )}>
                      {bank.bias.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-sm font-mono font-bold text-ink-primary tabular-nums">
                    {bank.rate.toFixed(2)}%
                  </p>
                  <p className="text-2xs font-mono text-ink-muted">{bank.bank}</p>
                  <p className="text-2xs font-mono text-ink-dim">Next: {bank.nextMeeting}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="h-px bg-bg-border" />

        {/* Currency Strength */}
        <div className="space-y-3">
          <SectionTitle label="Fuerza de Divisas" sublabel="Ranking relativo" accent="oracle" />
          <div className="space-y-2">
            {[...currencyStrength]
              .sort((a, b) => b.score - a.score)
              .map((cs, idx) => {
                const isStrong = cs.score >= 55
                const isWeak   = cs.score <= 35
                return (
                  <div key={cs.currency} className="flex items-center gap-3">
                    <span className="text-2xs font-mono text-ink-muted w-4 tabular-nums">{idx + 1}</span>
                    <span className="text-xs font-mono font-bold text-ink-primary w-8">{cs.currency}</span>
                    <div className="flex-1 h-1.5 bg-bg-border rounded-full overflow-hidden">
                      <div
                        className={clsx(
                          'h-full rounded-full transition-all duration-500',
                          isStrong ? 'bg-atlas' : isWeak ? 'bg-bear' : 'bg-oracle',
                        )}
                        style={{ width: `${((cs.score + 100) / 200) * 100}%` }}
                      />
                    </div>
                    <div className="flex items-center gap-2 w-32">
                      <span className={clsx(
                        'text-xs font-mono font-semibold tabular-nums w-8',
                        isStrong ? 'text-atlas' : isWeak ? 'text-bear' : 'text-ink-secondary',
                      )}>
                        {cs.score > 0 ? '+' : ''}{cs.score}
                      </span>
                      <span className={clsx(
                        'text-2xs font-mono',
                        cs.trend === 'strengthening' ? 'text-atlas'
                        : cs.trend === 'weakening' ? 'text-bear'
                        : 'text-ink-muted',
                      )}>
                        {cs.trend === 'strengthening' ? '↑' : cs.trend === 'weakening' ? '↓' : '→'}
                      </span>
                      <span className="text-2xs font-mono text-ink-muted tabular-nums">
                        {cs.change4h > 0 ? '+' : ''}{cs.change4h.toFixed(2)}% (4H)
                      </span>
                    </div>
                  </div>
                )
              })}
          </div>
        </div>

        <div className="h-px bg-bg-border" />

        {/* Economic Calendar — Full */}
        <div className="space-y-3">
          <SectionTitle label="Calendario Económico" sublabel="Todos los eventos del día" accent="pulse" />
          <div className="space-y-1.5">
            {calendar.map((ev) => (
              <div
                key={ev.id}
                className={clsx(
                  'grid grid-cols-[auto_1fr_auto] items-center gap-3 px-3 py-2 rounded-lg border',
                  ev.pending ? 'bg-bg-elevated border-bg-border' : 'bg-bg-base border-bg-border opacity-60',
                )}
              >
                <div className="flex items-center gap-2">
                  <span className={clsx(
                    'text-2xs font-mono font-semibold px-1 py-0.5 rounded border w-12 text-center',
                    ev.impact === 'high'   ? 'text-bear bg-bear/10 border-bear/30'
                    : ev.impact === 'medium' ? 'text-pulse bg-pulse/10 border-pulse/30'
                    : 'text-ink-muted bg-bg-card border-bg-border',
                  )}>
                    {ev.impact.toUpperCase()[0]}
                  </span>
                  <span className="text-2xs font-mono text-ink-muted w-6">{ev.currency}</span>
                </div>
                <div>
                  <p className="text-xs font-mono text-ink-secondary">{ev.title}</p>
                  {(ev.forecast || ev.previous) && (
                    <p className="text-2xs font-mono text-ink-muted mt-0.5">
                      Prev: {ev.previous ?? '—'} · Est: {ev.forecast ?? '—'}
                      {ev.actual && <span className="text-atlas ml-2">Real: {ev.actual}</span>}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-2xs font-mono text-ink-muted tabular-nums">
                    {new Date(ev.datetime).toLocaleTimeString('en-US', {
                      hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC',
                    })} UTC
                  </p>
                  <p className={clsx(
                    'text-2xs font-mono mt-0.5',
                    ev.pending ? 'text-oracle' : 'text-ink-muted',
                  )}>
                    {ev.pending ? 'Pendiente' : 'Publicado'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </CollapsePanel>
  )
}
