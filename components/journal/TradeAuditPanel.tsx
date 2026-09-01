'use client'

import { clsx } from 'clsx'
import { SectionTitle } from '@/components/ui/SectionTitle'
import type { TradeAuditStats } from '@/lib/journal/audit-engine'

const FLAG_STYLE: Record<'good' | 'warning' | 'bad', { dot: string; text: string }> = {
  good: { dot: 'bg-atlas', text: 'text-atlas' },
  warning: { dot: 'bg-pulse', text: 'text-pulse' },
  bad: { dot: 'bg-bear', text: 'text-bear' },
}

function fmt(value: number | null, opts: { suffix?: string; decimals?: number } = {}): string {
  if (value === null || !Number.isFinite(value)) return '—'
  const { suffix = '', decimals = 1 } = opts
  return `${value.toFixed(decimals)}${suffix}`
}

export function TradeAuditPanel({ stats }: { stats: TradeAuditStats }) {
  if (stats.totalTrades === 0) {
    return (
      <div className="rounded-xl border border-bg-border bg-bg-card glass-card p-5">
        <SectionTitle label="Trade Audit" sublabel="Your trading history turned into actionable information" accent="oracle" />
        <p className="text-xs font-mono text-ink-dim mt-4">
          No trades logged yet. Add your first record to start building your audit.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-bg-border bg-bg-card glass-card p-5 space-y-5">
      <SectionTitle
        label="Trade Audit"
        sublabel={`${stats.totalTrades} trades analyzed · ${stats.closedTrades} closed`}
        accent="oracle"
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Metric label="Win Rate" value={fmt(stats.winRate, { suffix: '%', decimals: 1 })} />
        <Metric
          label="Profit Factor"
          value={stats.profitFactor === Infinity ? '∞' : fmt(stats.profitFactor, { decimals: 2 })}
        />
        <Metric
          label="Average R"
          value={stats.avgR !== null ? `${stats.avgR >= 0 ? '+' : ''}${stats.avgR.toFixed(2)}R` : '—'}
          note={stats.rSampleSize > 0 ? `n=${stats.rSampleSize}` : 'needs exit price'}
        />
        <Metric
          label="Max Drawdown"
          value={stats.maxDrawdown !== null ? `$${stats.maxDrawdown.toFixed(0)}` : '—'}
        />
      </div>

      {stats.flags.length > 0 && (
        <div className="space-y-2">
          <p className="text-[9px] font-mono text-ink-dim uppercase tracking-widest">Execution</p>
          <div className="space-y-1.5">
            {stats.flags.map((flag) => {
              const style = FLAG_STYLE[flag.status]
              return (
                <div key={flag.label} className="flex items-center gap-2 text-[11px] font-mono">
                  <span className={clsx('w-1.5 h-1.5 rounded-full shrink-0', style.dot)} />
                  <span className={clsx('font-semibold', style.text)}>{flag.label}</span>
                  <span className="text-ink-dim">— {flag.detail}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <p className="text-[9px] font-mono text-ink-dim uppercase tracking-widest">Detected Patterns</p>
        {!stats.hasEnoughDataForPatterns ? (
          <p className="text-[11px] font-mono text-ink-dim">
            Keep logging trades — patterns appear once you have 10+ closed trades ({stats.closedTrades}/10 so far).
          </p>
        ) : stats.patterns.length === 0 ? (
          <p className="text-[11px] font-mono text-ink-dim">No significant patterns detected yet.</p>
        ) : (
          <div className="space-y-2">
            {stats.patterns.map((pattern) => (
              <div key={pattern.title} className="px-3 py-2 rounded-lg border border-pulse/25 bg-pulse/8">
                <p className="text-[10px] font-mono font-bold text-pulse uppercase">{pattern.title}</p>
                <p className="text-[10px] font-mono text-ink-secondary mt-0.5">{pattern.description}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function Metric({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="p-3 rounded-lg border border-bg-border bg-bg-elevated/30">
      <p className="text-[9px] font-mono text-ink-dim uppercase tracking-wider">{label}</p>
      <p className="text-lg font-mono font-bold text-ink-primary tabular-nums mt-0.5">{value}</p>
      {note && <p className="text-[9px] font-mono text-ink-dim mt-0.5">{note}</p>}
    </div>
  )
}
