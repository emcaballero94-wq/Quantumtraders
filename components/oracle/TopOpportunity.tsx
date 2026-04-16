import { clsx } from 'clsx'
import Link from 'next/link'
import type { RadarAsset } from '@/lib/oracle/types'
import { ScoreBadge, ScorePill } from '@/components/ui/ScoreBadge'
import { RatingBadge, BiasBadge } from '@/components/ui/StatusBadge'
import { SectionTitle } from '@/components/ui/SectionTitle'

interface TopOpportunityProps {
  asset: RadarAsset
}

const CATEGORY_LABEL: Record<string, string> = {
  forex:   'FX',
  metals:  'METALS',
  indices: 'INDICES',
  crypto:  'CRYPTO',
}

export function TopOpportunity({ asset }: TopOpportunityProps) {
  const change24hPositive = asset.change24h >= 0

  return (
    <div className="relative overflow-hidden rounded-xl border border-atlas/30 bg-bg-card shadow-atlas">

      {/* Ambient glow */}
      <div className="absolute inset-0 bg-gradient-to-br from-atlas/8 via-transparent to-transparent pointer-events-none" />

      <div className="relative p-5 space-y-4">

        {/* Header */}
        <div className="flex items-center justify-between">
          <SectionTitle label="Top Oportunidad" sublabel="Score más alto del sistema" accent="atlas" />
          <RatingBadge rating={asset.rating} />
        </div>

        {/* Symbol row */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xs font-mono text-ink-muted px-1.5 py-0.5 bg-bg-elevated rounded border border-bg-border">
                {CATEGORY_LABEL[asset.category] ?? asset.category.toUpperCase()}
              </span>
            </div>
            <h2 className="text-2xl font-mono font-bold text-ink-primary tracking-tight">{asset.symbol}</h2>
            <p className="text-xs font-mono text-ink-muted mt-0.5">{asset.name}</p>
          </div>

          <div className="text-right">
            <p className="text-lg font-mono font-bold text-ink-primary tabular-nums">
              {asset.currentPrice.toLocaleString('en-US', { maximumFractionDigits: 5 })}
            </p>
            <p className={clsx(
              'text-xs font-mono font-semibold tabular-nums',
              change24hPositive ? 'text-atlas' : 'text-bear',
            )}>
              {change24hPositive ? '+' : ''}{asset.change24h.toFixed(2)}%
            </p>
          </div>
        </div>

        {/* Scores row */}
        <div className="flex items-center gap-3 py-3 border-y border-bg-border">
          <div className="flex flex-col gap-1 flex-1 items-center">
            <span className="text-2xs font-mono text-ink-muted uppercase tracking-wider">Total</span>
            <ScoreBadge score={asset.totalScore} size="lg" />
          </div>
          <div className="w-px h-8 bg-bg-border" />
          <ScorePill score={asset.macroScore} label="Macro" />
          <ScorePill score={asset.technicalScore} label="Técnico" />
          <ScorePill score={asset.timingScore} label="Timing" />
        </div>

        {/* Factors */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            <BiasBadge bias={asset.bias} size="sm" />
            <span className="text-2xs font-mono text-ink-muted">
              Tendencia {asset.trend === 'uptrend' ? 'alcista' : asset.trend === 'downtrend' ? 'bajista' : 'lateral'}
            </span>
          </div>

          {/* CTA */}
          <Link
            href={`/dashboard/atlas?symbol=${asset.symbol}`}
            className="flex items-center gap-2 px-3 py-2 bg-atlas/10 hover:bg-atlas/20 border border-atlas/30 hover:border-atlas/50 rounded-lg text-atlas text-xs font-mono font-semibold transition-all"
          >
            <span>Analizar con ATLAS</span>
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </Link>
        </div>

      </div>
    </div>
  )
}
